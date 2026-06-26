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
