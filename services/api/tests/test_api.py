from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_onboarding_and_guidance_have_evidence_chain() -> None:
    profile = client.post(
        "/api/v1/onboarding",
        json={"email": "test@example.com", "focus_area": "career", "current_question": "是否换工作"},
    )
    assert profile.status_code == 200
    user_id = profile.json()["user_id"]
    guidance = client.post(f"/api/v1/daily/guidance/generate?user_id={user_id}")
    assert guidance.status_code == 200
    assert guidance.json()["reasoning"]["evidence_chain"]


def test_safety_signal_stops_normal_guidance() -> None:
    profile = client.post("/api/v1/onboarding", json={"email": "safe@example.com"})
    user_id = profile.json()["user_id"]
    session = client.post(
        f"/api/v1/anxiety/session?user_id={user_id}",
        json={"raw_input": "我不想活了", "emotion": "绝望"},
    )
    assert session.status_code == 200
    assert session.json()["risk_level"] == "critical"
    assert "stop_divination" in session.json()["safety_flags"]
