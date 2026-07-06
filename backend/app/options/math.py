from dataclasses import dataclass


@dataclass
class CoveredCallMetrics:
    net_credit: float
    static_yield: float
    annualized_static: float
    downside_cushion: float
    breakeven: float
    if_called_profit: float
    if_called_return: float
    annualized_if_called: float


def covered_call_metrics(
    price: float,
    strike: float,
    premium: float,
    dte: int,
) -> CoveredCallMetrics:
    """
    Compute all covered-call metrics for a single contract.

    Annualized figures are naive-linear (365/dte multiplier) and must be
    labeled "illustrative" in every user-facing surface — they assume
    flawless repetition at the same rate for a full year.

    Args:
        price:   Current stock price (cost basis, per share).
        strike:  Option strike price.
        premium: Option mid-price received per share ((bid + ask) / 2).
        dte:     Calendar days until expiration.

    Returns:
        CoveredCallMetrics with all seven metrics plus breakeven.
    """
    if dte <= 0:
        raise ValueError("dte must be a positive integer")
    if price <= 0:
        raise ValueError("price must be positive")
    if premium < 0:
        raise ValueError("premium cannot be negative")

    net_credit = premium * 100
    static_yield = premium / price
    annualized_static = static_yield * (365 / dte)
    downside_cushion = premium / price
    breakeven = price - premium
    if_called_profit = (premium + (strike - price)) * 100
    if_called_return = (premium + (strike - price)) / price
    annualized_if_called = if_called_return * (365 / dte)

    return CoveredCallMetrics(
        net_credit=net_credit,
        static_yield=static_yield,
        annualized_static=annualized_static,
        downside_cushion=downside_cushion,
        breakeven=breakeven,
        if_called_profit=if_called_profit,
        if_called_return=if_called_return,
        annualized_if_called=annualized_if_called,
    )


@dataclass
class CashSecuredPutMetrics:
    net_credit: float          # premium × 100
    collateral: float          # strike × 100 — cash set aside to secure the put
    static_yield: float        # premium / strike — return on collateral if OTM expiry
    annualized_static: float   # illustrative, naive 365/dte
    breakeven: float           # strike − premium
    discount_to_price: float   # (price − breakeven) / price — margin below current price
    max_profit: float          # = net_credit (premium is the most a short put makes)


def cash_secured_put_metrics(
    price: float,
    strike: float,
    premium: float,
    dte: int,
) -> CashSecuredPutMetrics:
    """
    Metrics for one cash-secured short put.

    Collateral (strike × 100) is the cash reserved to buy shares if assigned.
    Static yield is premium ÷ strike — the return on that collateral when the
    put expires worthless.  If assigned, the effective cost basis is the
    breakeven (strike − premium): shares acquired at a discount_to_price
    below today's price.  A short put's max profit is always the premium.

    Annualized figures are naive-linear (365/dte) and must be labeled
    "illustrative" in every user-facing surface.
    """
    if dte <= 0:
        raise ValueError("dte must be a positive integer")
    if price <= 0:
        raise ValueError("price must be positive")
    if strike <= 0:
        raise ValueError("strike must be positive")
    if premium < 0:
        raise ValueError("premium cannot be negative")

    net_credit = premium * 100
    collateral = strike * 100
    static_yield = premium / strike
    annualized_static = static_yield * (365 / dte)
    breakeven = strike - premium
    discount_to_price = (price - breakeven) / price

    return CashSecuredPutMetrics(
        net_credit=net_credit,
        collateral=collateral,
        static_yield=static_yield,
        annualized_static=annualized_static,
        breakeven=breakeven,
        discount_to_price=discount_to_price,
        max_profit=net_credit,
    )


@dataclass
class PmccMetrics:
    capital_required: float     # long-call debit × 100 — the "poor man's" capital
    net_credit: float           # short-call premium × 100 per cycle
    income_yield: float         # short premium / long premium — yield on capital
    annualized_income: float    # illustrative, naive 365/short_dte
    net_debit: float            # (long premium − short premium) × 100
    breakeven: float            # long strike + long premium − short premium (at long expiry)
    max_profit_if_called: float # (short strike − long strike − net debit/share) × 100, approx
    assignment_safe: bool       # strike width ≥ net debit → assignment can't lock in a loss


def pmcc_metrics(
    price: float,
    long_strike: float,
    long_premium: float,
    short_strike: float,
    short_premium: float,
    short_dte: int,
) -> PmccMetrics:
    """
    Metrics for a poor man's covered call (long deep-ITM LEAPS call + short
    OTM call).

    max_profit_if_called treats the long call as a stock substitute and
    ignores its remaining time value at short expiry — it is an APPROXIMATION
    and must be labeled as such.  assignment_safe is the standard width rule:
    (short strike − long strike) ≥ net debit per share means early assignment
    cannot force a locked-in loss.
    """
    if short_dte <= 0:
        raise ValueError("short_dte must be a positive integer")
    if price <= 0:
        raise ValueError("price must be positive")
    if long_premium <= 0:
        raise ValueError("long_premium must be positive")
    if short_premium < 0:
        raise ValueError("short_premium cannot be negative")
    if short_strike <= long_strike:
        raise ValueError("short_strike must be above long_strike")

    capital_required = long_premium * 100
    net_credit = short_premium * 100
    income_yield = short_premium / long_premium
    annualized_income = income_yield * (365 / short_dte)
    net_debit_per_share = long_premium - short_premium
    net_debit = net_debit_per_share * 100
    breakeven = long_strike + net_debit_per_share
    width = short_strike - long_strike
    max_profit_if_called = (width - net_debit_per_share) * 100
    assignment_safe = width >= net_debit_per_share

    return PmccMetrics(
        capital_required=capital_required,
        net_credit=net_credit,
        income_yield=income_yield,
        annualized_income=annualized_income,
        net_debit=net_debit,
        breakeven=breakeven,
        max_profit_if_called=max_profit_if_called,
        assignment_safe=assignment_safe,
    )
