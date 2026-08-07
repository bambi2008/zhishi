from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from zoneinfo import ZoneInfo

from app.bazi import (
    BaziCalculationInput,
    BaziCurrentContextInput,
    calculate_chart,
    calculate_current_context,
)
from app.bazi.solar_time import (
    TIMEZONE_DATABASE_VERSION,
    TimeNormalizationError,
    load_timezone,
    normalize_birth_time,
)


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
    assert result.rule_profile.timezone_database == "tzdata@2026.3"


def test_timezone_loader_is_pinned_and_cached_across_platforms() -> None:
    first = load_timezone("America/New_York")
    second = load_timezone("America/New_York")

    assert first is second
    assert first.key == "America/New_York"
    assert TIMEZONE_DATABASE_VERSION == "tzdata@2026.3"


@pytest.mark.parametrize("timezone_name", ["../UTC", "America//New_York", "C:\\Windows"])
def test_timezone_loader_rejects_non_iana_paths(timezone_name: str) -> None:
    with pytest.raises(TimeNormalizationError) as exc:
        load_timezone(timezone_name)
    assert exc.value.code == "timezone_not_found"


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


@pytest.mark.parametrize(
    ("timezone_name", "longitude", "wall_time"),
    [
        ("America/New_York", -74.006, datetime(2024, 3, 10, 2, 30)),
        ("Europe/London", -0.1276, datetime(2024, 3, 31, 1, 30)),
        ("Australia/Sydney", 151.2093, datetime(2024, 10, 6, 2, 30)),
    ],
)
def test_nonexistent_dst_time_is_rejected(
    timezone_name: str, longitude: float, wall_time: datetime
) -> None:
    with pytest.raises(TimeNormalizationError) as exc:
        normalize_birth_time(
            wall_time,
            timezone_name,
            longitude,
            "civil",
            None,
        )
    assert exc.value.code == "nonexistent_local_time"


@pytest.mark.parametrize(
    ("timezone_name", "longitude", "wall_time"),
    [
        ("America/New_York", -74.006, datetime(2024, 11, 3, 1, 30)),
        ("Europe/London", -0.1276, datetime(2024, 10, 27, 1, 30)),
        ("Australia/Sydney", 151.2093, datetime(2024, 4, 7, 2, 30)),
    ],
)
def test_ambiguous_dst_time_requires_fold(
    timezone_name: str, longitude: float, wall_time: datetime
) -> None:
    with pytest.raises(TimeNormalizationError) as exc:
        normalize_birth_time(
            wall_time,
            timezone_name,
            longitude,
            "civil",
            None,
        )
    assert exc.value.code == "ambiguous_local_time"

    first = normalize_birth_time(
        wall_time, timezone_name, longitude, "civil", 0
    )
    second = normalize_birth_time(
        wall_time, timezone_name, longitude, "civil", 1
    )
    assert (second.utc - first.utc).total_seconds() == 3600


@pytest.mark.parametrize(
    ("timezone_name", "longitude", "wall_time"),
    [
        ("America/New_York", -74.006, datetime(2024, 3, 10, 3, 0)),
        ("Europe/London", -0.1276, datetime(2024, 3, 31, 2, 0)),
        ("Australia/Sydney", 151.2093, datetime(2024, 10, 6, 3, 0)),
    ],
)
def test_uncertain_interval_touching_dst_remains_visible_with_warning(
    timezone_name: str, longitude: float, wall_time: datetime
) -> None:
    result = calculate(
        local_datetime=wall_time,
        iana_timezone=timezone_name,
        longitude=longitude,
        gender="male",
        time_accuracy="approximate",
        uncertainty_minutes=60,
    )

    assert result.status == "ambiguous"
    assert result.user_visible is True
    assert result.boundary.risk == "ambiguous"
    assert any("夏令时" in note and "正常计算" in note for note in result.boundary.notes)
    assert result.audit.status == "passed"
    assert result.luck_cycles is not None
    assert result.luck_cycles.user_visible is True


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


def current_context(as_of_utc: datetime):
    chart = BaziCalculationInput(
        local_datetime=datetime(2005, 12, 23, 8, 37),
        iana_timezone="Asia/Shanghai",
        longitude=121.4737,
        gender="male",
        solar_time_mode="civil",
        day_boundary_rule="midnight",
    )
    return calculate_current_context(BaziCurrentContextInput(chart=chart, as_of_utc=as_of_utc))


