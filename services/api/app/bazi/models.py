from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


SolarTimeMode = Literal["civil", "mean_solar", "apparent_solar"]
DayBoundaryRule = Literal["midnight", "late_zi_next_day"]
TimeAccuracy = Literal["exact", "approximate", "hour_only"]
Gender = Literal["male", "female"]
CheckStatus = Literal["passed", "failed", "skipped"]


class BaziCalculationInput(BaseModel):
    local_datetime: datetime
    iana_timezone: str = "Asia/Shanghai"
    longitude: float = Field(ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    birth_location_name: str = Field(default="", max_length=200)
    gender: Gender | None = None
    time_accuracy: TimeAccuracy = "exact"
    uncertainty_minutes: int | None = Field(default=None, ge=0, le=120)
    dst_fold: Literal[0, 1] | None = None
    solar_time_mode: SolarTimeMode = "civil"
    day_boundary_rule: DayBoundaryRule = "midnight"

    @model_validator(mode="after")
    def validate_wall_time(self) -> "BaziCalculationInput":
        if self.local_datetime.tzinfo is not None:
            raise ValueError("local_datetime 必须是不带 UTC 偏移的出生地钟表时间")
        if not 1900 <= self.local_datetime.year <= 2100:
            raise ValueError("当前经过验证的出生年份范围为 1900—2100")
        if self.time_accuracy != "exact" and self.uncertainty_minutes is None:
            self.uncertainty_minutes = 30 if self.time_accuracy == "approximate" else 60
        if self.time_accuracy == "exact" and self.uncertainty_minutes is None:
            self.uncertainty_minutes = 1
        return self


class NormalizedTimes(BaseModel):
    civil_time: datetime
    utc_time: datetime
    mean_solar_time: datetime
    apparent_solar_time: datetime
    selected_time: datetime
    selected_mode: SolarTimeMode
    utc_offset_minutes: int
    longitude_offset_from_utc_minutes: float
    mean_solar_correction_minutes: float
    equation_of_time_minutes: float
    total_apparent_correction_minutes: float


class PillarDetails(BaseModel):
    value: str
    stem: str
    branch: str
    stem_element: str
    branch_element: str
    hidden_stems: list[str]
    stem_ten_god: str
    hidden_stem_ten_gods: list[str]
    na_yin: str


class FourPillars(BaseModel):
    year: PillarDetails
    month: PillarDetails
    day: PillarDetails
    hour: PillarDetails
    day_master: str


class BoundaryCandidate(BaseModel):
    name: str
    boundary_time_utc: datetime
    distance_seconds: int
    source: str


class BoundaryReport(BaseModel):
    nearest_jie: BoundaryCandidate
    uncertainty_seconds: int
    crosses_jie_boundary: bool
    crosses_hour_boundary: bool
    crosses_day_boundary: bool
    risk: Literal["none", "near_boundary", "ambiguous"]
    notes: list[str] = Field(default_factory=list)


class AuditCheck(BaseModel):
    name: str
    status: CheckStatus
    primary_value: str | None = None
    verification_value: str | None = None
    difference_seconds: float | None = None
    detail: str = ""


class AuditReport(BaseModel):
    status: Literal["passed", "failed"]
    primary_engine: str
    verification_engine: str
    checks: list[AuditCheck]


class AlternativeChart(BaseModel):
    label: str
    selected_time: datetime
    year: str
    month: str
    day: str
    hour: str


class RuleProfile(BaseModel):
    profile_id: str = "zhishi-standard-v1"
    year_boundary: Literal["exact_lichun"] = "exact_lichun"
    month_boundary: Literal["exact_jie"] = "exact_jie"
    solar_time_mode: SolarTimeMode
    day_boundary: DayBoundaryRule


class BaziCalculationResult(BaseModel):
    status: Literal["ok", "ambiguous", "audit_failed"]
    user_visible: bool
    normalized_times: NormalizedTimes
    pillars: FourPillars
    boundary: BoundaryReport
    alternatives: list[AlternativeChart] = Field(default_factory=list)
    audit: AuditReport
    rule_profile: RuleProfile
    calculation_hash: str
