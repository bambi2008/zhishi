import json

import pytest
from fastapi.testclient import TestClient

from app.interpretations import (
    InterpretationServiceError,
    InterpretationUsage,
    ProviderCompletion,
)
from app.main import app
from app.reflections import ReflectionTurnInput, generate_reflection_turn


client = TestClient(app)


def reflection_payload(*, with_reply: bool = False) -> dict:
    payload = {
        "fact": "老板要求重做方案，同事说客户下周可能要结果，我的确认消息还没有得到回复。",
        "emotion": "无力",
        "interpretation": "我觉得所有事情都在等我兜底。",
        "worry": "我担心继续返工，也担心家里人觉得我不在意他们。",
        "next_question": "我明天应该先处理工作还是先回复家里？",
        "conversation": [],
        "response_mode": "auto",
        "language": "zh-CN",
        "acknowledged_ai_processing": True,
    }
    if with_reply:
        payload["conversation"] = [
            {"role": "assistant", "content": "如果明天只能消除一个不确定性，哪一个会最影响后续安排？"},
            {"role": "user", "content": "工作截止时间最关键，因为目前没人说清楚客户到底什么时候要。"},
        ]
    return payload


def clarify_json(*, evidence_ids: list[str] | None = None, hypothesis: str | None = None) -> str:
    return json.dumps(
        {
            "phase": "clarify",
            "headline": "现在缺的不是更多任务，而是一个会改变排序的事实",
            "what_i_heard": "你同时背着工作范围不清和家庭回应未完成两件事，无力感来自两个方向都在等待你给出动作。",
            "hypothesis": hypothesis or "一种可能的假设是，真正卡住你的不是工作和家里谁更重要，而是工作截止时间尚未被确认。",
            "evidence_ids": evidence_ids or ["entry.fact", "entry.emotion", "entry.next_question"],
            "clarification_question": "如果明天只能消除一个不确定性，哪一个答案最会改变你接下来的安排？",
            "options": [],
            "next_step": None,
            "verification_question": None,
            "cautions": ["这只是依据你当前输入形成的工作假设，不代表他人的真实动机。"],
        },
        ensure_ascii=False,
    )


def synthesis_json(*, evidence_ids: list[str] | None = None) -> str:
    return json.dumps(
        {
            "phase": "synthesis",
            "headline": "先解除会改变全局的工作不确定性，再给家里一个明确回应",
            "what_i_heard": "你补充说明工作截止时间会直接改变后续安排，因此它是当前排序的关键变量；回复家里仍然重要，但不需要等到所有工作问题解决后才做。",
            "hypothesis": "目前更可能的情况是，先确认截止时间能降低大部分混乱，而给家里一个简短且有时间点的回复可以避免第二件事继续占用注意力。",
            "evidence_ids": evidence_ids or ["entry.fact", "entry.worry", "dialogue.user_1"],
            "clarification_question": None,
            "options": [
                {
                    "title": "先确认工作边界",
                    "when_it_fits": "当客户截止时间会改变你明天全部排期时，这个顺序最合适。",
                    "tradeoff": "短时间内仍会保留家里的未回复感，需要随后补一个明确回应。",
                },
                {
                    "title": "先给家里一个两分钟回复",
                    "when_it_fits": "当你已经知道无法立刻解决工作问题、但可以先降低关系压力时适合。",
                    "tradeoff": "它不会解决工作范围不清，回复后仍要马上回到截止时间确认。",
                },
            ],
            "next_step": "明早先发一条只问截止时间和交付范围的消息；等待回复时，用两分钟告诉家里你何时能确认周末安排。",
            "verification_question": "完成这两条消息后，你是否能清楚说出明天第一小时只做哪一件事？",
            "cautions": ["这是基于你当前描述的排序建议，不替你判断雇佣关系或家庭成员的真实想法。"],
        },
        ensure_ascii=False,
    )