def test_current_context_locates_active_luck_and_annual_cycle() -> None:
    result = current_context(datetime(2026, 8, 7, tzinfo=UTC))

    assert result.status == "ok"
    assert result.user_visible is True
    assert result.current_luck.status == "active"
    assert result.current_luck.current_period is not None
    assert result.current_luck.current_period.index == 2
    assert result.current_luck.current_period.pillar.value == "丙戌"
    assert result.current_luck.next_period is not None
    assert result.current_luck.next_period.pillar.value == "乙酉"
    assert result.current_luck.next_transition_local == datetime(2031, 4, 23, 18, 37)
    assert result.annual_cycle.label_year == 2026
    assert result.annual_cycle.pillar.value == "丙午"
    assert result.monthly_cycle.sequence_from_lichun == 6
    assert result.monthly_cycle.pillar.value == "乙未"
    assert result.monthly_cycle.start_boundary.name == "小暑"
    assert result.monthly_cycle.end_boundary.name == "立秋"
    assert result.audit.status == "passed"


def test_annual_cycle_switches_at_exact_lichun_instant() -> None:
    boundary = datetime(2026, 2, 3, 20, 2, 8, tzinfo=UTC)
    before = current_context(boundary - timedelta(seconds=1))
    after = current_context(boundary)

    assert (before.annual_cycle.label_year, before.annual_cycle.pillar.value) == (2025, "乙巳")
    assert (after.annual_cycle.label_year, after.annual_cycle.pillar.value) == (2026, "丙午")
    assert before.annual_cycle.end_boundary.boundary_time_utc == boundary
    assert after.annual_cycle.start_boundary.boundary_time_utc == boundary


def test_current_luck_switches_at_exclusive_period_boundary() -> None:
    transition_local = datetime(2021, 4, 23, 18, 37)
    transition_utc = transition_local.replace(tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(UTC)
    before = current_context(transition_utc - timedelta(seconds=1))
    after = current_context(transition_utc)

    assert before.current_luck.current_period is not None
    assert after.current_luck.current_period is not None
    assert before.current_luck.current_period.pillar.value == "丁亥"
    assert after.current_luck.current_period.pillar.value == "丙戌"


def test_monthly_cycle_switches_at_exact_jie_instant() -> None:
    boundary = datetime(2026, 8, 7, 11, 42, 43, tzinfo=UTC)
    before = current_context(boundary - timedelta(seconds=1))
    after = current_context(boundary)

    assert before.monthly_cycle.pillar.value == "乙未"
    assert before.monthly_cycle.end_boundary.name == "立秋"
    assert before.monthly_cycle.end_boundary.boundary_time_utc == boundary
    assert after.monthly_cycle.pillar.value == "丙申"
    assert after.monthly_cycle.start_boundary.name == "立秋"
    assert after.monthly_cycle.start_boundary.boundary_time_utc == boundary
    assert before.audit.status == after.audit.status == "passed"


def test_current_context_reports_pre_luck_state() -> None:
    result = current_context(datetime(2010, 1, 1, tzinfo=UTC))

    assert result.current_luck.status == "pre_luck"
    assert result.current_luck.current_period is None
    assert result.current_luck.next_period is not None
    assert result.current_luck.next_period.pillar.value == "丁亥"
    assert result.current_luck.next_transition_local == datetime(2011, 4, 23, 18, 37)


def test_current_context_requires_aware_as_of_time() -> None:
    chart = BaziCalculationInput(
        local_datetime=datetime(2005, 12, 23, 8, 37),
        iana_timezone="Asia/Shanghai",
        longitude=121.4737,
        gender="male",
        solar_time_mode="civil",
        day_boundary_rule="midnight",
    )
    with pytest.raises(ValueError, match="as_of_utc"):
        BaziCurrentContextInput(chart=chart, as_of_utc=datetime(2026, 8, 7))


def test_uncertain_birth_time_keeps_normal_luck_and_current_cycle_visible() -> None:
    chart_input = BaziCalculationInput(
        local_datetime=datetime(2005, 12, 23, 8, 37),
        iana_timezone="Asia/Shanghai",
        longitude=121.4737,
        gender="male",
        time_accuracy="approximate",
        solar_time_mode="civil",
        day_boundary_rule="midnight",
    )
    chart = calculate_chart(chart_input)
    context = calculate_current_context(
        BaziCurrentContextInput(chart=chart_input, as_of_utc=datetime(2026, 8, 7, tzinfo=UTC))
    )

    assert chart.status == "ambiguous"
    assert chart.user_visible is True
    assert chart.alternatives
    assert chart.luck_cycles is not None
    assert chart.luck_cycles.status == "ok"
    assert chart.luck_cycles.user_visible is True
    assert context.status == "ok"
    assert context.user_visible is True
