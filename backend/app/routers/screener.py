from __future__ import annotations

from typing import TYPE_CHECKING, Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from app.core.deps import get_optional_user
from app.data.provider import DataProvider
from app.db.models import User
from app.screener.filters import ContractFilter, FundamentalsFilter, filter_illiquid
from app.screener.ranker import (
    RankedContract,
    RankedPmcc,
    best_per_expiry,
    is_itm,
    rank_contracts,
    rank_pmcc,
    select_long_leg,
)

Strategy = Literal["covered_call", "cash_secured_put", "pmcc"]

if TYPE_CHECKING:
    from app.data.scheduler import DataRefreshScheduler

router = APIRouter(prefix="/api", tags=["screener"])

# Both injected by main.py on startup.
scheduler: Optional["DataRefreshScheduler"] = None
provider: Optional[DataProvider] = None  # falls back to YFinanceProvider if None

DEFAULT_UNIVERSE = [
    # Mega-cap tech (high option liquidity)
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
    # Financials
    "JPM", "BAC", "V",
    # Healthcare
    "JNJ", "UNH", "ABBV",
    # Consumer
    "WMT", "HD", "COST", "KO",
    # Energy
    "XOM", "CVX",
    # Other
    "DIS",
]


class MetricsOut(BaseModel):
    net_credit: float
    static_yield: float
    annualized_static: float
    downside_cushion: float
    breakeven: float
    if_called_profit: float
    if_called_return: float
    annualized_if_called: float
    # Strategy extras (None unless that strategy is selected)
    collateral: float | None = None          # CSP: strike × 100 cash secured
    capital_required: float | None = None    # PMCC: long-call debit × 100
    net_debit: float | None = None           # PMCC: (long − short premium) × 100
    assignment_safe: bool | None = None      # PMCC: width covers net debit


class ContractOut(BaseModel):
    strike: float
    expiry: str
    dte: int
    premium: float
    bid: float
    ask: float
    volume: int
    open_interest: int
    implied_volatility: float
    earnings_within_dte: bool
    metrics: MetricsOut
    delta: float | None = None
    gamma: float | None = None
    theta: float | None = None
    vega: float | None = None
    iv_rank: float | None = None
    score: float = 0.0
    is_itm: bool = False
    recommended: bool = False        # overall top-ranked OTM contract
    best_for_expiry: bool = False    # best OTM contract within its expiry
    option_type: str = "call"        # "call" | "put"
    leg: str | None = None           # PMCC: "long" | "short"


class ScreenerRow(BaseModel):
    ticker: str
    name: str
    price: float
    market_cap: float | None
    pe_ratio: float | None
    sector: str | None
    best_call: ContractOut | None    # CC: best call · CSP: best put · PMCC: best short leg
    long_call: ContractOut | None = None  # PMCC only: the long LEAPS leg
    peg_ratio: float | None = None
    roe: float | None = None
    analyst_rating: float | None = None


def _base_contract_out(c, metrics: MetricsOut, score: float, itm: bool) -> ContractOut:
    return ContractOut(
        strike=c.strike,
        expiry=c.expiry,
        dte=c.dte,
        premium=c.premium,
        bid=c.bid,
        ask=c.ask,
        volume=c.volume,
        open_interest=c.open_interest,
        implied_volatility=c.implied_volatility,
        earnings_within_dte=c.earnings_within_dte,
        metrics=metrics,
        delta=c.delta,
        gamma=c.gamma,
        theta=c.theta,
        vega=c.vega,
        iv_rank=c.iv_rank,
        score=score,
        is_itm=itm,
        option_type=c.option_type,
    )


