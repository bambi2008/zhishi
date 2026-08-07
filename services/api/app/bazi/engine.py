from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta, timezone
from functools import lru_cache

import sxtwl
from lunar_python import Solar
from lunar_python.util import LunarUtil

from .luck import calculate_luck_cycles
from .models import (
    AlternativeChart,
    AuditCheck,
    AuditReport,
    BaziCalculationInput,
    BaziCalculationResult,
    BoundaryCandidate,
    BoundaryReport,
    FourPillars,
    NormalizedTimes,
    PillarDetails,
    RuleProfile,
)
from .solar_time import (
    TIMEZONE_DATABASE_VERSION,
    NormalizedTimeValues,
    TimeNormalizationError,
    normalize_birth_time,
)


PRIMARY_ENGINE_VERSION = "lunar_python@1.4.8"
VERIFICATION_ENGINE_VERSION = "sxtwl@2.0.7"
BEIJING_STANDARD_TIME = timezone(timedelta(hours=8), name="UTC+08:00")
GAN = tuple("甲乙丙丁戊己庚辛壬癸")
ZHI = tuple("子丑寅卯辰巳午未申酉戌亥")
JIE_QI_NAMES = (
    "冬至",
    "小寒",
    "大寒",
    "立春",
    "雨水",
    "惊蛰",
    "春分",
    "清明",
    "谷雨",
    "立夏",
    "小满",
    "芒种",
    "夏至",
    "小暑",
    "大暑",
    "立秋",
    "处暑",
    "白露",
    "秋分",
    "寒露",
    "霜降",
    "立冬",
    "小雪",
    "大雪",
)


def _solar_from_datetime(value: datetime):
    return Solar.fromYmdHms(value.year, value.month, value.day, value.hour, value.minute, value.second)


def _solar_to_datetime(value) -> datetime:
    return datetime(
        value.getYear(),
        value.getMonth(),
        value.getDay(),
        value.getHour(),
        value.getMinute(),
        value.getSecond(),
    )


def _sxtwl_gan_zhi(value) -> str:
    return f"{GAN[value.tg]}{ZHI[value.dz]}"


def _pillar_values(utc_time: datetime, selected_time: datetime, day_boundary_rule: str) -> dict[str, str]:
    # lunar_python publishes solar-term clock values in UTC+08:00. Year and month
    # therefore use the same absolute instant expressed on that reference clock.
    reference_time = utc_time.astimezone(BEIJING_STANDARD_TIME).replace(tzinfo=None)
    boundary_eight_char = _solar_from_datetime(reference_time).getLunar().getEightChar()
    local_eight_char = _solar_from_datetime(selected_time).getLunar().getEightChar()
    local_eight_char.setSect(1 if day_boundary_rule == "late_zi_next_day" else 2)
    return {
        "year": boundary_eight_char.getYear(),
        "month": boundary_eight_char.getMonth(),
        "day": local_eight_char.getDay(),
        "hour": local_eight_char.getTime(),
    }


def _pillar_details(value: str, day_master: str, is_day: bool = False) -> PillarDetails:
    stem, branch = value[0], value[1]
    hidden_stems = list(LunarUtil.ZHI_HIDE_GAN[branch])
    return PillarDetails(
        value=value,
        stem=stem,
        branch=branch,
        stem_element=LunarUtil.WU_XING_GAN[stem],
        branch_element=LunarUtil.WU_XING_ZHI[branch],
        hidden_stems=hidden_stems,
        stem_ten_god="日主" if is_day else LunarUtil.SHI_SHEN[f"{day_master}{stem}"],
        hidden_stem_ten_gods=[LunarUtil.SHI_SHEN[f"{day_master}{item}"] for item in hidden_stems],
        na_yin=LunarUtil.NAYIN[value],
    )


def _four_pillars(values: dict[str, str]) -> FourPillars:
    day_master = values["day"][0]
    return FourPillars(
        year=_pillar_details(values["year"], day_master),
        month=_pillar_details(values["month"], day_master),
        day=_pillar_details(values["day"], day_master, is_day=True),
        hour=_pillar_details(values["hour"], day_master),
        day_master=day_master,
    )


def _primary_jie_candidates(utc_time: datetime) -> tuple[BoundaryCandidate, BoundaryCandidate]:
    reference_time = utc_time.astimezone(BEIJING_STANDARD_TIME).replace(tzinfo=None)
    lunar = _solar_from_datetime(reference_time).getLunar()
    result: list[BoundaryCandidate] = []
    for jie in (lunar.getPrevJie(), lunar.getNextJie()):
        boundary_reference = _solar_to_datetime(jie.getSolar()).replace(tzinfo=BEIJING_STANDARD_TIME)
        boundary_utc = boundary_reference.astimezone(UTC)
        result.append(
            BoundaryCandidate(
                name=jie.getName(),
                boundary_time_utc=boundary_utc,
                distance_seconds=round((boundary_utc - utc_time).total_seconds()),
                source=PRIMARY_ENGINE_VERSION,
            )
        )
    return result[0], result[1]


