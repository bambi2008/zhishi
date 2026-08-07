from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from lunar_python import Solar
from lunar_python.util import LunarUtil

from .engine import (
    BEIJING_STANDARD_TIME,
    PRIMARY_ENGINE_VERSION,
    VERIFICATION_ENGINE_VERSION,
    _primary_jie_candidates,
    _solar_to_datetime,
    _sxtwl_jie_events,
    calculate_chart,
)
from .models import (
    AnnualCycleContext,
    AuditCheck,
    AuditReport,
    BaziCurrentContextInput,
    BaziCurrentContextResult,
    BoundaryCandidate,
    CurrentLuckContext,
    MonthlyCycleContext,
    PillarDetails,
)


MONTH_SEQUENCE = (
    ("立春", "寅"),
    ("惊蛰", "卯"),
    ("清明", "辰"),
    ("立夏", "巳"),
    ("芒种", "午"),
    ("小暑", "未"),
    ("立秋", "申"),
    ("白露", "酉"),
    ("寒露", "戌"),
    ("立冬", "亥"),
    ("大雪", "子"),
    ("小寒", "丑"),
)
STEMS = tuple("甲乙丙丁戊己庚辛壬癸")
TIGER_MONTH_STEM_INDEX = {
    "甲": 2,
    "己": 2,
    "乙": 4,
    "庚": 4,
    "丙": 6,
    "辛": 6,
    "丁": 8,
    "壬": 8,
    "戊": 0,
    "癸": 0,
}


@lru_cache(maxsize=256)
def _primary_lichun_events(center_year: int) -> tuple[datetime, ...]:
    events: set[datetime] = set()
    for year in range(center_year - 1, center_year + 2):
        table = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getJieQiTable()
        for key in ("立春", "LI_CHUN"):
            value = table.get(key)
            if value is None:
                continue
            reference = _solar_to_datetime(value).replace(tzinfo=BEIJING_STANDARD_TIME)
            events.add(reference.astimezone(UTC))
    return tuple(sorted(events))


def _lichun_window(as_of_utc: datetime) -> tuple[BoundaryCandidate, BoundaryCandidate]:
    events = _primary_lichun_events(as_of_utc.year)
    previous = max(item for item in events if item <= as_of_utc)
    following = min(item for item in events if item > as_of_utc)
    return (
        BoundaryCandidate(
            name="立春",
            boundary_time_utc=previous,
            distance_seconds=round((previous - as_of_utc).total_seconds()),
            source=PRIMARY_ENGINE_VERSION,
        ),
        BoundaryCandidate(
            name="立春",
            boundary_time_utc=following,
            distance_seconds=round((following - as_of_utc).total_seconds()),
            source=PRIMARY_ENGINE_VERSION,
        ),
    )


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


def _formula_month_pillar(year_stem: str, start_jie_name: str) -> tuple[int, str]:
    offset = next(index for index, item in enumerate(MONTH_SEQUENCE) if item[0] == start_jie_name)
    branch = MONTH_SEQUENCE[offset][1]
    stem = STEMS[(TIGER_MONTH_STEM_INDEX[year_stem] + offset) % len(STEMS)]
    return offset + 1, f"{stem}{branch}"


def _current_luck_context(chart, as_of_local_naive: datetime) -> CurrentLuckContext:
    luck = chart.luck_cycles
    if luck is None or not luck.periods:
        return CurrentLuckContext(status="out_of_range")

    first = luck.periods[0]
    if as_of_local_naive < first.start_at_local:
        return CurrentLuckContext(
            status="pre_luck",
            next_period=first,
            next_transition_local=first.start_at_local,
        )

    for index, period in enumerate(luck.periods):
        if period.start_at_local <= as_of_local_naive < period.end_at_local_exclusive:
            next_period = luck.periods[index + 1] if index + 1 < len(luck.periods) else None
            return CurrentLuckContext(
                status="active",
                current_period=period,
                next_period=next_period,
                next_transition_local=period.end_at_local_exclusive,
            )
    return CurrentLuckContext(status="out_of_range")


