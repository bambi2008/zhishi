from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from functools import lru_cache

import sxtwl
from lunar_python import Solar
from lunar_python.util import LunarUtil

from .models import (
    AuditCheck,
    AuditReport,
    BaziCalculationInput,
    BoundaryCandidate,
    LuckCycleResult,
    LuckPeriod,
    LuckStartAge,
    PillarDetails,
)
from .solar_time import NormalizedTimeValues


PRIMARY_ENGINE_VERSION = "lunar_python@1.4.8"
LUCK_AUDIT_ENGINE_VERSION = "sxtwl@2.0.7 + zhishi-luck-audit@1"
BEIJING_STANDARD_TIME = timezone(timedelta(hours=8), name="UTC+08:00")
YANG_STEMS = frozenset("甲丙戊庚壬")
GAN = tuple("甲乙丙丁戊己庚辛壬癸")
ZHI = tuple("子丑寅卯辰巳午未申酉戌亥")
JIE_QI_NAMES = (
    "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰",
    "春分", "清明", "谷雨", "立夏", "小满", "芒种",
    "夏至", "小暑", "大暑", "立秋", "处暑", "白露",
    "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
)


def _solar_from_datetime(value: datetime):
    return Solar.fromYmdHms(value.year, value.month, value.day, value.hour, value.minute, value.second)