@lru_cache(maxsize=256)
def _sxtwl_jie_events(center_year: int) -> tuple[tuple[str, datetime], ...]:
    events: dict[tuple[str, datetime], None] = {}
    for year in range(center_year - 1, center_year + 2):
        for event in sxtwl.getJieQiByYear(year):
            if event.jqIndex % 2 != 1:
                continue
            value = sxtwl.JD2DD(event.jd)
            whole_seconds = int(round(float(value.s)))
            reference = datetime(int(value.Y), int(value.M), int(value.D), int(value.h), int(value.m))
            reference += timedelta(seconds=whole_seconds)
            utc_value = reference.replace(tzinfo=BEIJING_STANDARD_TIME).astimezone(UTC)
            events[(JIE_QI_NAMES[event.jqIndex], utc_value)] = None
    return tuple(events)


def _build_audit(
    utc_time: datetime,
    selected_time: datetime,
    values: dict[str, str],
    day_boundary_rule: str,
    nearest_jie: BoundaryCandidate,
) -> AuditReport:
    checks: list[AuditCheck] = []
    matching_events = [event for event in _sxtwl_jie_events(utc_time.year) if event[0] == nearest_jie.name]
    if matching_events:
        verification_name, verification_time = min(
            matching_events,
            key=lambda item: abs((item[1] - nearest_jie.boundary_time_utc).total_seconds()),
        )
        difference = abs((verification_time - nearest_jie.boundary_time_utc).total_seconds())
        checks.append(
            AuditCheck(
                name="nearest_jie_time",
                status="passed" if difference <= 90 else "failed",
                primary_value=f"{nearest_jie.name} {nearest_jie.boundary_time_utc.isoformat()}",
                verification_value=f"{verification_name} {verification_time.isoformat()}",
                difference_seconds=round(difference, 3),
                detail="两个独立历法引擎的节气交接时刻允许最大差异为 90 秒",
            )
        )
    else:
        checks.append(AuditCheck(name="nearest_jie_time", status="failed", detail="校验引擎未找到对应节气"))

    selected_day = selected_time
    if day_boundary_rule == "late_zi_next_day" and selected_time.hour == 23:
        selected_day += timedelta(days=1)
    day_object = sxtwl.fromSolar(selected_day.year, selected_day.month, selected_day.day)
    verification_day = _sxtwl_gan_zhi(day_object.getDayGZ())
    checks.append(
        AuditCheck(
            name="day_pillar",
            status="passed" if verification_day == values["day"] else "failed",
            primary_value=values["day"],
            verification_value=verification_day,
        )
    )

    hour_day_object = sxtwl.fromSolar(selected_time.year, selected_time.month, selected_time.day)
    verification_hour = _sxtwl_gan_zhi(hour_day_object.getHourGZ(selected_time.hour))
    checks.append(
        AuditCheck(
            name="hour_pillar",
            status="passed" if verification_hour == values["hour"] else "failed",
            primary_value=values["hour"],
            verification_value=verification_hour,
        )
    )

    reference_time = utc_time.astimezone(BEIJING_STANDARD_TIME)
    jie_dates = {event_time.astimezone(BEIJING_STANDARD_TIME).date() for _, event_time in _sxtwl_jie_events(reference_time.year)}
    if reference_time.date() in jie_dates:
        checks.extend(
            [
                AuditCheck(
                    name="year_pillar",
                    status="skipped",
                    primary_value=values["year"],
                    detail="sxtwl 直接四柱接口在节气当天只按日期切换，改由节气时刻审计",
                ),
                AuditCheck(
                    name="month_pillar",
                    status="skipped",
                    primary_value=values["month"],
                    detail="sxtwl 直接四柱接口在节气当天只按日期切换，改由节气时刻审计",
                ),
            ]
        )
    else:
        reference_day = sxtwl.fromSolar(reference_time.year, reference_time.month, reference_time.day)
        verification_year = _sxtwl_gan_zhi(reference_day.getYearGZ())
        verification_month = _sxtwl_gan_zhi(reference_day.getMonthGZ())
        checks.extend(
            [
                AuditCheck(
                    name="year_pillar",
                    status="passed" if verification_year == values["year"] else "failed",
                    primary_value=values["year"],
                    verification_value=verification_year,
                ),
                AuditCheck(
                    name="month_pillar",
                    status="passed" if verification_month == values["month"] else "failed",
                    primary_value=values["month"],
                    verification_value=verification_month,
                ),
            ]
        )

    status = "failed" if any(item.status == "failed" for item in checks) else "passed"
    return AuditReport(
        status=status,
        primary_engine=PRIMARY_ENGINE_VERSION,
        verification_engine=VERIFICATION_ENGINE_VERSION,
        checks=checks,
    )


def _alternative(
    label: str,
    wall_time: datetime,
    payload: BaziCalculationInput,
) -> AlternativeChart:
    normalized = normalize_birth_time(
        wall_time,
        payload.iana_timezone,
        payload.longitude,
        payload.solar_time_mode,
        payload.dst_fold,
    )
    values = _pillar_values(normalized.utc, normalized.selected, payload.day_boundary_rule)
    return AlternativeChart(label=label, selected_time=normalized.selected, **values)


