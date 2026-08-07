from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.bazi import (
    BaziCalculationInput,
    BaziCurrentContextInput,
    calculate_current_context,
)
from app.bazi.engine import _primary_jie_candidates, _sxtwl_jie_events


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "solar_terms_2026_hko.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
TERMS = FIXTURE["terms"]
OFFICIAL_TOLERANCE_SECONDS = FIXTURE["engine_baseline"]["official_minute_tolerance_seconds"]
CROSS_ENGINE_TOLERANCE_SECONDS = FIXTURE["engine_baseline"]["cross_engine_tolerance_seconds"]


def _fixed_chart() -> BaziCalculationInput:
    return BaziCalculationInput(
        local_datetime=datetime(2005, 12, 23, 8, 37),
        iana_timezone="Asia/Shanghai",
        longitude=121.4737,
        gender="male",
        solar_time_mode="civil",
        day_boundary_rule="midnight",
    )


def _context(as_of_utc: datetime):
    return calculate_current_context(
        BaziCurrentContextInput(chart=_fixed_chart(), as_of_utc=as_of_utc)
    )


@pytest.mark.parametrize("case", TERMS, ids=lambda case: case["name_zh"])
def test_all_2026_month_boundaries_match_official_hko_minute(case: dict[str, str]) -> None:
    official = datetime.fromisoformat(case["official_hkt"])
    expected_exact = datetime.fromisoformat(case["engine_boundary_utc"])
    candidates = _primary_jie_candidates(expected_exact)
    primary = min(
        candidates,
        key=lambda item: abs((item.boundary_time_utc - expected_exact).total_seconds()),
    )

    assert primary.name == case["name_zh"]
    assert primary.boundary_time_utc == expected_exact
    assert abs((primary.boundary_time_utc - official).total_seconds()) <= OFFICIAL_TOLERANCE_SECONDS

    verification = min(
        (event_time for name, event_time in _sxtwl_jie_events(2026) if name == case["name_zh"]),
        key=lambda value: abs((value - expected_exact).total_seconds()),
    )
    assert abs((verification - primary.boundary_time_utc).total_seconds()) <= CROSS_ENGINE_TOLERANCE_SECONDS


@pytest.mark.parametrize("case", TERMS, ids=lambda case: case["name_zh"])
def test_every_2026_jie_switches_at_the_frozen_second(case: dict[str, str]) -> None:
    boundary = datetime.fromisoformat(case["engine_boundary_utc"])
    before = _context(boundary - timedelta(seconds=1))
    after = _context(boundary)

    assert before.monthly_cycle.end_boundary.name == case["name_zh"]
    assert before.monthly_cycle.end_boundary.boundary_time_utc == boundary
    assert after.monthly_cycle.start_boundary.name == case["name_zh"]
    assert after.monthly_cycle.start_boundary.boundary_time_utc == boundary
    assert before.monthly_cycle.pillar.value == case["month_pillar_before"]
    assert after.monthly_cycle.pillar.value == case["month_pillar_after"]
    assert before.annual_cycle.pillar.value == case["annual_pillar_before"]
    assert after.annual_cycle.pillar.value == case["annual_pillar_after"]
    assert before.audit.status == after.audit.status == "passed"
