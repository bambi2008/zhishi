from fastapi.testclient import TestClient

from app.main import app
from app.locations import LocationSearchError, LocationSearchResult


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-frame-options"] == "DENY"
    assert "cache-control" not in response.headers


def test_bazi_calculation_endpoint_returns_audited_chart() -> None:
    response = client.post(
        "/api/v1/bazi/charts/calculate",
        json={
            "local_datetime": "2005-12-23T08:37:00",
            "iana_timezone": "Asia/Shanghai",
            "longitude": 121.4737,
            "gender": "male",
            "solar_time_mode": "civil",
            "day_boundary_rule": "midnight",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pillars"]["year"]["value"] == "乙酉"
    assert body["pillars"]["hour"]["value"] == "壬辰"
    assert body["audit"]["status"] == "passed"
    assert body["luck_cycles"]["audit"]["status"] == "passed"
    assert body["luck_cycles"]["periods"][0]["pillar"]["value"] == "丁亥"


def test_bazi_current_context_endpoint_returns_exact_active_cycles() -> None:
    response = client.post(
        "/api/v1/bazi/context/current",
        json={
            "chart": {
                "local_datetime": "2005-12-23T08:37:00",
                "iana_timezone": "Asia/Shanghai",
                "longitude": 121.4737,
                "gender": "male",
                "solar_time_mode": "civil",
                "day_boundary_rule": "midnight",
            },
            "as_of_utc": "2026-08-07T00:00:00Z",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chart"]["calculation_hash"]
    assert body["current_luck"]["current_period"]["pillar"]["value"] == "丙戌"
    assert body["annual_cycle"]["label_year"] == 2026
    assert body["annual_cycle"]["pillar"]["value"] == "丙午"
    assert body["monthly_cycle"]["pillar"]["value"] == "乙未"
    assert body["monthly_cycle"]["end_boundary"]["name"] == "立秋"
    assert body["audit"]["status"] == "passed"


def test_bazi_current_context_rejects_naive_as_of_time() -> None:
    response = client.post(
        "/api/v1/bazi/context/current",
        json={
            "chart": {
                "local_datetime": "2005-12-23T08:37:00",
                "iana_timezone": "Asia/Shanghai",
                "longitude": 121.4737,
                "gender": "male",
                "solar_time_mode": "civil",
                "day_boundary_rule": "midnight",
            },
            "as_of_utc": "2026-08-07T00:00:00",
        },
    )
    assert response.status_code == 422


def test_ambiguous_dst_time_returns_recoverable_code_and_accepts_explicit_fold() -> None:
    payload = {
        "local_datetime": "2024-11-03T01:30:00",
        "iana_timezone": "America/New_York",
        "longitude": -74.006,
        "solar_time_mode": "civil",
        "day_boundary_rule": "midnight",
    }

    ambiguous = client.post("/api/v1/bazi/charts/calculate", json=payload)
    assert ambiguous.status_code == 422
    assert ambiguous.json()["detail"]["code"] == "ambiguous_local_time"

    first = client.post("/api/v1/bazi/charts/calculate", json={**payload, "dst_fold": 0})
    second = client.post("/api/v1/bazi/charts/calculate", json={**payload, "dst_fold": 1})
    assert first.status_code == second.status_code == 200
    assert first.json()["normalized_times"]["utc_time"] != second.json()["normalized_times"]["utc_time"]
    assert first.json()["calculation_hash"] != second.json()["calculation_hash"]


def test_bazi_context_calculates_normally_for_approximate_birth_time() -> None:
    response = client.post(
        "/api/v1/bazi/context/current",
        json={
            "chart": {
                "local_datetime": "2005-12-23T08:37:00",
                "iana_timezone": "Asia/Shanghai",
                "longitude": 121.4737,
                "gender": "male",
                "time_accuracy": "approximate",
                "solar_time_mode": "civil",
                "day_boundary_rule": "midnight",
            },
            "as_of_utc": "2026-08-07T00:00:00Z",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["user_visible"] is True
    assert body["chart"]["user_visible"] is True
    assert body["chart"]["luck_cycles"]["status"] == "ok"
    assert body["chart"]["luck_cycles"]["user_visible"] is True


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
    response = client.post("/api/v1/locations/search", json={"query": "上海"})
    assert response.status_code == 200
    assert response.json()[0]["iana_timezone"] == "Asia/Shanghai"
    assert response.json()[0]["longitude"] == 121.45806
    assert response.headers["cache-control"] == "no-store, max-age=0"
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["expires"] == "0"


def test_location_provider_failure_is_a_recoverable_503(monkeypatch) -> None:
    def fail_search(query: str, language: str, limit: int):
        raise LocationSearchError("地点服务暂时不可用")

    monkeypatch.setattr("app.main.search_locations", fail_search)
    response = client.post("/api/v1/locations/search", json={"query": "上海"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "location_provider_unavailable"


def test_location_search_rejects_query_string_transport() -> None:
    response = client.get("/api/v1/locations/search", params={"q": "上海"})
    assert response.status_code == 405
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_cors_preflight_is_limited_to_trusted_origins_and_declared_operations() -> None:
    allowed = client.options(
        "/api/v1/locations/search",
        headers={
            "Origin": "http://127.0.0.1:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:8081"
    assert allowed.headers["access-control-allow-methods"] == "GET, POST, OPTIONS"
    assert allowed.headers["cache-control"] == "no-store, max-age=0"

    untrusted = client.options(
        "/api/v1/locations/search",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in untrusted.headers


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


def test_unbound_year_interpretation_is_disabled_instead_of_fabricated() -> None:
    profile = client.post("/api/v1/onboarding", json={"email": "year@example.com"})
    user_id = profile.json()["user_id"]
    response = client.post(f"/api/v1/year-navigation/2026?user_id={user_id}")
    assert response.status_code == 501
    assert response.json()["detail"]["code"] == "year_navigation_requires_chart_context"


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