def _build_boundary_report(
    payload: BaziCalculationInput,
    normalized: NormalizedTimeValues,
    main_values: dict[str, str],
) -> tuple[BoundaryReport, list[AlternativeChart]]:
    previous_jie, next_jie = _primary_jie_candidates(normalized.utc)
    nearest = min((previous_jie, next_jie), key=lambda item: abs(item.distance_seconds))
    uncertainty_seconds = int((payload.uncertainty_minutes or 0) * 60)
    alternatives: list[AlternativeChart] = []
    notes: list[str] = []
    interval_has_time_anomaly = False

    if uncertainty_seconds:
        delta = timedelta(seconds=uncertainty_seconds)
        try:
            earliest = _alternative("earliest", payload.local_datetime - delta, payload)
            latest = _alternative("latest", payload.local_datetime + delta, payload)
            endpoint_values = {
                (earliest.year, earliest.month, earliest.day, earliest.hour),
                (latest.year, latest.month, latest.day, latest.hour),
                (main_values["year"], main_values["month"], main_values["day"], main_values["hour"]),
            }
            if len(endpoint_values) > 1:
                alternatives = [earliest, latest]
        except TimeNormalizationError as exc:
            interval_has_time_anomaly = True
            notes.append(f"时间误差区间触及夏令时跳时或重复时段：{exc}；结果仍按所填主时刻正常计算")

    crosses_jie = any(
        (item.year, item.month) != (main_values["year"], main_values["month"]) for item in alternatives
    )
    crosses_day = any(item.day != main_values["day"] for item in alternatives)
    crosses_hour = any(item.hour != main_values["hour"] for item in alternatives)
    if crosses_jie:
        notes.append("出生时间误差范围跨越节气交接，年柱或月柱存在备选结果")
    if crosses_day:
        notes.append("出生时间误差范围跨越换日边界，日柱存在备选结果")
    if crosses_hour:
        notes.append("出生时间误差范围跨越时辰边界，时柱存在备选结果")

    if interval_has_time_anomaly or alternatives:
        risk = "ambiguous"
    elif abs(nearest.distance_seconds) <= 300:
        risk = "near_boundary"
        notes.append("出生时刻距离节气交接不足五分钟")
    else:
        risk = "none"
    return (
        BoundaryReport(
            nearest_jie=nearest,
            uncertainty_seconds=uncertainty_seconds,
            crosses_jie_boundary=crosses_jie,
            crosses_hour_boundary=crosses_hour,
            crosses_day_boundary=crosses_day,
            risk=risk,
            notes=notes,
        ),
        alternatives,
    )


def _calculation_hash(payload: BaziCalculationInput, result: BaziCalculationResult) -> str:
    canonical = {
        "input": payload.model_dump(mode="json"),
        "result": result.model_dump(mode="json", exclude={"calculation_hash"}),
    }
    encoded = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def calculate_chart(payload: BaziCalculationInput) -> BaziCalculationResult:
    normalized = normalize_birth_time(
        payload.local_datetime,
        payload.iana_timezone,
        payload.longitude,
        payload.solar_time_mode,
        payload.dst_fold,
    )
    values = _pillar_values(normalized.utc, normalized.selected, payload.day_boundary_rule)
    pillars = _four_pillars(values)
    boundary, alternatives = _build_boundary_report(payload, normalized, values)
    audit = _build_audit(
        normalized.utc,
        normalized.selected,
        values,
        payload.day_boundary_rule,
        boundary.nearest_jie,
    )
    luck_cycles = (
        calculate_luck_cycles(payload, normalized, values)
        if payload.gender is not None or payload.luck_direction_override is not None
        else None
    )
    status = "audit_failed" if audit.status == "failed" else "ambiguous" if boundary.risk == "ambiguous" else "ok"
    result = BaziCalculationResult(
        status=status,
        user_visible=audit.status == "passed",
        normalized_times=NormalizedTimes(
            civil_time=normalized.civil,
            utc_time=normalized.utc,
            mean_solar_time=normalized.mean_solar,
            apparent_solar_time=normalized.apparent_solar,
            selected_time=normalized.selected,
            selected_mode=payload.solar_time_mode,
            utc_offset_minutes=normalized.utc_offset_minutes,
            longitude_offset_from_utc_minutes=round(normalized.longitude_offset_from_utc_minutes, 6),
            mean_solar_correction_minutes=round(normalized.mean_solar_correction_minutes, 6),
            equation_of_time_minutes=round(normalized.equation_of_time_minutes, 6),
            total_apparent_correction_minutes=round(normalized.total_apparent_correction_minutes, 6),
        ),
        pillars=pillars,
        boundary=boundary,
        alternatives=alternatives,
        audit=audit,
        rule_profile=RuleProfile(
            timezone_database=TIMEZONE_DATABASE_VERSION,
            solar_time_mode=payload.solar_time_mode,
            day_boundary=payload.day_boundary_rule,
            luck_start_rule=payload.luck_start_rule,
        ),
        luck_cycles=luck_cycles,
        calculation_hash="",
    )
    result.calculation_hash = _calculation_hash(payload, result)
    return result
