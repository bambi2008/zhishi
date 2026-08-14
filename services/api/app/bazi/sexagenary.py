from __future__ import annotations

from datetime import date, datetime, timedelta


GAN = tuple("甲乙丙丁戊己庚辛壬癸")
ZHI = tuple("子丑寅卯辰巳午未申酉戌亥")
SEXAGENARY_CYCLE = tuple(f"{GAN[index % 10]}{ZHI[index % 12]}" for index in range(60))

# Hong Kong Observatory's January 2026 almanac publishes 2026-01-01 as 乙亥.
# The day cycle advances exactly once per proleptic Gregorian date throughout
# the engine's supported 1900-2100 range.
OFFICIAL_DAY_ANCHOR = date(2026, 1, 1)
OFFICIAL_DAY_ANCHOR_PILLAR = "乙亥"
OFFICIAL_DAY_ANCHOR_INDEX = SEXAGENARY_CYCLE.index(OFFICIAL_DAY_ANCHOR_PILLAR)


def sexagenary_day_pillar(value: date) -> str:
    day_offset = value.toordinal() - OFFICIAL_DAY_ANCHOR.toordinal()
    return SEXAGENARY_CYCLE[(OFFICIAL_DAY_ANCHOR_INDEX + day_offset) % 60]


def selected_day_pillar(selected_time: datetime, day_boundary_rule: str) -> str:
    selected_date = selected_time.date()
    if day_boundary_rule == "late_zi_next_day" and selected_time.hour == 23:
        selected_date += timedelta(days=1)
    return sexagenary_day_pillar(selected_date)


def sexagenary_hour_pillar(selected_time: datetime) -> str:
    # 子时 is one continuous two-hour block from 23:00 through 00:59. Both
    # audited libraries derive its stem from the date containing 00:00, so the
    # 23:00 segment uses the following Gregorian date's day stem.
    hour_basis_date = selected_time.date()
    if selected_time.hour == 23:
        hour_basis_date += timedelta(days=1)

    day_stem_index = GAN.index(sexagenary_day_pillar(hour_basis_date)[0])
    hour_branch_index = ((selected_time.hour + 1) // 2) % 12
    hour_stem_index = ((day_stem_index % 5) * 2 + hour_branch_index) % 10
    return f"{GAN[hour_stem_index]}{ZHI[hour_branch_index]}"
