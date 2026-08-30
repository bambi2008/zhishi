from __future__ import annotations

import os
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .bazi import (
    BaziCalculationInput,
    BaziCalculationResult,
    BaziCurrentContextInput,
    BaziCurrentContextResult,
    calculate_chart,
    calculate_current_context,
)
from .bazi.solar_time import TimeNormalizationError
from .locations import LocationSearchError, LocationSearchInput, LocationSearchResult, search_locations
from .interpretations import (
    BaziInterpretationInput,
    BaziInterpretationResult,
    InterpretationServiceError,
    generate_bazi_interpretation,
)
from .reflections import ReflectionTurnInput, ReflectionTurnResult, generate_reflection_turn
from .models import (
    AnxietySession,
    AnxietySessionInput,
    DailyCheckIn,
    DailyCheckInInput,
    EvidenceChain,
    EvidenceSource,
    LifeChapter,
    LifeChapterInput,
    OnboardingInput,
    UserProfile,
)
from .store import store

app = FastAPI(title="知时 API", version="0.2.0", description="东方人生导航 MVP 的结构化 API 骨架。")


def configured_cors_origins() -> list[str]:
    local_origins = (
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:8081",
        "http://localhost:8081",
    )
    configured = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv("ZHISHI_CORS_ORIGINS", "").split(",")
        if origin.strip()
    )
    if "*" in configured:
        raise RuntimeError("ZHISHI_CORS_ORIGINS must list exact trusted origins; wildcard is not allowed.")
    return list(dict.fromkeys((*local_origins, *configured)))


app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.middleware("http")
async def add_privacy_and_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/v1/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


def get_user(user_id: UUID) -> UserProfile:
    user = store.users.get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "zhishi-api", "version": app.version}


@app.post("/api/v1/bazi/charts/calculate", response_model=BaziCalculationResult)
def calculate_bazi_chart(payload: BaziCalculationInput) -> BaziCalculationResult:
    try:
        return calculate_chart(payload)
    except TimeNormalizationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc


@app.post("/api/v1/bazi/context/current", response_model=BaziCurrentContextResult)
def calculate_bazi_current_context(payload: BaziCurrentContextInput) -> BaziCurrentContextResult:
    try:
        return calculate_current_context(payload)
    except TimeNormalizationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc


@app.post("/api/v1/bazi/interpretations/generate", response_model=BaziInterpretationResult)
def create_bazi_interpretation(payload: BaziInterpretationInput) -> BaziInterpretationResult:
    try:
        return generate_bazi_interpretation(payload)
    except TimeNormalizationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc
    except InterpretationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc


@app.post("/api/v1/reflections/conversation/turn", response_model=ReflectionTurnResult)
def create_reflection_turn(payload: ReflectionTurnInput) -> ReflectionTurnResult:
    try:
        return generate_reflection_turn(payload)
    except InterpretationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc


@app.post("/api/v1/locations/search", response_model=list[LocationSearchResult])
def search_birth_locations(payload: LocationSearchInput) -> tuple[LocationSearchResult, ...]:
    try:
        return search_locations(payload.query, payload.language, payload.limit)
    except LocationSearchError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "location_provider_unavailable", "message": str(exc)},
        ) from exc


@app.post("/api/v1/onboarding", response_model=UserProfile)
def create_or_update_onboarding(payload: OnboardingInput) -> UserProfile:
    existing = next((u for u in store.users.values() if u.email and u.email == payload.email), None)
    user = existing.model_copy(update=payload.model_dump(exclude_unset=True)) if existing else UserProfile(**payload.model_dump())
    store.users[user.user_id] = user
    return user


@app.get("/api/v1/users/{user_id}", response_model=UserProfile)
def read_user(user_id: UUID) -> UserProfile:
    return get_user(user_id)


