from __future__ import annotations

from datetime import date as date_type, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


Confidence = Literal["high", "medium", "low"]
RiskLevel = Literal["low", "medium", "high", "critical"]
Importance = Literal["primary", "supporting", "background"]


class EvidenceSource(BaseModel):
    source_type: str
    title: str
    summary: str
    importance: Importance = "supporting"
    source_refs: list[str] = Field(default_factory=list)


class EvidenceChain(BaseModel):
    human_summary: str
    evidence_chain: list[EvidenceSource]
    synthesis: str
    confidence: Confidence
    limitations: list[str] = Field(default_factory=list)
    alternative_interpretations: list[str] = Field(default_factory=list)


class BirthProfile(BaseModel):
    birth_date: date_type
    birth_time: str | None = None
    birth_time_accuracy: Literal["exact", "approximate", "hour_only", "unknown"] = "unknown"
    birth_location_name: str
    iana_timezone: str = "Asia/Shanghai"
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    solar_time_mode: Literal["civil", "mean_solar", "apparent_solar"] = "civil"
    day_boundary_rule: Literal["midnight", "late_zi_next_day"] = "midnight"
    gender: str | None = None


class OnboardingInput(BaseModel):
    email: str | None = None
    locale: str = "zh-CN"
    timezone: str = "Asia/Shanghai"
    birth_profile: BirthProfile | None = None
    focus_area: str = "self"
    current_question: str = ""
    decision_deadline: date_type | None = None
    current_concern: str = ""
    pressure: int = Field(default=3, ge=1, le=5)
    energy: int = Field(default=3, ge=1, le=5)
    clarity: int = Field(default=3, ge=1, le=5)
    control: int = Field(default=3, ge=1, le=5)
    sleep: int = Field(default=3, ge=1, le=5)


class UserProfile(OnboardingInput):
    user_id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DailyCheckInInput(BaseModel):
    energy: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    emotion: str
    focus_area: str
    important_event: str | None = None
    free_text: str = ""


class DailyCheckIn(DailyCheckInInput):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    date: date_type = Field(default_factory=date_type.today)


class Action(BaseModel):
    type: Literal["推进", "收集信息", "沟通", "整理", "恢复", "暂停", "验证"]
    title: str
    description: str
    estimated_minutes: int = Field(ge=1, le=60)


class DailyGuidance(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    date: date_type = Field(default_factory=date_type.today)
    comfort_message: str
    today_theme: str
    reality_observation: str
    action: Action
    reasoning: EvidenceChain
    model_version: str = "stub_v1"
    prompt_version: str = "daily_v1"


class AnxietySessionInput(BaseModel):
    raw_input: str = Field(min_length=1, max_length=4000)
    emotion: str = "其他"


class AnxietySession(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    created_at: datetime = Field(default_factory=datetime.utcnow)
    raw_input: str
    emotion: str
    facts: list[str]
    interpretations: list[str]
    fears: list[str]
    next_action: str
    risk_level: RiskLevel
    safety_flags: list[str] = Field(default_factory=list)
    reasoning: EvidenceChain


class LifeChapterInput(BaseModel):
    type: Literal["career", "finance", "relationship", "family", "relocation", "self", "other"]
    title: str
    current_question: str
    decision_deadline: date_type | None = None
    facts: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


class LifeChapter(LifeChapterInput):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    status: Literal["exploring", "collecting_information", "waiting", "preparing_decision", "decided", "ended"] = "exploring"
    started_at: datetime = Field(default_factory=datetime.utcnow)


class YearClaim(BaseModel):
    claim_id: UUID = Field(default_factory=uuid4)
    human_summary: str
    evidence_chain: EvidenceChain
    confidence: Confidence
    status: Literal["unverified", "partially_verified", "verified", "diverged"] = "unverified"
    verification_notes: list[str] = Field(default_factory=list)


class YearNavigation(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    year: int
    status: Literal["active", "reviewed"] = "active"
    annual_theme: str
    annual_summary: str
    focus_areas: list[str]
    quarters: list[dict]
    months: list[dict]
    claims: list[YearClaim]
    prediction_version: str = "year_v1"
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