class FakeProvider:
    model = "deepseek-test"

    def __init__(self, contents: list[str]) -> None:
        self.contents = contents
        self.calls = 0
        self.user_prompts: list[str] = []

    def complete(self, system_prompt: str, user_prompt: str) -> ProviderCompletion:
        assert "Return JSON only" in system_prompt
        assert "allowed_evidence_ids" in user_prompt
        self.user_prompts.append(user_prompt)
        index = min(self.calls, len(self.contents) - 1)
        self.calls += 1
        return ProviderCompletion(
            content=self.contents[index],
            finish_reason="stop",
            model=self.model,
            usage=InterpretationUsage(prompt_tokens=120, completion_tokens=90, total_tokens=210),
        )


def test_reflection_endpoint_requires_backend_provider_configuration(monkeypatch) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    response = client.post("/api/v1/reflections/conversation/turn", json=reflection_payload())
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "interpretation_provider_not_configured"
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_reflection_requires_explicit_ai_processing_acknowledgement() -> None:
    payload = reflection_payload()
    payload["acknowledged_ai_processing"] = False
    response = client.post("/api/v1/reflections/conversation/turn", json=payload)
    assert response.status_code == 422


def test_first_turn_asks_one_grounded_clarifying_question() -> None:
    provider = FakeProvider([clarify_json()])
    payload = ReflectionTurnInput.model_validate(reflection_payload())
    result = generate_reflection_turn(payload, provider)

    assert result.phase == "clarify"
    assert result.clarification_question
    assert result.options == []
    assert result.next_step is None
    assert result.model == "deepseek-test"
    assert result.usage.total_tokens == 210
    assert "老板要求重做方案" in provider.user_prompts[0]
    assert {item.id for item in result.evidence_catalog} >= {
        "entry.fact",
        "entry.emotion",
        "entry.interpretation",
        "entry.worry",
        "entry.next_question",
    }


def test_user_reply_produces_options_tradeoffs_and_next_step() -> None:
    provider = FakeProvider([synthesis_json()])
    payload = ReflectionTurnInput.model_validate(reflection_payload(with_reply=True))
    result = generate_reflection_turn(payload, provider)

    assert result.phase == "synthesis"
    assert len(result.options) == 2
    assert result.next_step
    assert result.verification_question
    assert "dialogue.user_1" in result.evidence_ids
    assert any(item.id == "dialogue.user_1" for item in result.evidence_catalog)


def test_reflection_retries_unknown_evidence_and_requires_latest_reply() -> None:
    provider = FakeProvider(
        [
            synthesis_json(evidence_ids=["entry.fact", "invented.motive"]),
            synthesis_json(evidence_ids=["entry.fact", "entry.worry", "dialogue.user_1"]),
        ]
    )
    payload = ReflectionTurnInput.model_validate(reflection_payload(with_reply=True))
    result = generate_reflection_turn(payload, provider)

    assert provider.calls == 2
    assert result.phase == "synthesis"


def test_reflection_rejects_unqualified_hypothesis() -> None:
    unsafe_hypothesis = "老板就是不认可你的能力，同事也在故意回避责任，这已经可以确定。"
    provider = FakeProvider(
        [
            clarify_json(hypothesis=unsafe_hypothesis),
            clarify_json(),
        ]
    )
    payload = ReflectionTurnInput.model_validate(reflection_payload())
    result = generate_reflection_turn(payload, provider)

    assert provider.calls == 2
    assert "可能" in result.hypothesis or "假设" in result.hypothesis


def test_critical_safety_signal_stops_before_provider_call() -> None:
    payload_dict = reflection_payload()
    payload_dict["worry"] = "我不想活了，也想伤害自己。"
    payload = ReflectionTurnInput.model_validate(payload_dict)
    provider = FakeProvider([clarify_json()])

    with pytest.raises(InterpretationServiceError) as error:
        generate_reflection_turn(payload, provider)

    assert provider.calls == 0
    assert error.value.code == "reflection_safety_stop"
    assert error.value.status_code == 422


def test_conversation_must_be_an_alternating_assistant_user_transcript() -> None:
    payload = reflection_payload()
    payload["conversation"] = [{"role": "user", "content": "直接给我建议"}]
    response = client.post("/api/v1/reflections/conversation/turn", json=payload)
    assert response.status_code == 422
