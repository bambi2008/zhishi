import json

import pytest
from fastapi.testclient import TestClient

from app.guidance import GuidanceTurnInput, generate_guidance_turn
from app.interpretations import (
    InterpretationServiceError,
    InterpretationUsage,
    ProviderCompletion,
)
from app.main import app


client = TestClient(app)


def chart_payload() -> dict:
    return {
        "local_datetime": "2005-12-23T08:37:00",
        "iana_timezone": "Asia/Shanghai",
        "longitude": 121.4737,
        "gender": "male",
        "time_accuracy": "exact",
        "solar_time_mode": "civil",
        "day_boundary_rule": "midnight",
    }


def guidance_payload(*, with_chart: bool = False, with_reply: bool = False) -> dict:
    conversation = [
        {
            "role": "user",
            "content": "你说事业有潜力但要稳健，我今天到底应该做什么？",
        }
    ]
    if with_reply:
        conversation.extend(
            [
                {
                    "role": "assistant",
                    "content": "先确认最影响排期的事实，并把下一步缩小到一份能在今天完成的文件。你目前最不确定的是范围、截止时间，还是谁来决定？",
                },
                {
                    "role": "user",
                    "content": "最不确定的是客户到底什么时候要，以及这次要不要包含预算表。",
                },
            ]
        )
    payload = {
        "scope": "today",
        "as_of_utc": "2026-08-30T02:00:00Z",
        "daily_state": {
            "local_date": "2026-08-30",
            "energy": 3,
            "stress": 4,
            "emotion": "有点乱",
            "focus_area": "事业",
            "important_event": "客户希望方案尽快推进，但交付范围还没确认。",
            "note": "我不想再做一堆最后用不上的材料。",
        },
        "conversation": conversation,
        "language": "zh-CN",
        "acknowledged_ai_processing": True,
    }
    if with_chart:
        payload["chart"] = chart_payload()
    return payload


def valid_guidance_json(
    *,
    evidence_ids: list[str] | None = None,
    direct_answer: str | None = None,
) -> str:
    return json.dumps(
        {
            "headline": "今天先确认交付边界，再决定做哪一份文件",
            "direct_answer": direct_answer
            or "这里的“稳健”不是慢下来，而是先拿到会改变工作量的两个事实：截止时间和是否需要预算表。确认前只做不会返工的骨架，不把精力押在未经确认的细节上。",
            "next_step": {
                "action": "给客户发一条只确认截止时间和预算表范围的消息，同时新建一页方案目录。",
                "when": "今天上午的第一个三十分钟内",
                "done_when": "消息已发出，目录列出最多五个章节，并标明哪些内容等待确认。",
            },
            "examples": [
                {
                    "title": "事业推进",
                    "situation": "客户说尽快，但没有给出明确日期或验收范围时。",
                    "try_this": "直接写：为避免返工，请确认本周五前需要方案正文，还是需要同时附预算表；我收到后按这个范围排期。",
                    "watch_for": "如果对方仍只回复尽快，不要自行补全范围，改为给出两个可选择的交付版本。",
                },
                {
                    "title": "关系沟通",
                    "situation": "同事催进度，但他也没有拿到最终范围时。",
                    "try_this": "告诉对方你已经发出两项确认，并约定收到回复后十分钟内同步新版目录和负责人。",
                    "watch_for": "避免把“对方着急”解释成对你不满，只记录对方明确说过的期限和要求。",
                },
            ],
            "watchouts": ["如果截止时间会影响合同、收入或岗位责任，请把确认留在可追溯的书面渠道。"],
            "evidence_ids": evidence_ids or ["dialogue.user_1", "reality.important_event"],
            "follow_up_question": "现在最可能决定你工作量的，是截止时间、预算表范围，还是最终拍板的人？",
        },
        ensure_ascii=False,
    )