def _to_contract_out(
    ranked_contract: RankedContract,
    price: float | None = None,
    recommended: bool = False,
    best_for_expiry: bool = False,
) -> ContractOut:
    """Serialize a ranked single-leg contract (covered call OR cash-secured put).

    The MetricsOut wire shape is shared; for puts the if_called_* slots carry
    the max-profit figures (a short put's best case is keeping the premium)
    and downside_cushion carries the discount to the current price."""
    c = ranked_contract.contract
    m = ranked_contract.metrics
    if c.option_type == "put":
        metrics = MetricsOut(
            net_credit=m.net_credit,
            static_yield=m.static_yield,
            annualized_static=m.annualized_static,
            downside_cushion=m.discount_to_price,
            breakeven=m.breakeven,
            if_called_profit=m.max_profit,
            if_called_return=m.static_yield,
            annualized_if_called=m.annualized_static,
            collateral=m.collateral,
        )
    else:
        metrics = MetricsOut(
            net_credit=m.net_credit,
            static_yield=m.static_yield,
            annualized_static=m.annualized_static,
            downside_cushion=m.downside_cushion,
            breakeven=m.breakeven,
            if_called_profit=m.if_called_profit,
            if_called_return=m.if_called_return,
            annualized_if_called=m.annualized_if_called,
        )
    out = _base_contract_out(
        c, metrics, ranked_contract.score,
        itm=price is not None and is_itm(c, price),
    )
    out.recommended = recommended
    out.best_for_expiry = best_for_expiry
    return out


def _pmcc_pair_out(
    pair: RankedPmcc,
    price: float,
    recommended: bool = False,
    best_for_expiry: bool = False,
) -> tuple[ContractOut, ContractOut]:
    """Serialize a PMCC pair → (long_leg, short_leg). Both carry the pair's
    metrics; static_yield slots hold the income yield on the long-call capital,
    if_called_* the (approximate) max profit if assigned."""
    m = pair.metrics
    if_called_return = (
        m.max_profit_if_called / m.capital_required if m.capital_required > 0 else 0.0
    )
    metrics = MetricsOut(
        net_credit=m.net_credit,
        static_yield=m.income_yield,
        annualized_static=m.annualized_income,
        downside_cushion=(price - m.breakeven) / price if price > 0 else 0.0,
        breakeven=m.breakeven,
        if_called_profit=m.max_profit_if_called,
        if_called_return=if_called_return,
        annualized_if_called=if_called_return * (365 / pair.short_leg.dte),
        capital_required=m.capital_required,
        net_debit=m.net_debit,
        assignment_safe=m.assignment_safe,
    )
    long_out = _base_contract_out(pair.long_leg, metrics, pair.score, itm=True)
    long_out.leg = "long"
    short_out = _base_contract_out(pair.short_leg, metrics, pair.score, itm=False)
    short_out.leg = "short"
    short_out.recommended = recommended
    short_out.best_for_expiry = best_for_expiry
    return long_out, short_out


