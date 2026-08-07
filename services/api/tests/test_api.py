from fastapi.testclient import TestClient

from app.main import app
from app.locations import LocationSearchError, LocationSearchResult


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_bazi_calculation_endpoint_returns_audited_chart() -> None:
    response = client.post(
        "/api/v1/bazi/charts/calculate",
        json={
            "local_datetime": "2005-12-23T08:37:00",
            "iana_timezone": "Asia/Shanghai",
            "longitude": 121.4737,
            "solar_time_mode": "civil",
            "day_boundary_rule": "midnight",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pillars"]["year"]["value"] == "乙酉"
    assert body["pillars"]["hour"]["value"] == "壬辰"
    assert body["audit"]["status"] == "passed"


def test_location_search_returns_calculation_ready_fields(monkeypatch) -> None:
    def fake_search(query: str, language: str, limit: int):
        assert (query, language, limit) == ("上海", "zh", 6)
        return (
            LocationSearchResult(
                provider_id=1796236,
                name="上海",
                display_name="上海 · 中国",
                latitude=31.22222,
                longitude=121.45806,
                iana_timezone="Asia/Shanghai",
                country_code="CN",
                country="中国",
            ),
        )

    monkeypatch.setattr("app.main.search_locations", fake_search)
    response = client.get("/api/v1/locations/search", params={"q": "上海"})
    assert response.status_code == 200
    assert response.json()[0]["iana_timezone"] == "Asia/Shanghai"
    assert response.json()[0]["longitude"] == 121.45806


def test_location_provider_failure_is_a_recoverable_503(monkeypatch) -> None:
    def fail_search(query: str, language: str, limit: int):
        raise LocationSearchError("地点服务暂时不可用")

    monkeypatch.setattr("app.main.search_locations", fail_search)
    response = client.get("/api/v1/locations/search", params={"q": "上海"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "location_provider_unavailable"


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