@app.post("/api/v1/daily/check-in", response_model=DailyCheckIn)
def create_checkin(user_id: UUID, payload: DailyCheckInInput) -> DailyCheckIn:
    get_user(user_id)
    item = DailyCheckIn(user_id=user_id, **payload.model_dump())
    store.checkins.setdefault(user_id, []).append(item)
    return item


@app.post("/api/v1/daily/guidance/generate", status_code=501)
def generate_daily_guidance(user_id: UUID) -> None:
    get_user(user_id)
    raise HTTPException(
        status_code=501,
        detail={
            "code": "daily_guidance_requires_real_context",
            "message": "今日建议尚未接入用户真实记录与审计命盘；服务不会返回固定建议冒充个性化结果。",
        },
    )


@app.get("/api/v1/daily/guidance/today", status_code=501)
def read_daily_guidance(user_id: UUID) -> None:
    generate_daily_guidance(user_id)


def classify_anxiety(payload: AnxietySessionInput) -> tuple[list[str], list[str], list[str], str, str, list[str]]:
    text = payload.raw_input.lower()
    critical_terms = ("不想活", "伤害自己", "自杀", "伤害别人", "杀了")
    if any(term in text for term in critical_terms):
        return (["用户表达了需要立即关注的安全信号。"], [], ["可能存在自伤或他伤风险。"], "请立即联系当地紧急服务、危机热线或身边可信任的人，并先不要独处。", "critical", ["self_harm_or_harm_risk", "stop_divination"])
    return (["用户描述了一件刚刚发生或正在等待结果的事情。"], ["对事件的解释不一定等同于已经发生的事实。"], ["用户担心事情会朝更坏的方向发展。"], "先离开即时对话界面 20 分钟，把真正需要确认的问题写成一句话。", "low", [])


@app.post("/api/v1/anxiety/session", response_model=AnxietySession)
def create_anxiety_session(user_id: UUID, payload: AnxietySessionInput) -> AnxietySession:
    get_user(user_id)
    facts, interpretations, fears, next_action, risk_level, safety_flags = classify_anxiety(payload)
    session = AnxietySession(
        user_id=user_id, raw_input=payload.raw_input, emotion=payload.emotion,
        facts=facts, interpretations=interpretations, fears=fears, next_action=next_action,
        risk_level=risk_level, safety_flags=safety_flags,
        reasoning=EvidenceChain(
            human_summary="先把事实、解释和担心分开.",
            evidence_chain=[
                EvidenceSource(source_type="current_reality", title="用户输入", summary="结构化当前描述，不补写用户没有提供的信息。", importance="primary"),
                EvidenceSource(source_type="system_inference", title="风险判断", summary=f"当前风险等级为 {risk_level}。", importance="primary"),
            ],
            synthesis="下一步建议只针对未来一小时，不替用户处理长期问题。",
            confidence="medium", limitations=["这是规则层骨架，不是医疗或心理诊断。"],
        ),
    )
    if safety_flags:
        session.reasoning.limitations.append("检测到安全信号，已停止普通命理解释。")
    return session


@app.post("/api/v1/life-chapters", response_model=LifeChapter)
def create_life_chapter(user_id: UUID, payload: LifeChapterInput) -> LifeChapter:
    get_user(user_id)
    chapter = LifeChapter(user_id=user_id, **payload.model_dump())
    store.chapters.setdefault(user_id, []).append(chapter)
    return chapter


@app.get("/api/v1/life-chapters", response_model=list[LifeChapter])
def list_life_chapters(user_id: UUID) -> list[LifeChapter]:
    get_user(user_id)
    return store.chapters.get(user_id, [])


@app.post("/api/v1/year-navigation/{year}", status_code=501)
def create_year_navigation(year: int, user_id: UUID) -> None:
    get_user(user_id)
    raise HTTPException(
        status_code=501,
        detail={
            "code": "year_navigation_requires_chart_context",
            "message": (
                f"{year} 年解释层尚未绑定已审计命盘；"
                "请使用 /api/v1/bazi/context/current 获取真实流年、流月与大运边界。"
            ),
        },
    )