class FakeProvider:
    model = "deepseek-test"

    def __init__(self, contents: list[str]) -> None:
        self.contents = contents
        self.calls = 0
        self.system_prompts: list[str] = []
        self.user_prompts: list[str] = []

    def complete(self, system_prompt: str, user_prompt: str) -> ProviderCompletion:
        assert "Return JSON only" in system_prompt
        assert "allowed_evidence_ids" in user_prompt
        self.system_prompts.append(system_prompt)
        self.user_prompts.append(user_prompt)
        index = min(self.calls, len(self.contents) - 1)
        self.calls += 1
        return ProviderCompletion(
            content=self.contents[index],
            finish_reason="stop",
            model=self.model,
            usage=InterpretationUsage(prompt_tokens=150, completion_tokens=180, total_tokens=330),
        )


def test_reality_only_turn_answers_before_asking_one_question() -> None:
    provider = FakeProvider([valid_guidance_json()])
    payload = GuidanceTurnInput.model_validate(guidance_payload())
    result = generate_guidance_turn(payload, provider)

    assert result.status == "ok"
    assert result.context_mode == "reality_only"
    assert result.calculation_hash is None
    assert result.next_step.action
    assert len(result.examples) == 2
    assert result.follow_up_question.count("？") == 1
    assert "dialogue.user_1" in result.evidence_ids
    assert result.usage.total_tokens == 330
    assert "No bazi chart is supplied" in provider.system_prompts[0]


def test_chart_grounded_turn_requires_calculation_and_latest_user_evidence() -> None:
    provider = FakeProvider(
        [valid_guidance_json(evidence_ids=["chart.day_master", "dialogue.user_1"])]
    )
    payload = GuidanceTurnInput.model_validate(guidance_payload(with_chart=True))
    result = generate_guidance_turn(payload, provider)

    assert result.context_mode == "audited_chart_and_reality"
    assert result.calculation_hash
    assert {item.source for item in result.evidence_catalog} == {"calculation", "reality"}


def test_follow_up_rewrites_answer_and_requires_latest_reply() -> None:
    provider = FakeProvider(
        [
            valid_guidance_json(evidence_ids=["dialogue.user_1"]),
            valid_guidance_json(evidence_ids=["dialogue.user_2", "reality.important_event"]),
        ]
    )
    payload = GuidanceTurnInput.model_validate(guidance_payload(with_reply=True))
    result = generate_guidance_turn(payload, provider)

    assert provider.calls == 2
    assert "dialogue.user_2" in result.evidence_ids
    assert "Rewrite the full provisional guidance" in provider.user_prompts[-1]


def test_guidance_rejects_trade_direction() -> None:
    unsafe = valid_guidance_json(
        direct_answer="根据你现在的情况，建议你现在买入并逐步加仓，这会是最明确而且最稳健的行动方案。"
    )
    provider = FakeProvider([unsafe, unsafe])
    payload = GuidanceTurnInput.model_validate(guidance_payload())

    with pytest.raises(InterpretationServiceError) as error:
        generate_guidance_turn(payload, provider)

    assert provider.calls == 2
    assert error.value.code == "guidance_output_rejected"


def test_critical_safety_signal_stops_before_provider() -> None:
    raw = guidance_payload()
    raw["conversation"][0]["content"] = "我不想活了，你告诉我今天怎么办。"
    payload = GuidanceTurnInput.model_validate(raw)
    provider = FakeProvider([valid_guidance_json()])

    with pytest.raises(InterpretationServiceError) as error:
        generate_guidance_turn(payload, provider)

    assert provider.calls == 0
    assert error.value.code == "guidance_safety_stop"
    assert error.value.status_code == 422


def test_guidance_endpoint_requires_provider_configuration(monkeypatch) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    response = client.post("/api/v1/guidance/conversation/turn", json=guidance_payload())

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "interpretation_provider_not_configured"
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_guidance_requires_acknowledgement_and_alternating_transcript() -> None:
    no_ack = guidance_payload()
    no_ack["acknowledged_ai_processing"] = False
    assert client.post("/api/v1/guidance/conversation/turn", json=no_ack).status_code == 422

    invalid_transcript = guidance_payload()
    invalid_transcript["conversation"].append({"role": "user", "content": "再说具体一点。"})
    assert (
        client.post("/api/v1/guidance/conversation/turn", json=invalid_transcript).status_code
        == 422
    )
