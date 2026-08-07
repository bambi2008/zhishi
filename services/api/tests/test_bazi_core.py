from __future__ import annotations

from datetime import datetime

import pytest

from app.bazi import BaziCalculationInput, calculate_chart
from app.bazi.solar_time import TimeNormalizationError, normalize_birth_time


def calculate(**overrides):
    data = {
        "local_datetime": datetime(2005, 12, 23, 8, 37),
        "iana_timezone": "Asia/Shanghai",
        "longitude": 121.4737,
        "solar_time_mode": "civil",
        "day_boundary_rule": "midnight",
    }
    data.update(overrides)
    return calculate_chart(BaziCalculationInput(**data))


def pillar_values(result) -> tuple[str, str, str, str]:
    return (
        result.pillars.year.value,
        result.pillars.month.value,
        result.pillars.day.value,
        result.pillars.hour.value,
    )


def test_known_four_pillar_vector_passes_dual_engine_audit() -> None:
    result = calculate()
    assert pillar_values(result) == ("乙酉", "戊子", "辛巳", "壬辰")
    assert result.status == "ok"
    assert result.audit.status == "passed"
    assert result.user_visible is True


def test_exact_lichun_boundary_uses_handoff_time_not_calendar_day() -> None:
    before = calculate(local_datetime=datetime(2024, 2, 4, 8, 0))
    after = calculate(local_datetime=datetime(2024, 2, 4, 18, 0))

    assert (before.pillars.year.value, before.pillars.month.value) == ("癸卯", "乙丑")
    assert (after.pillars.year.value, after.pillars.month.value) == ("甲辰", "丙寅")
    assert before.audit.status == "passed"
    assert after.audit.status == "passed"


def test_overseas_birth_uses_absolute_instant_for_year_and_month() -> None:
    result = calculate(
        local_datetime=datetime(2024, 2, 4, 4, 0),
        iana_timezone="America/New_York",
        longitude=-74.006,
    )
    assert (result.pillars.year.value, result.pillars.month.value) == ("甲辰", "丙寅")


def test_apparent_solar_time_exposes_full_correction() -> None:
    result = calculate(
        local_datetime=datetime(1990, 6, 15, 12, 0),
        longitude=87.6168,
        solar_time_mode="apparent_solar",
    )
    assert result.normalized_times.total_apparent_correction_minutes < -100
    assert result.normalized_times.selected_time == result.normalized_times.apparent_solar_time


def test_late_zi_rule_is_explicit_and_changes_only_when_selected() -> None:
    midnight = calculate(local_datetime=datetime(1988, 2, 15, 23, 30), day_boundary_rule="midnight")
    late_zi = calculate(
        local_datetime=datetime(1988, 2, 15, 23, 30),
        day_boundary_rule="late_zi_next_day",
    )
    assert midnight.pillars.day.value == "庚子"
    assert late_zi.pillars.day.value == "辛丑"
    assert midnight.pillars.hour.value == late_zi.pillars.hour.value == "戊子"


def test_nonexistent_dst_time_is_rejected() -> None:
    with pytest.raises(TimeNormalizationError) as exc:
        normalize_birth_time(
            datetime(2024, 3, 10, 2, 30),
            "America/New_York",
            -74.006,
            "civil",
            None,
        )
    assert exc.value.code == "nonexistent_local_time"


def test_ambiguous_dst_time_requires_fold() -> None:
    with pytest.raises(TimeNormalizationError) as exc:
        normalize_birth_time(
            datetime(2024, 11, 3, 1, 30),
            "America/New_York",
            -74.006,
            "civil",
            None,
        )
    assert exc.value.code == "ambiguous_local_time"

    first = normalize_birth_time(
        datetime(2024, 11, 3, 1, 30), "America/New_York", -74.006, "civil", 0
    )
    second = normalize_birth_time(
        datetime(2024, 11, 3, 1, 30), "America/New_York", -74.006, "civil", 1
    )
    assert (second.utc - first.utc).total_seconds() == 3600


def test_calculation_hash_is_deterministic() -> None:
    assert calculate().calculation_hash == calculate().calculation_hash


def test_precise_luck_start_matches_upstream_vector() -> None:
    result = calculate(
        local_datetime=datetime(2022, 3, 9, 20, 51),
        gender="male",
        luck_start_rule="precise_minutes",
    )
    luck = result.luck_cycles
    assert luck is not None
    assert luck.direction == "forward"
    assert (luck.start_age.years, luck.start_age.months, luck.start_age.days, luck.start_age.hours) == (8, 9, 2, 10)
    assert luck.start_at_local == datetime(2030, 12, 12, 6, 51)
    assert [item.pillar.value for item in luck.periods[:5]] == ["甲辰", "乙巳", "丙午", "丁未", "戊申"]
    assert luck.audit.status == "passed"


def test_traditional_segment_luck_start_matches_upstream_vector() -> None:
    result = calculate(
        local_datetime=datetime(1981, 1, 29, 23, 37),
        gender="female",
        luck_start_rule="traditional_segments",
    )
    luck = result.luck_cycles
    assert luck is not None
    assert luck.direction == "reverse"
    assert (luck.start_age.years, luck.start_age.months, luck.start_age.days, luck.start_age.hours) == (8, 0, 20, 0)
    assert luck.start_at_local == datetime(1989, 2, 18, 23, 37)
    assert [item.pillar.value for item in luck.periods[:5]] == ["戊子", "丁亥", "丙戌", "乙酉", "甲申"]


def test_luck_direction_changes_explicitly_with_traditional_gender_rule() -> None:
    male = calculate(gender="male").luck_cycles
    female = calculate(gender="female").luck_cycles
    assert male is not None and female is not None
    assert male.direction == "reverse"
    assert female.direction == "forward"
    assert male.periods[0].pillar.value == "丁亥"
    assert female.periods[0].pillar.value == "己丑"


def test_luck_age_uses_absolute_instant_for_overseas_birth() -> None:
    shanghai = calculate(
        local_datetime=datetime(2024, 2, 4, 17, 0),
        gender="male",
    ).luck_cycles
    new_york = calculate(
        local_datetime=datetime(2024, 2, 4, 4, 0),
        iana_timezone="America/New_York",
        longitude=-74.006,
        gender="male",
    ).luck_cycles
    assert shanghai is not None and new_york is not None
    assert shanghai.start_age == new_york.start_age
    assert shanghai.start_boundary.boundary_time_utc == new_york.start_boundary.boundary_time_utc