@router.get("/screen", response_model=list[ScreenerRow])
def screen(
    response: Response,
    tickers: str | None = Query(
        None, description="Comma-separated tickers; defaults to built-in universe"
    ),
    strategy: Strategy = Query("covered_call"),
    min_dte: int = Query(21, ge=1),
    max_dte: int = Query(45, ge=1),
    # General
    min_market_cap: float | None = Query(None, ge=0),
    sectors: str | None = Query(None),
    max_analyst_rating: float | None = Query(None, ge=1.0, le=5.0),
    # Valuation
    max_pe: float | None = Query(None, ge=0),
    max_forward_pe: float | None = Query(None, ge=0),
    max_peg: float | None = Query(None, ge=0),
    max_price_to_book: float | None = Query(None, ge=0),
    max_price_to_sales: float | None = Query(None, ge=0),
    max_ev_to_ebitda: float | None = Query(None, ge=0),
    min_dividend_yield: float | None = Query(None, ge=0),
    # Profitability
    min_gross_margin: float | None = Query(None),
    min_operating_margin: float | None = Query(None),
    min_net_margin: float | None = Query(None),
    min_roe: float | None = Query(None),
    min_roa: float | None = Query(None),
    # Financial health
    max_debt_to_equity: float | None = Query(None, ge=0),
    min_current_ratio: float | None = Query(None, ge=0),
    # Risk / trading
    max_beta: float | None = Query(None, ge=0),
    max_short_float: float | None = Query(None, ge=0),
    # Growth / liquidity
    min_eps_growth: float | None = Query(None),
    min_quick_ratio: float | None = Query(None, ge=0),
    min_avg_volume: int | None = Query(None, ge=0),
    # Technicals
    min_rsi: float | None = Query(None, ge=0, le=100),
    max_rsi: float | None = Query(None, ge=0, le=100),
    above_sma_50: bool | None = Query(None),
    above_sma_200: bool | None = Query(None),
    min_52w_position: float | None = Query(None, ge=0, le=1),
    max_52w_position: float | None = Query(None, ge=0, le=1),
    # Option Greeks (|delta| so one bound works for calls and puts)
    min_delta: float | None = Query(None, ge=0, le=1),
    max_delta: float | None = Query(None, ge=0, le=1),
    min_iv_rank: float | None = Query(None, ge=0, le=100),
    current_user: User | None = Depends(get_optional_user),
) -> list[ScreenerRow]:
    """Return the best contract per quality-filtered stock for the selected
    strategy (covered call, cash-secured put, or PMCC).

    Reads exclusively from Redis cache populated by the background scheduler.
    Returns X-Data-Status: loading when the first refresh hasn't finished yet.
    Free tier: top 5 results. Pro tier: full results.
    Educational data only — not investment advice.
    """
    # Signal data freshness to the frontend.
    if scheduler is None or scheduler.ready:
        data_status = "stale" if (scheduler and scheduler.stale) else "ready"
    else:
        data_status = "loading"
    response.headers["X-Data-Status"] = data_status

    ticker_list = (
        [t.strip().upper() for t in tickers.split(",")] if tickers else DEFAULT_UNIVERSE
    )
    _provider = provider
    if _provider is None:
        from app.data.yfinance_provider import YFinanceProvider
        _provider = YFinanceProvider()
    sector_list = [s.strip() for s in sectors.split(",")] if sectors else None
    fund_filter = FundamentalsFilter(
        min_market_cap=min_market_cap,
        sector_filter=sector_list,
        max_analyst_rating=max_analyst_rating,
        max_pe=max_pe,
        max_forward_pe=max_forward_pe,
        max_peg=max_peg,
        max_price_to_book=max_price_to_book,
        max_price_to_sales=max_price_to_sales,
        max_ev_to_ebitda=max_ev_to_ebitda,
        min_dividend_yield=min_dividend_yield,
        min_gross_margin=min_gross_margin,
        min_operating_margin=min_operating_margin,
        min_net_margin=min_net_margin,
        min_roe=min_roe,
        min_roa=min_roa,
        max_debt_to_equity=max_debt_to_equity,
        min_current_ratio=min_current_ratio,
        max_beta=max_beta,
        max_short_float=max_short_float,
        min_eps_growth=min_eps_growth,
        min_quick_ratio=min_quick_ratio,
        min_rsi=min_rsi,
        max_rsi=max_rsi,
        above_sma_50=above_sma_50,
        above_sma_200=above_sma_200,
        min_52w_position=min_52w_position,
        max_52w_position=max_52w_position,
    )
    if min_avg_volume is not None:
        fund_filter.min_avg_volume = min_avg_volume
    contract_filter = ContractFilter(
        min_delta=min_delta, max_delta=max_delta, min_iv_rank=min_iv_rank
    )
    rows: list[ScreenerRow] = []

    for ticker in ticker_list:
        try:
            quote = _provider.get_quote(ticker)
        except Exception:
            continue
        if quote.price <= 0:
            continue
        if not fund_filter.passes(quote):
            continue

        best: ContractOut | None = None
        long_out: ContractOut | None = None

        if strategy == "pmcc":
            try:
                leaps = _provider.get_leaps_calls(ticker)
                shorts = _provider.get_call_options(ticker, min_dte=min_dte, max_dte=max_dte)
            except Exception:
                leaps, shorts = [], []
            long_leg = select_long_leg(filter_illiquid(leaps), price=quote.price)
            if long_leg is not None:
                candidates = contract_filter.apply(filter_illiquid(shorts))
                pairs = rank_pmcc(long_leg, candidates, price=quote.price)
                if pairs:
                    long_out, best = _pmcc_pair_out(pairs[0], quote.price, recommended=True)
        else:
            try:
                if strategy == "cash_secured_put":
                    raw = _provider.get_put_options(ticker, min_dte=min_dte, max_dte=max_dte)
                else:
                    raw = _provider.get_call_options(ticker, min_dte=min_dte, max_dte=max_dte)
            except Exception:
                raw = []
            liquid = contract_filter.apply(filter_illiquid(raw))
            ranked = rank_contracts(liquid, price=quote.price)
            if ranked:
                best = _to_contract_out(ranked[0], price=quote.price, recommended=True)

        rows.append(
            ScreenerRow(
                ticker=ticker,
                name=quote.name,
                price=quote.price,
                market_cap=quote.market_cap,
                pe_ratio=quote.pe_ratio,
                sector=quote.sector,
                best_call=best,
                long_call=long_out,
                peg_ratio=quote.peg_ratio,
                roe=quote.roe,
                analyst_rating=quote.analyst_rating,
            )
        )

    rows.sort(
        key=lambda r: r.best_call.metrics.annualized_static if r.best_call else -1,
        reverse=True,
    )

    is_pro = current_user is not None and current_user.tier == "pro"
    response.headers["X-Tier"] = "pro" if is_pro else "free"
    response.headers["X-Total"] = str(len(rows))

    if not is_pro:
        rows = rows[:5]

    return rows


