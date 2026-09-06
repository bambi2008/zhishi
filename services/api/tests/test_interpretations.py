import json

import pytest
from fastapi.testclient import TestClient

from app.bazi import BaziCurrentContextInput, calculate_current_context
from app.interpretations import (
    BaziInterpretationInput,
    DeepSeekProvider,
    InterpretationServiceError,
    InterpretationUsage,
    ProviderCompletion,
    generate_bazi_interpretation,
)
from app.main import app


client = TestClient(app)


def interpretation_payload(*, time_accuracy: str = "exact") -> dict:
    return {
        "chart": {
            "local_datetime": "2005-12-23T08:37:00",
            "iana_timezone": "Asia/Shanghai",
            "longitude": 121.4737,
            "gender": "male",
            "time_accuracy": time_accuracy,
            "solar_time_mode": "civil",
            "day_boundary_rule": "midnight",
        },
        "as_of_utc": "2026-08-07T00:00:00Z",
        "language": "zh-CN",
        "focus_areas": ["overview", "career"],
        "question": "我可以怎样观察当前的工作节奏？",
        "acknowledged_ai_processing": True,
    }


def valid_model_json(*, evidence_id: str = "chart.day_master", summary: str | None = None) -> str:
    return json.dumps(
        {
            "summary": summary or "这份解读只把已审计的命盘结构当作文化观察线索，并邀请你回到现实记录中核对当前节奏。",
            "sections": [
                {
                    "id": "core_pattern",
                    "title": "结构观察",
                    "interpretation": "日主在这里仅作为各项十神标签的关系基点，可以用来观察你怎样命名资源、表达与责任，但不能据此判断强弱或吉凶。",
                    "evidence_ids": [evidence_id],
                    "reflection_questions": ["最近哪一件真实事件最能帮助你核对这种观察？"],
                },
                {
                    "id": "current_phase",
                    "title": "当前周期",
                    "interpretation": "当前流年与流月提供的是时间坐标，不是事件预告；更稳妥的使用方式是回看近期任务、关系与精力记录是否出现了可重复的主题。",
                    "evidence_ids": ["cycle.annual", "cycle.monthly"],
                    "reflection_questions": ["接下来两周，你准备记录哪一个可观察的现实指标？"],
                },
            ],
            "cautions": ["这些文字是传统文化反思，不是事实预测，也不替代任何专业意见。"],
        },
        ensure_ascii=False,
    )


class FakeProvider:
    model = "deepseek-test"

    def __init__(self, contents: list[str], finish_reason: str = "stop") -> None:
        self.contents = contents
        self.finish_reason = finish_reason
        self.calls = 0
        self.user_prompts: list[str] = []

    def complete(self, system_prompt: str, user_prompt: str) -> ProviderCompletion:
        assert "Return json only" in system_prompt
        assert "allowed_evidence_ids" in user_prompt
        self.user_prompts.append(user_prompt)
        index = min(self.calls, len(self.contents) - 1)
        self.calls += 1
        return ProviderCompletion(
            content=self.contents[index],
            finish_reason=self.finish_reason,
            model=self.model,
            usage=InterpretationUsage(prompt_tokens=100, completion_tokens=80, total_tokens=180),
        )


def test_interpretation_endpoint_requires_backend_provider_configuration(monkeypatch) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    response = client.post("/api/v1/bazi/interpretations/generate", json=interpretation_payload())
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "interpretation_provider_not_configured"
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_interpretation_request_requires_explicit_ai_processing_acknowledgement() -> None:
    payload = interpretation_payload()
    payload["acknowledged_ai_processing"] = False
    response = client.post("/api/v1/bazi/interpretations/generate", json=payload)
    assert response.status_code == 422


