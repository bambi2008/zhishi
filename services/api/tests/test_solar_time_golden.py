from __future__ import annotations

import json
from datetime import UTC, datetime
from math import cos, pi, sin
from pathlib import Path

import pytest

from app.bazi import BaziCalculationInput, calculate_chart
from app.bazi.solar_time import equation_of_time_minutes, normalize_birth_time


FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "solar_time_2026_noaa.json").read_text(encoding="utf-8")
)


def _noaa_fractional_year_estimate(instant: datetime) -> float:
    """Independent low-order equation published in NOAA's solar equations PDF."""
    normalized = instant.astimezone(UTC)
    year = normalized.year
    days_in_year = 366 if year % 400 == 0 or (year % 4 == 0 and year % 100 != 0) else 365
    day_of_year = normalized.timetuple().tm_yday
    fractional_hour = (
        normalized.hour + normalized.minute / 60.0 + normalized.second / 3600.0
    )
    gamma = 2.0 * pi / days_in_year * (
        day_of_year - 1 + (fractional_hour - 12.0) / 24.0
    )
    return 229.18 * (
        0.000075
        + 0.001868 * cos(gamma)
        - 0.032077 * sin(gamma)
        - 0.014615 * cos(2.0 * gamma)
        - 0.040849 * sin(2.0 * gamma)
    )


@pytest.mark.parametrize("case", FIXTURE["calculator_cases"])
def test_equation_of_time_matches_noaa_online_calculator(case: dict[str, object]) -> None:
    instant = datetime.fromisoformat(str(case["instant_utc"]))
    official_display_value = float(case["equation_of_time_minutes"])

    assert equation_of_time_minutes(instant) == pytest.approx(
        official_display_value,
        abs=0.005,
    )


def test_equation_of_time_tracks_independent_noaa_formula_across_supported_years() -> None:
    maximum_difference = 0.0
    for year in range(1900, 2101):
        for month in range(1, 13):
            instant = datetime(year, month, 15, 12, tzinfo=UTC)
            maximum_difference = max(
                maximum_difference,
                abs(
                    equation_of_time_minutes(instant)
                    - _noaa_fractional_year_estimate(instant)
                ),
            )

    # NOAA labels the fractional-year expression an estimate. A daily six-hour
    # sweep over 1900-2100 found a 1.044-minute maximum against the Meeus path.
    assert maximum_difference <= 1.1


@pytest.mark.parametrize(
    ("local_time", "timezone_name", "longitude", "expected_offset"),
    [
        (datetime(2005, 12, 23, 8, 37), "Asia/Shanghai", 121.4737, 480),
        # China observed daylight saving time on this historical date.
        (datetime(1990, 6, 15, 12, 0), "Asia/Shanghai", 87.6168, 540),
        (datetime(2024, 7, 1, 12, 0), "America/New_York", -74.006, -240),
        (datetime(2024, 7, 1, 12, 0), "Europe/London", -0.1276, 60),
        (datetime(2024, 1, 15, 12, 0), "Asia/Kathmandu", 85.324, 345),
    ],
)
def test_longitude_timezone_and_equation_corrections_are_separate(
    local_time: datetime,
    timezone_name: str,
    longitude: float,
    expected_offset: int,
) -> None:
    result = normalize_birth_time(
        local_time,
        timezone_name,
        longitude,
        "apparent_solar",
        None,
    )
    expected_mean_correction = longitude * 4.0 - expected_offset

    assert result.utc_offset_minutes == expected_offset
    assert result.longitude_offset_from_utc_minutes == pytest.approx(longitude * 4.0)
    assert result.mean_solar_correction_minutes == pytest.approx(expected_mean_correction)
    assert result.total_apparent_correction_minutes == pytest.approx(
        expected_mean_correction + result.equation_of_time_minutes
    )
    assert result.selected == result.apparent_solar


def test_true_solar_time_remains_continuous_across_dst_fall_back() -> None:
    first = normalize_birth_time(
        datetime(2024, 11, 3, 1, 59),
        "America/New_York",
        -74.006,
        "apparent_solar",
        0,
    )
    second = normalize_birth_time(
        datetime(2024, 11, 3, 1, 0),
        "America/New_York",
        -74.006,
        "apparent_solar",
        1,
    )

    assert (second.utc - first.utc).total_seconds() == 60
    assert (second.mean_solar - first.mean_solar).total_seconds() == 60
    assert (second.apparent_solar - first.apparent_solar).total_seconds() == pytest.approx(
        60,
        abs=0.1,
    )
    assert (first.utc_offset_minutes, second.utc_offset_minutes) == (-240, -300)
    assert second.mean_solar_correction_minutes - first.mean_solar_correction_minutes == 60


def test_equation_of_time_rejects_host_dependent_naive_datetime() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        equation_of_time_minutes(datetime(2026, 2, 11, 12, 0))


def test_solar_mode_changes_day_and_hour_only_when_explicitly_selected() -> None:
    common = {
        "local_datetime": datetime(1990, 6, 15, 0, 10),
        "iana_timezone": "Asia/Shanghai",
        "longitude": 87.6168,
        "day_boundary_rule": "midnight",
    }
    civil = calculate_chart(BaziCalculationInput(**common, solar_time_mode="civil"))
    mean = calculate_chart(BaziCalculationInput(**common, solar_time_mode="mean_solar"))
    apparent = calculate_chart(BaziCalculationInput(**common, solar_time_mode="apparent_solar"))

    assert civil.normalized_times.selected_time == common["local_datetime"]
    assert mean.normalized_times.selected_time == mean.normalized_times.mean_solar_time
    assert apparent.normalized_times.selected_time == apparent.normalized_times.apparent_solar_time
    assert {
        civil.pillars.year.value,
        mean.pillars.year.value,
        apparent.pillars.year.value,
    } == {"庚午"}
    assert {
        civil.pillars.month.value,
        mean.pillars.month.value,
        apparent.pillars.month.value,
    } == {"壬午"}
    assert (civil.pillars.day.value, civil.pillars.hour.value) == ("辛亥", "戊子")
    assert (mean.pillars.day.value, mean.pillars.hour.value) == ("庚戌", "丁亥")
    assert (apparent.pillars.day.value, apparent.pillars.hour.value) == ("庚戌", "丁亥")
    assert civil.audit.status == mean.audit.status == apparent.audit.status == "passed"