@router.get("/contracts/{ticker}", response_model=list[ContractOut])
def get_contracts(
    ticker: str,
    strategy: Strategy = Query("covered_call"),
    min_dte: int = Query(7, ge=1),
    max_dte: int = Query(60, ge=1),
) -> list[ContractOut]:
    """All liquid contracts for a single ticker under the selected strategy.

    Used by the accordion chain view.  Each contract carries two ranking
    flags computed with the same score the screener uses:
      - best_for_expiry: best OTM contract within its own expiry date
      - recommended: the single best OTM contract across all expiries
    For PMCC the first element is the long LEAPS leg (leg="long"), followed
    by ranked short-leg candidates (leg="short").
    Educational data only — not investment advice.
    """
    _p = provider
    if _p is None:
        from app.data.yfinance_provider import YFinanceProvider
        _p = YFinanceProvider()

    if strategy == "pmcc":
        try:
            quote = _p.get_quote(ticker)
            leaps = _p.get_leaps_calls(ticker.upper())
            shorts = _p.get_call_options(ticker.upper(), min_dte=min_dte, max_dte=max_dte)
        except Exception:
            return []
        long_leg = select_long_leg(filter_illiquid(leaps), price=quote.price)
        if long_leg is None:
            return []
        pairs = rank_pmcc(long_leg, filter_illiquid(shorts), price=quote.price)
        if not pairs:
            return []
        best_by_expiry: dict[str, RankedPmcc] = {}
        for p in pairs:
            exp = p.short_leg.expiry
            if exp not in best_by_expiry or p.score > best_by_expiry[exp].score:
                best_by_expiry[exp] = p
        out: list[ContractOut] = []
        long_out, _ = _pmcc_pair_out(pairs[0], quote.price)
        out.append(long_out)
        for p in pairs:
            _, short_out = _pmcc_pair_out(
                p,
                quote.price,
                recommended=p is pairs[0],
                best_for_expiry=best_by_expiry.get(p.short_leg.expiry) is p,
            )
            out.append(short_out)
        return out

    try:
        quote = _p.get_quote(ticker)
        if strategy == "cash_secured_put":
            raw = _p.get_put_options(ticker.upper(), min_dte=min_dte, max_dte=max_dte)
        else:
            raw = _p.get_call_options(ticker.upper(), min_dte=min_dte, max_dte=max_dte)
    except Exception:
        return []
    liquid = filter_illiquid(raw)
    ranked = rank_contracts(liquid, price=quote.price, otm_only=False)
    expiry_winners = best_per_expiry(ranked, price=quote.price)
    winner_ids = {id(r) for r in expiry_winners.values()}
    overall = max(expiry_winners.values(), key=lambda r: r.score, default=None)
    return [
        _to_contract_out(
            r,
            price=quote.price,
            recommended=r is overall,
            best_for_expiry=id(r) in winner_ids,
        )
        for r in ranked
    ]
