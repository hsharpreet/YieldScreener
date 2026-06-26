import pytest

from app.options.math import CoveredCallMetrics, covered_call_metrics


def test_golden_otm() -> None:
    """Golden test: OTM covered call — price=100, premium=4, strike=105, dte=28."""
    m: CoveredCallMetrics = covered_call_metrics(
        price=100.0, strike=105.0, premium=4.0, dte=28
    )

    assert m.net_credit == pytest.approx(400.0, rel=1e-4)
    assert m.static_yield == pytest.approx(0.04, rel=1e-4)
    assert m.annualized_static == pytest.approx(0.04 * (365 / 28), rel=1e-4)
    assert m.downside_cushion == pytest.approx(0.04, rel=1e-4)
    assert m.breakeven == pytest.approx(96.0, rel=1e-4)
    assert m.if_called_profit == pytest.approx(900.0, rel=1e-4)
    assert m.if_called_return == pytest.approx(0.09, rel=1e-4)
    assert m.annualized_if_called == pytest.approx(0.09 * (365 / 28), rel=1e-4)


def test_golden_itm_edge_case() -> None:
    """ITM edge case: strike below price — sign must be handled correctly."""
    m: CoveredCallMetrics = covered_call_metrics(
        price=100.0, strike=95.0, premium=7.0, dte=28
    )

    assert m.if_called_profit == pytest.approx(200.0, rel=1e-4)
    assert m.if_called_return == pytest.approx(0.02, rel=1e-4)


def test_net_credit_scales_with_shares() -> None:
    """Net credit is always premium * 100 (one standard lot)."""
    m = covered_call_metrics(price=50.0, strike=55.0, premium=1.5, dte=30)
    assert m.net_credit == pytest.approx(150.0, rel=1e-4)


def test_breakeven_equals_price_minus_premium() -> None:
    m = covered_call_metrics(price=200.0, strike=210.0, premium=3.0, dte=35)
    assert m.breakeven == pytest.approx(197.0, rel=1e-4)


def test_downside_cushion_equals_static_yield() -> None:
    """Downside cushion and static yield share the same formula."""
    m = covered_call_metrics(price=150.0, strike=160.0, premium=6.0, dte=21)
    assert m.downside_cushion == pytest.approx(m.static_yield, rel=1e-9)


def test_invalid_dte_raises() -> None:
    with pytest.raises(ValueError, match="dte must be a positive integer"):
        covered_call_metrics(price=100.0, strike=105.0, premium=4.0, dte=0)


def test_invalid_price_raises() -> None:
    with pytest.raises(ValueError, match="price must be positive"):
        covered_call_metrics(price=0.0, strike=105.0, premium=4.0, dte=28)


def test_negative_premium_raises() -> None:
    with pytest.raises(ValueError, match="premium cannot be negative"):
        covered_call_metrics(price=100.0, strike=105.0, premium=-1.0, dte=28)


def test_annualized_static_approx_52_percent() -> None:
    """Cross-check the golden-test annualized static figure narrated in CLAUDE.md §6."""
    m = covered_call_metrics(price=100.0, strike=105.0, premium=4.0, dte=28)
    assert m.annualized_static == pytest.approx(0.5214285, rel=1e-4)


def test_annualized_if_called_approx_117_percent() -> None:
    """Cross-check the golden-test annualized if-called figure narrated in CLAUDE.md §6."""
    m = covered_call_metrics(price=100.0, strike=105.0, premium=4.0, dte=28)
    assert m.annualized_if_called == pytest.approx(1.1732142, rel=1e-4)
