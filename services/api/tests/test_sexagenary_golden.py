from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

from app.bazi import BaziCalculationInput, calculate_chart
from app.bazi.sexagenary import (
    selected_day_pillar,
    sexagenary_day_pillar,
    sexagenary_hour_pillar,
)


FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "sexagenary_days_2026_hko.json").read_text(
        encoding="utf-8"
    )
)


@pytest.mark.parametrize("case", FIXTURE["monthly_day_anchors"])
def test_day_pillar_matches_hko_monthly_almanac(case: dict[str, str]) -> None:
    official_date = date.fromisoformat(case["date"])
    expected = case["pillar"]

    assert sexagenary_day_pillar(official_date) == expected

    result = calculate_chart(
        BaziCalculationInput(
            local_datetime=datetime.combine(official_date, datetime.min.time()).replace(hour=12),
            iana_timezone="Asia/Hong_Kong",
            longitude=114.1694,
            solar_time_mode="civil",
            day_boundary_rule="midnight",
        )
    )
    checks = {check.name: check for check in result.audit.checks}
    assert result.pillars.day.value == expected
    assert checks["day_pillar"].status == "passed"
    assert checks["day_pillar_cycle"].status == "passed"


def test_hour_pillar_matches_hko_day_stem_table() -> None:
    hour_rules = FIXTURE["hour_rules"]
    branches = hour_rules["branches"]
    hours = hour_rules["representative_hours"]

    for row in hour_rules["stem_rows"]:
        matching_date = next(
            date(2026, 1, 1) + timedelta(days=offset)
            for offset in range(10)
            if sexagenary_day_pillar(date(2026, 1, 1) + timedelta(days=offset))[0]
            in row["day_stems"]
        )
        for hour, branch, stem in zip(hours, branches, row["hour_stems"], strict=True):
            selected_time = datetime.combine(matching_date, datetime.min.time()).replace(hour=hour)
            assert sexagenary_hour_pillar(selected_time) == f"{stem}{branch}"


def test_zi_hour_is_continuous_across_civil_midnight() -> None:
    for offset in range(60):
        current_date = date(2026, 1, 1) + timedelta(days=offset)
        at_23 = datetime.combine(current_date, datetime.min.time()).replace(hour=23)
        next_midnight = datetime.combine(
            current_date + timedelta(days=1), datetime.min.time()
        )
        assert sexagenary_hour_pillar(at_23) == sexagenary_hour_pillar(next_midnight)


def test_midnight_and_late_zi_day_rules_are_explicit_at_23() -> None:
    before_zi = datetime(2026, 1, 1, 22, 59, 59)
    at_zi = datetime(2026, 1, 1, 23, 0)
    after_midnight = datetime(2026, 1, 2, 0, 0)

    assert selected_day_pillar(before_zi, "midnight") == "乙亥"
    assert selected_day_pillar(before_zi, "late_zi_next_day") == "乙亥"
    assert selected_day_pillar(at_zi, "midnight") == "乙亥"
    assert selected_day_pillar(at_zi, "late_zi_next_day") == "丙子"
    assert selected_day_pillar(after_midnight, "midnight") == "丙子"
    assert selected_day_pillar(after_midnight, "late_zi_next_day") == "丙子"
    assert sexagenary_hour_pillar(before_zi) == "丁亥"
    assert sexagenary_hour_pillar(at_zi) == "戊子"
    assert sexagenary_hour_pillar(after_midnight) == "戊子"


@pytest.mark.parametrize("day_boundary_rule", ["midnight", "late_zi_next_day"])
def test_runtime_audit_includes_independent_day_and_hour_rules(
    day_boundary_rule: str,
) -> None:
    result = calculate_chart(
        BaziCalculationInput(
            local_datetime=datetime(2026, 1, 1, 23, 30),
            iana_timezone="Asia/Hong_Kong",
            longitude=114.1694,
            solar_time_mode="civil",
            day_boundary_rule=day_boundary_rule,
        )
    )
    checks = {check.name: check for check in result.audit.checks}

    assert checks["day_pillar_cycle"].status == "passed"
    assert checks["hour_pillar_rule"].status == "passed"
    assert result.audit.status == "passed"
