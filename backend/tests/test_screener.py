from app.data.provider import OptionContract, StockQuote
from app.screener.filters import FundamentalsFilter, filter_illiquid
from app.screener.ranker import best_per_expiry, rank_contracts


def _make_quote(**kwargs) -> StockQuote:
    defaults = dict(
        ticker="TST",
        price=100.0,
        name="Test",
        market_cap=20_000_000_000,
        pe_ratio=20.0,
        avg_volume=2_000_000,
    )
    return StockQuote(**{**defaults, **kwargs})


def _make_contract(**kwargs) -> OptionContract:
    defaults = dict(
        ticker="TST",
        strike=105.0,
        expiry="2024-02-16",
        dte=28,
        premium=4.0,
        bid=3.8,
        ask=4.2,
        volume=500,
        open_interest=2000,
        implied_volatility=0.25,
        earnings_within_dte=False,
    )
    return OptionContract(**{**defaults, **kwargs})


def test_fundamentals_filter_passes() -> None:
    assert FundamentalsFilter().passes(_make_quote()) is True


def test_fundamentals_filter_fails_pe() -> None:
    # Filters are opt-in: pass max_pe explicitly to activate the check.
    assert FundamentalsFilter(max_pe=50.0).passes(_make_quote(pe_ratio=60.0)) is False


def test_fundamentals_filter_default_pe_unbounded() -> None:
    assert FundamentalsFilter().passes(_make_quote(pe_ratio=60.0)) is True


def test_fundamentals_filter_fails_mktcap() -> None:
    f = FundamentalsFilter(min_market_cap=5_000_000_000)
    assert f.passes(_make_quote(market_cap=1_000_000_000)) is False


def test_fundamentals_filter_none_values_pass() -> None:
    # None means unknown — don't exclude
    assert FundamentalsFilter().passes(_make_quote(pe_ratio=None, market_cap=None)) is True


def test_filter_illiquid_removes_zero_bid() -> None:
    c = _make_contract(bid=0.0)
    assert filter_illiquid([c]) == []


def test_filter_illiquid_removes_wide_spread() -> None:
    # bid=1, ask=3 → spread_pct=0.67
    c = _make_contract(bid=1.0, ask=3.0, premium=2.0)
    assert filter_illiquid([c]) == []


def test_filter_illiquid_removes_low_oi() -> None:
    c = _make_contract(open_interest=10)
    assert filter_illiquid([c]) == []


def test_filter_illiquid_keeps_oi_at_threshold() -> None:
    # OI floor is "< 50 excluded" — exactly 50 stays in.
    c = _make_contract(open_interest=50)
    assert filter_illiquid([c]) == [c]


def test_filter_illiquid_keeps_good_contract() -> None:
    c = _make_contract()
    assert filter_illiquid([c]) == [c]


def test_rank_contracts_order() -> None:
    c1 = _make_contract(premium=1.0, strike=101.0)  # low yield
    c2 = _make_contract(premium=6.0, strike=106.0)  # high yield
    ranked = rank_contracts([c1, c2], price=100.0)
    assert ranked[0].contract.premium == 6.0


def test_rank_contracts_excludes_zero_premium() -> None:
    c = _make_contract(premium=0.0)
    assert rank_contracts([c], price=100.0) == []


def test_rank_contracts_score_matches_sort_order() -> None:
    c1 = _make_contract(premium=1.0, strike=101.0)
    c2 = _make_contract(premium=6.0, strike=106.0)
    ranked = rank_contracts([c1, c2], price=100.0)
    assert ranked[0].score >= ranked[1].score
    assert ranked[0].score > 0


def test_best_per_expiry_one_winner_per_expiry() -> None:
    feb_low = _make_contract(expiry="2024-02-16", strike=102.0, premium=1.0)
    feb_high = _make_contract(expiry="2024-02-16", strike=105.0, premium=4.0)
    mar_only = _make_contract(expiry="2024-03-15", strike=110.0, premium=5.0, dte=56)
    ranked = rank_contracts([feb_low, feb_high, mar_only], price=100.0, otm_only=False)
    winners = best_per_expiry(ranked, price=100.0)
    assert set(winners) == {"2024-02-16", "2024-03-15"}
    assert winners["2024-02-16"].contract.strike == 105.0
    assert winners["2024-03-15"].contract.strike == 110.0


def test_best_per_expiry_ignores_itm() -> None:
    # ITM premium is inflated by intrinsic value — it must never win a group.
    itm = _make_contract(expiry="2024-02-16", strike=90.0, premium=12.0)
    otm = _make_contract(expiry="2024-02-16", strike=105.0, premium=4.0)
    ranked = rank_contracts([itm, otm], price=100.0, otm_only=False)
    winners = best_per_expiry(ranked, price=100.0)
    assert winners["2024-02-16"].contract.strike == 105.0


def test_best_per_expiry_all_itm_expiry_has_no_winner() -> None:
    itm = _make_contract(expiry="2024-02-16", strike=90.0, premium=12.0)
    ranked = rank_contracts([itm], price=100.0, otm_only=False)
    assert best_per_expiry(ranked, price=100.0) == {}


def test_at_the_money_strike_counts_as_otm() -> None:
    atm = _make_contract(expiry="2024-02-16", strike=100.0, premium=3.0)
    ranked = rank_contracts([atm], price=100.0, otm_only=False)
    winners = best_per_expiry(ranked, price=100.0)
    assert winners["2024-02-16"].contract.strike == 100.0