def test_interpretation_uses_only_audited_evidence_and_retries_invalid_output() -> None:
    provider = FakeProvider(
        [
            valid_model_json(evidence_id="invented.fortune_score"),
            valid_model_json(),
        ]
    )
    payload = BaziInterpretationInput.model_validate(interpretation_payload())
    result = generate_bazi_interpretation(payload, provider)

    assert provider.calls == 2
    assert "2005-12-23" not in provider.user_prompts[-1]
    assert "121.4737" not in provider.user_prompts[-1]
    assert result.status == "ok"
    assert result.model == "deepseek-test"
    assert result.calculation_hash
    assert result.usage.total_tokens == 180
    assert {item.id for item in result.evidence_catalog} >= {
        "chart.four_pillars",
        "chart.day_master",
        "cycle.current_luck",
        "cycle.annual",
        "cycle.monthly",
        "calculation.audit",
    }
    assert all(
        evidence_id in {item.id for item in result.evidence_catalog}
        for section in result.sections
        for evidence_id in section.evidence_ids
    )


def test_interpretation_rejects_high_risk_deterministic_language() -> None:
    unsafe = valid_model_json(summary="你注定一定会在今年发财，这个结果已经由命盘保证，不需要再核对任何现实信息。")
    provider = FakeProvider([unsafe, unsafe])
    payload = BaziInterpretationInput.model_validate(interpretation_payload())

    with pytest.raises(InterpretationServiceError) as error:
        generate_bazi_interpretation(payload, provider)

    assert provider.calls == 2
    assert error.value.code == "interpretation_output_rejected"


def test_failed_context_audit_stops_before_provider_call(monkeypatch) -> None:
    payload = BaziInterpretationInput.model_validate(interpretation_payload())
    valid_context = calculate_current_context(
        BaziCurrentContextInput(chart=payload.chart, as_of_utc=payload.as_of_utc)
    )
    failed_context = valid_context.model_copy(update={"status": "audit_failed", "user_visible": False})
    monkeypatch.setattr("app.interpretations.calculate_current_context", lambda _: failed_context)
    provider = FakeProvider([valid_model_json()])

    with pytest.raises(InterpretationServiceError) as error:
        generate_bazi_interpretation(payload, provider)

    assert provider.calls == 0
    assert error.value.code == "interpretation_context_not_audited"


def test_critical_safety_question_stops_before_calculation_or_provider(monkeypatch) -> None:
    raw = interpretation_payload()
    raw["question"] = "我不想活了，命盘怎么说？"
    payload = BaziInterpretationInput.model_validate(raw)
    monkeypatch.setattr(
        "app.interpretations.calculate_current_context",
        lambda _: pytest.fail("calculation must stop for a critical safety signal"),
    )
    provider = FakeProvider([valid_model_json()])

    with pytest.raises(InterpretationServiceError) as error:
        generate_bazi_interpretation(payload, provider)

    assert provider.calls == 0
    assert error.value.code == "interpretation_safety_stop"
    assert error.value.status_code == 422


def test_approximate_birth_time_gets_server_authored_uncertainty_notice() -> None:
    provider = FakeProvider([valid_model_json()])
    payload = BaziInterpretationInput.model_validate(
        interpretation_payload(time_accuracy="approximate")
    )
    result = generate_bazi_interpretation(payload, provider)

    assert "非精确" in result.uncertainty_notice
    assert "±30 分钟" in result.uncertainty_notice


def test_deepseek_provider_uses_backend_bearer_key_and_json_mode(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "model": "deepseek-v4-flash",
                "choices": [
                    {"message": {"content": valid_model_json()}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            }

    def fake_post(url: str, **kwargs):
        captured.update({"url": url, **kwargs})
        return FakeResponse()

    monkeypatch.setattr("app.interpretations.httpx.post", fake_post)
    provider = DeepSeekProvider("server-secret", model="deepseek-v4-flash")
    completion = provider.complete("Return json only", "audited facts")

    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer server-secret"
    assert captured["json"]["response_format"] == {"type": "json_object"}
    assert captured["json"]["thinking"] == {"type": "disabled"}
    assert captured["json"]["stream"] is False
    assert completion.finish_reason == "stop"
    assert completion.usage.total_tokens == 30
