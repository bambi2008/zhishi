from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from importlib.metadata import version
from importlib.resources import files
from math import cos, degrees, radians, sin, tan
from zoneinfo import ZoneInfo

from .models import SolarTimeMode


TIMEZONE_DATABASE_VERSION = f"tzdata@{version('tzdata')}"


class TimeNormalizationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class NormalizedTimeValues:
    civil: datetime
    utc: datetime
    mean_solar: datetime
    apparent_solar: datetime
    selected: datetime
    utc_offset_minutes: int
    longitude_offset_from_utc_minutes: float
    mean_solar_correction_minutes: float
    equation_of_time_minutes: float
    total_apparent_correction_minutes: float


def _round_trip_is_valid(local_naive: datetime, aware: datetime, zone: ZoneInfo) -> bool:
    round_trip = aware.astimezone(UTC).astimezone(zone)
    return round_trip.replace(tzinfo=None) == local_naive


@lru_cache(maxsize=256)
def load_timezone(timezone_name: str) -> ZoneInfo:
    """Load an IANA zone only from the pinned first-party tzdata package."""
    parts = timezone_name.split("/")
    if (
        not timezone_name
        or timezone_name.startswith("/")
        or "\\" in timezone_name
        or any(not part or part in {".", ".."} for part in parts)
    ):
        raise TimeNormalizationError("timezone_not_found", f"未知 IANA 时区：{timezone_name}")

    try:
        resource = files("tzdata.zoneinfo").joinpath(*parts)
        with resource.open("rb") as zone_file:
            return ZoneInfo.from_file(zone_file, key=timezone_name)
    except (FileNotFoundError, IsADirectoryError, OSError, ValueError) as exc:
        raise TimeNormalizationError("timezone_not_found", f"未知 IANA 时区：{timezone_name}") from exc


def localize_wall_time(local_naive: datetime, timezone_name: str, dst_fold: int | None) -> datetime:
    zone = load_timezone(timezone_name)

    fold_zero = local_naive.replace(tzinfo=zone, fold=0)
    fold_one = local_naive.replace(tzinfo=zone, fold=1)
    valid_zero = _round_trip_is_valid(local_naive, fold_zero, zone)
    valid_one = _round_trip_is_valid(local_naive, fold_one, zone)

    if not valid_zero and not valid_one:
        raise TimeNormalizationError(
            "nonexistent_local_time",
            "该出生地钟表时间位于夏令时跳时区间，现实中不存在，请核对出生记录",
        )

    is_ambiguous = valid_zero and valid_one and fold_zero.utcoffset() != fold_one.utcoffset()
    if is_ambiguous and dst_fold is None:
        raise TimeNormalizationError(
            "ambiguous_local_time",
            "该出生地钟表时间因夏令时结束出现两次，请指定 dst_fold 为 0 或 1",
        )

    if is_ambiguous:
        return fold_zero if dst_fold == 0 else fold_one
    return fold_zero if valid_zero else fold_one


def julian_day(utc_time: datetime) -> float:
    if utc_time.tzinfo is None or utc_time.utcoffset() is None:
        raise ValueError("equation-of-time input must be timezone-aware")
    normalized_utc = utc_time.astimezone(UTC)
    return normalized_utc.timestamp() / 86400.0 + 2440587.5


def equation_of_time_minutes(utc_time: datetime) -> float:
    """NOAA/Meeus equation of time calculation, returned in clock minutes."""
    centuries = (julian_day(utc_time) - 2451545.0) / 36525.0
    geom_mean_longitude = (280.46646 + centuries * (36000.76983 + centuries * 0.0003032)) % 360
    geom_mean_anomaly = 357.52911 + centuries * (35999.05029 - 0.0001537 * centuries)
    eccentricity = 0.016708634 - centuries * (0.000042037 + 0.0000001267 * centuries)

    seconds = 21.448 - centuries * (46.815 + centuries * (0.00059 - centuries * 0.001813))
    mean_obliquity = 23.0 + (26.0 + seconds / 60.0) / 60.0
    corrected_obliquity = mean_obliquity + 0.00256 * cos(radians(125.04 - 1934.136 * centuries))
    y = tan(radians(corrected_obliquity) / 2.0) ** 2

    longitude_radians = radians(geom_mean_longitude)
    anomaly_radians = radians(geom_mean_anomaly)
    equation = (
        y * sin(2.0 * longitude_radians)
        - 2.0 * eccentricity * sin(anomaly_radians)
        + 4.0 * eccentricity * y * sin(anomaly_radians) * cos(2.0 * longitude_radians)
        - 0.5 * y * y * sin(4.0 * longitude_radians)
        - 1.25 * eccentricity * eccentricity * sin(2.0 * anomaly_radians)
    )
    return 4.0 * degrees(equation)


def normalize_birth_time(
    local_naive: datetime,
    timezone_name: str,
    longitude: float,
    mode: SolarTimeMode,
    dst_fold: int | None,
) -> NormalizedTimeValues:
    civil = localize_wall_time(local_naive, timezone_name, dst_fold)
    utc_time = civil.astimezone(UTC)
    equation_minutes = equation_of_time_minutes(utc_time)
    longitude_minutes = longitude * 4.0
    utc_naive = utc_time.replace(tzinfo=None)
    mean_solar = utc_naive + timedelta(minutes=longitude_minutes)
    apparent_solar = mean_solar + timedelta(minutes=equation_minutes)

    selected = {
        "civil": local_naive,
        "mean_solar": mean_solar,
        "apparent_solar": apparent_solar,
    }[mode]
    utc_offset = int(civil.utcoffset().total_seconds() / 60) if civil.utcoffset() else 0
    mean_correction = (mean_solar - local_naive).total_seconds() / 60.0
    total_correction = (apparent_solar - local_naive).total_seconds() / 60.0
    return NormalizedTimeValues(
        civil=civil,
        utc=utc_time,
        mean_solar=mean_solar,
        apparent_solar=apparent_solar,
        selected=selected,
        utc_offset_minutes=utc_offset,
        longitude_offset_from_utc_minutes=longitude_minutes,
        mean_solar_correction_minutes=mean_correction,
        equation_of_time_minutes=equation_minutes,
        total_apparent_correction_minutes=total_correction,
    )