def _build_audit(
    as_of_utc: datetime,
    as_of_local_naive: datetime,
    start_boundary: BoundaryCandidate,
    end_boundary: BoundaryCandidate,
    primary_pillar: str,
    formula_pillar: str,
    month_start_boundary: BoundaryCandidate,
    month_end_boundary: BoundaryCandidate,
    primary_month_pillar: str,
    formula_month_pillar: str,
    chart,
    current_luck: CurrentLuckContext,
) -> AuditReport:
    checks: list[AuditCheck] = []
    verification_events = [
        value for name, value in _sxtwl_jie_events(as_of_utc.year) if name == "立春"
    ]
    for name, boundary in (("annual_start_lichun", start_boundary), ("annual_end_lichun", end_boundary)):
        if not verification_events:
            checks.append(AuditCheck(name=name, status="failed", detail="校验引擎未找到立春事件"))
            continue
        verification = min(
            verification_events,
            key=lambda item: abs((item - boundary.boundary_time_utc).total_seconds()),
        )
        difference = abs((verification - boundary.boundary_time_utc).total_seconds())
        checks.append(
            AuditCheck(
                name=name,
                status="passed" if difference <= 90 else "failed",
                primary_value=boundary.boundary_time_utc.isoformat(),
                verification_value=verification.isoformat(),
                difference_seconds=round(difference, 3),
                detail="两个独立历法引擎的立春交接时刻允许最大差异为 90 秒",
            )
        )
    checks.append(
        AuditCheck(
            name="annual_pillar",
            status="passed" if primary_pillar == formula_pillar else "failed",
            primary_value=primary_pillar,
            verification_value=formula_pillar,
            detail="以 1984 甲子年为独立六十甲子基准复核",
        )
    )
    for name, boundary in (
        ("monthly_start_jie", month_start_boundary),
        ("monthly_end_jie", month_end_boundary),
    ):
        matching_events = [
            value
            for event_name, value in _sxtwl_jie_events(as_of_utc.year)
            if event_name == boundary.name
        ]
        if not matching_events:
            checks.append(AuditCheck(name=name, status="failed", detail=f"校验引擎未找到{boundary.name}事件"))
            continue
        verification = min(
            matching_events,
            key=lambda item: abs((item - boundary.boundary_time_utc).total_seconds()),
        )
        difference = abs((verification - boundary.boundary_time_utc).total_seconds())
        checks.append(
            AuditCheck(
                name=name,
                status="passed" if difference <= 90 else "failed",
                primary_value=f"{boundary.name} {boundary.boundary_time_utc.isoformat()}",
                verification_value=f"{boundary.name} {verification.isoformat()}",
                difference_seconds=round(difference, 3),
                detail="两个独立历法引擎的节气交接时刻允许最大差异为 90 秒",
            )
        )
    checks.append(
        AuditCheck(
            name="monthly_pillar",
            status="passed" if primary_month_pillar == formula_month_pillar else "failed",
            primary_value=primary_month_pillar,
            verification_value=formula_month_pillar,
            detail="以五虎遁年上起月公式独立复核月干支",
        )
    )
    luck_ok = (
        chart.luck_cycles is not None
        and chart.luck_cycles.audit.status == "passed"
        and (
            current_luck.status != "active"
            or current_luck.current_period is not None
            and current_luck.current_period.start_at_local
            <= as_of_local_naive
            < current_luck.current_period.end_at_local_exclusive
        )
    )
    checks.append(
        AuditCheck(
            name="current_luck_period",
            status="passed" if luck_ok else "failed",
            primary_value=(
                current_luck.current_period.pillar.value if current_luck.current_period else current_luck.status
            ),
            verification_value="大运边界与三路起运审计一致" if luck_ok else None,
        )
    )
    status = "failed" if any(item.status == "failed" for item in checks) else "passed"
    return AuditReport(
        status=status,
        primary_engine=PRIMARY_ENGINE_VERSION,
        verification_engine=f"{VERIFICATION_ENGINE_VERSION} + sexagenary-formula@1984-jiazi",
        checks=checks,
    )


def calculate_current_context(payload: BaziCurrentContextInput) -> BaziCurrentContextResult:
    chart = calculate_chart(payload.chart)
    as_of_utc = payload.as_of_utc.astimezone(UTC)
    as_of_local = as_of_utc.astimezone(ZoneInfo(payload.chart.iana_timezone))
    current_luck = _current_luck_context(chart, as_of_local.replace(tzinfo=None))
    start_boundary, end_boundary = _lichun_window(as_of_utc)
    month_start_boundary, month_end_boundary = _primary_jie_candidates(as_of_utc)

    reference_time = as_of_utc.astimezone(BEIJING_STANDARD_TIME).replace(tzinfo=None)
    current_eight_char = (
        Solar.fromYmdHms(
            reference_time.year,
            reference_time.month,
            reference_time.day,
            reference_time.hour,
            reference_time.minute,
            reference_time.second,
        )
        .getLunar()
        .getEightChar()
    )
    primary_pillar = current_eight_char.getYear()
    primary_month_pillar = current_eight_char.getMonth()
    label_year = start_boundary.boundary_time_utc.astimezone(BEIJING_STANDARD_TIME).year
    formula_pillar = LunarUtil.JIA_ZI[(label_year - 1984) % 60]
    month_sequence, formula_month_pillar = _formula_month_pillar(
        primary_pillar[0], month_start_boundary.name
    )
    audit = _build_audit(
        as_of_utc,
        as_of_local.replace(tzinfo=None),
        start_boundary,
        end_boundary,
        primary_pillar,
        formula_pillar,
        month_start_boundary,
        month_end_boundary,
        primary_month_pillar,
        formula_month_pillar,
        chart,
        current_luck,
    )
    ambiguous = chart.status == "ambiguous" or (
        chart.luck_cycles is not None and chart.luck_cycles.status == "ambiguous"
    )
    visible = chart.user_visible and not ambiguous and audit.status == "passed"
    return BaziCurrentContextResult(
        status="ok" if visible else "ambiguous" if ambiguous else "audit_failed",
        user_visible=visible,
        as_of_utc=as_of_utc,
        as_of_local=as_of_local,
        chart=chart,
        current_luck=current_luck,
        annual_cycle=AnnualCycleContext(
            label_year=label_year,
            pillar=_pillar_details(primary_pillar, chart.pillars.day_master),
            start_boundary=start_boundary,
            end_boundary=end_boundary,
        ),
        monthly_cycle=MonthlyCycleContext(
            sequence_from_lichun=month_sequence,
            pillar=_pillar_details(primary_month_pillar, chart.pillars.day_master),
            start_boundary=month_start_boundary,
            end_boundary=month_end_boundary,
        ),
        audit=audit,
    )
