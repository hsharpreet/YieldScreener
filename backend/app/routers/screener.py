from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from app.core.deps import get_optional_user
from app.data.provider import DataProvider
from app.db.models import User
from app.screener.filters import FundamentalsFilter, filter_illiquid
from app.screener.ranker import RankedContract, rank_contracts

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


class ScreenerRow(BaseModel):
    ticker: str
    name: str
    price: float
    market_cap: float | None
    pe_ratio: float | None
    sector: str | None
    best_call: ContractOut | None
    peg_ratio: float | None = None
    roe: float | None = None
    analyst_rating: float | None = None


def _to_contract_out(ranked_contract: RankedContract) -> ContractOut:
    c = ranked_contract.contract
    m = ranked_contract.metrics
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
        metrics=MetricsOut(
            net_credit=m.net_credit,
            static_yield=m.static_yield,
            annualized_static=m.annualized_static,
            downside_cushion=m.downside_cushion,
            breakeven=m.breakeven,
            if_called_profit=m.if_called_profit,
            if_called_return=m.if_called_return,
            annualized_if_called=m.annualized_if_called,
        ),
        delta=c.delta,
        gamma=c.gamma,
        theta=c.theta,
        vega=c.vega,
        iv_rank=c.iv_rank,
    )


@router.get("/screen", response_model=list[ScreenerRow])
def screen(
    response: Response,
    tickers: str | None = Query(
        None, description="Comma-separated tickers; defaults to built-in universe"
    ),
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
    current_user: User | None = Depends(get_optional_user),
) -> list[ScreenerRow]:
    """Return the best covered call per quality-filtered stock.

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
        try:
            raw = _provider.get_call_options(ticker, min_dte=min_dte, max_dte=max_dte)
        except Exception:
            raw = []
        liquid = filter_illiquid(raw)
        ranked = rank_contracts(liquid, price=quote.price)
        best = _to_contract_out(ranked[0]) if ranked else None
        rows.append(
            ScreenerRow(
                ticker=ticker,
                name=quote.name,
                price=quote.price,
                market_cap=quote.market_cap,
                pe_ratio=quote.pe_ratio,
                sector=quote.sector,
                best_call=best,
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
    min_dte: int = Query(7, ge=1),
    max_dte: int = Query(60, ge=1),
) -> list[ContractOut]:
    """All liquid covered-call contracts for a single ticker.

    Used by the accordion chain view. Educational data only — not investment advice.
    """
    _p = provider
    if _p is None:
        from app.data.yfinance_provider import YFinanceProvider
        _p = YFinanceProvider()
    try:
        quote = _p.get_quote(ticker)
        raw = _p.get_call_options(ticker.upper(), min_dte=min_dte, max_dte=max_dte)
    except Exception:
        return []
    liquid = filter_illiquid(raw)
    ranked = rank_contracts(liquid, price=quote.price, otm_only=False)
    return [_to_contract_out(r) for r in ranked]