def _solar_to_datetime(value) -> datetime:
    return datetime(
        value.getYear(), value.getMonth(), value.getDay(),
        value.getHour(), value.getMinute(), value.getSecond(),
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


def _direction(year_pillar: str, payload: BaziCalculationInput) -> tuple[bool, str, str]:
    is_yang = year_pillar[0] in YANG_STEMS
    yin_yang = "yang" if is_yang else "yin"
    if payload.luck_direction_override:
        forward = payload.luck_direction_override == "forward"
        return forward, f"显式规则覆盖：{'顺行' if forward else '逆行'}", yin_yang
    if payload.gender is None:
        raise ValueError("计算大运需要 gender 或 luck_direction_override")
    forward = (is_yang and payload.gender == "male") or (not is_yang and payload.gender == "female")
    gender_text = "男" if payload.gender == "male" else "女"
    stem_text = "阳年" if is_yang else "阴年"
    return forward, f"{stem_text}{gender_text}，{'顺行' if forward else '逆行'}", yin_yang


def _precise_components(start: datetime, end: datetime) -> tuple[int, int, int, int, int]:
    start_minute = start.replace(second=0, microsecond=0)
    end_minute = end.replace(second=0, microsecond=0)
    minutes = int(abs((end_minute - start_minute).total_seconds()) // 60)
    year = minutes // 4320
    minutes -= year * 4320
    month = minutes // 360
    minutes -= month * 360
    day = minutes // 12
    minutes -= day * 12
    hour = minutes * 2
    return year, month, day, hour, int(abs((end_minute - start_minute).total_seconds()) // 60)


def _time_branch_index(value: datetime) -> int:
    if value.hour == 23:
        return 11
    return LunarUtil.getTimeZhiIndex(value.strftime("%H:%M"))


def _traditional_components(start: datetime, end: datetime) -> tuple[int, int, int, int, int]:
    hour_diff = _time_branch_index(end) - _time_branch_index(start)
    day_diff = (end.date() - start.date()).days
    if hour_diff < 0:
        hour_diff += 12
        day_diff -= 1
    month_diff = int(hour_diff * 10 / 30)
    month_total = day_diff * 4 + month_diff
    day = hour_diff * 10 - month_diff * 30
    year = month_total // 12
    month = month_total - year * 12
    total_minutes = int(abs((end - start).total_seconds()) // 60)
    return year, month, day, 0, total_minutes


def _apply_age(value: datetime, age: LuckStartAge) -> datetime:
    solar = _solar_from_datetime(value)
    solar = solar.nextYear(age.years)
    solar = solar.nextMonth(age.months)
    solar = solar.next(age.days)
    solar = solar.nextHour(age.hours)
    return _solar_to_datetime(solar)


def _pillar_details(value: str, day_master: str) -> PillarDetails:
    stem, branch = value[0], value[1]
    hidden_stems = list(LunarUtil.ZHI_HIDE_GAN[branch])
    return PillarDetails(
        value=value,
        stem=stem,
        branch=branch,
        stem_element=LunarUtil.WU_XING_GAN[stem],
        branch_element=LunarUtil.WU_XING_ZHI[branch],
        hidden_stems=hidden_stems,
        stem_ten_god=LunarUtil.SHI_SHEN[f"{day_master}{stem}"],
        hidden_stem_ten_gods=[LunarUtil.SHI_SHEN[f"{day_master}{item}"] for item in hidden_stems],
        na_yin=LunarUtil.NAYIN[value],
    )


def _luck_sequence(month_pillar: str, forward: bool, count: int = 8) -> list[str]:
    month_index = LunarUtil.getJiaZiIndex(month_pillar)
    step = 1 if forward else -1
    size = len(LunarUtil.JIA_ZI)
    return [LunarUtil.JIA_ZI[(month_index + step * index) % size] for index in range(1, count + 1)]


def _format_components(values: tuple[int, int, int, int]) -> str:
    return f"{values[0]}年{values[1]}月{values[2]}日{values[3]}时"


def calculate_luck_cycles(
    payload: BaziCalculationInput,
    normalized: NormalizedTimeValues,
    pillar_values: dict[str, str],
) -> LuckCycleResult:
    forward, direction_basis, yin_yang = _direction(pillar_values["year"], payload)
    previous_jie, next_jie = _primary_jie_candidates(normalized.utc)
    start_boundary = next_jie if forward else previous_jie
    reference_birth = normalized.utc.astimezone(BEIJING_STANDARD_TIME).replace(tzinfo=None)
    reference_boundary = start_boundary.boundary_time_utc.astimezone(BEIJING_STANDARD_TIME).replace(tzinfo=None)
    start, end = (reference_birth, reference_boundary) if forward else (reference_boundary, reference_birth)

    component_builder = (
        _precise_components if payload.luck_start_rule == "precise_minutes" else _traditional_components
    )
    years, months, days, hours, total_minutes = component_builder(start, end)
    decimal_years = (
        total_minutes / 4320.0
        if payload.luck_start_rule == "precise_minutes"
        else years + months / 12.0 + days / 360.0 + hours / 8640.0
    )
    start_age = LuckStartAge(
        years=years,
        months=months,
        days=days,
        hours=hours,
        decimal_years=round(decimal_years, 6),
    )
    start_at_local = _apply_age(payload.local_datetime, start_age)
    sequence = _luck_sequence(pillar_values["month"], forward)
    periods: list[LuckPeriod] = []
    for offset, pillar in enumerate(sequence):
        period_start = _solar_to_datetime(_solar_from_datetime(start_at_local).nextYear(offset * 10))
        period_end = _solar_to_datetime(_solar_from_datetime(start_at_local).nextYear((offset + 1) * 10))
        period_age = LuckStartAge(
            years=start_age.years + offset * 10,
            months=start_age.months,
            days=start_age.days,
            hours=start_age.hours,
            decimal_years=round(start_age.decimal_years + offset * 10, 6),
        )
        periods.append(
            LuckPeriod(
                index=offset + 1,
                pillar=_pillar_details(pillar, pillar_values["day"][0]),
                start_at_local=period_start,
                end_at_local_exclusive=period_end,
                start_age=period_age,
            )
        )

    checks: list[AuditCheck] = []
    matching_events = [item for item in _sxtwl_jie_events(normalized.utc.year) if item[0] == start_boundary.name]
    if matching_events:
        verification_name, verification_time = min(
            matching_events,
            key=lambda item: abs((item[1] - start_boundary.boundary_time_utc).total_seconds()),
        )
        difference = abs((verification_time - start_boundary.boundary_time_utc).total_seconds())
        checks.append(
            AuditCheck(
                name="luck_start_jie_time",
                status="passed" if difference <= 90 else "failed",
                primary_value=f"{start_boundary.name} {start_boundary.boundary_time_utc.isoformat()}",
                verification_value=f"{verification_name} {verification_time.isoformat()}",
                difference_seconds=round(difference, 3),
                detail="起运只取节，两个历法引擎允许最大差异为 90 秒",
            )
        )
    else:
        checks.append(AuditCheck(name="luck_start_jie_time", status="failed", detail="校验引擎未找到起运节气"))

    if payload.luck_direction_override:
        checks.append(
            AuditCheck(
                name="luck_direction",
                status="skipped",
                primary_value="forward" if forward else "reverse",
                detail="用户显式覆盖顺逆，第三方传统性别规则不参与裁决",
            )
        )
    else:
        reference_eight_char = _solar_from_datetime(reference_birth).getLunar().getEightChar()
        gender_value = 1 if payload.gender == "male" else 0
        sect = 2 if payload.luck_start_rule == "precise_minutes" else 1
        yun = reference_eight_char.getYun(gender_value, sect)
        library_direction = yun.isForward()
        checks.append(
            AuditCheck(
                name="luck_direction",
                status="passed" if library_direction == forward else "failed",
                primary_value="forward" if forward else "reverse",
                verification_value="forward" if library_direction else "reverse",
            )
        )
        own_components = (years, months, days, hours)
        library_components = (
            yun.getStartYear(), yun.getStartMonth(), yun.getStartDay(), yun.getStartHour(),
        )
        checks.append(
            AuditCheck(
                name="luck_start_age",
                status="passed" if library_components == own_components else "failed",
                primary_value=_format_components(own_components),
                verification_value=_format_components(library_components),
                detail="自研折算公式与 lunar_python 起运分量交叉核对",
            )
        )
        library_sequence = [item.getGanZhi() for item in reference_eight_char.getYun(gender_value, sect).getDaYun(9)[1:]]
        checks.append(
            AuditCheck(
                name="luck_cycle_sequence",
                status="passed" if library_sequence == sequence else "failed",
                primary_value=" ".join(sequence),
                verification_value=" ".join(library_sequence),
            )
        )

    status = "failed" if any(item.status == "failed" for item in checks) else "passed"
    return LuckCycleResult(
        status="audit_failed" if status == "failed" else "ok",
        user_visible=status == "passed",
        direction="forward" if forward else "reverse",
        direction_basis=direction_basis,
        year_stem_yin_yang=yin_yang,
        start_rule=payload.luck_start_rule,
        start_boundary=start_boundary,
        birth_to_boundary_seconds=abs(start_boundary.distance_seconds),
        start_age=start_age,
        start_at_local=start_at_local,
        periods=periods,
        audit=AuditReport(
            status=status,
            primary_engine=PRIMARY_ENGINE_VERSION,
            verification_engine=LUCK_AUDIT_ENGINE_VERSION,
            checks=checks,
        ),
    )
