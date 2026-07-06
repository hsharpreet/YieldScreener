"""Black-Scholes delta — pure math, no side effects.

yfinance option chains carry implied volatility but no Greeks, so we derive
delta from IV.  Deltas here are model estimates (European BS, flat rate, no
dividends) — good enough for screening/filtering, and labeled as estimates in
the UI.  Providers that supply real Greeks (e.g. Tradier) keep their values;
this is only the fallback.
"""
from __future__ import annotations

import math

RISK_FREE_RATE = 0.045  # flat annual rate assumption for delta estimates


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def bs_call_delta(
    price: float,
    strike: float,
    dte: int,
    iv: float,
    rate: float = RISK_FREE_RATE,
) -> float | None:
    """Black-Scholes delta of a call. None when inputs can't produce a number."""
    if price <= 0 or strike <= 0 or dte <= 0 or iv <= 0:
        return None
    t = dte / 365.0
    d1 = (math.log(price / strike) + (rate + iv * iv / 2.0) * t) / (iv * math.sqrt(t))
    return _norm_cdf(d1)


def bs_put_delta(
    price: float,
    strike: float,
    dte: int,
    iv: float,
    rate: float = RISK_FREE_RATE,
) -> float | None:
    """Black-Scholes delta of a put (negative, in [-1, 0])."""
    call = bs_call_delta(price, strike, dte, iv, rate)
    return None if call is None else call - 1.0
