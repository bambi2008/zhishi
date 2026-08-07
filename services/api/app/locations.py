from __future__ import annotations

from functools import lru_cache
import os
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from pydantic import BaseModel, Field


DEFAULT_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
CUSTOMER_GEOCODING_URL = "https://customer-geocoding-api.open-meteo.com/v1/search"


class LocationSearchError(RuntimeError):
    """Raised when the location provider cannot return trustworthy results."""


class LocationSearchInput(BaseModel):
    query: str = Field(min_length=2, max_length=80)
    language: str = Field(default="zh", pattern=r"^[a-z]{2}$")
    limit: int = Field(default=6, ge=1, le=10)


class LocationSearchResult(BaseModel):
    provider_id: int
    name: str
    display_name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    iana_timezone: str
    country_code: str | None = None
    country: str | None = None
    admin1: str | None = None
    provider: Literal["open-meteo-geonames"] = "open-meteo-geonames"
    attribution: str = "Location data: Open-Meteo / GeoNames"


def _display_name(item: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("name", "admin1", "country"):
        value = str(item.get(key) or "").strip()
        if value and value not in parts:
            parts.append(value)
    return " · ".join(parts)


def _provider_settings() -> tuple[str, str | None]:
    api_key = os.getenv("OPEN_METEO_API_KEY") or None
    configured_url = os.getenv("ZHISHI_GEOCODING_URL")
    if configured_url:
        return configured_url, api_key
    return (CUSTOMER_GEOCODING_URL if api_key else DEFAULT_GEOCODING_URL), api_key


@lru_cache(maxsize=256)
def search_locations(query: str, language: str = "zh", limit: int = 6) -> tuple[LocationSearchResult, ...]:
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        return ()

    endpoint, api_key = _provider_settings()
    params: dict[str, str | int] = {
        "name": normalized_query,
        "count": limit,
        "language": language,
        "format": "json",
    }
    if api_key:
        params["apikey"] = api_key

    try:
        response = httpx.get(
            endpoint,
            params=params,
            timeout=5.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise LocationSearchError("地点服务暂时不可用，请稍后重试或手动填写。") from exc

    if payload.get("error"):
        raise LocationSearchError(str(payload.get("reason") or "地点服务返回错误。"))

    results: list[LocationSearchResult] = []
    for item in payload.get("results") or []:
        timezone = str(item.get("timezone") or "").strip()
        try:
            ZoneInfo(timezone)
        except (ZoneInfoNotFoundError, ValueError):
            continue

        try:
            results.append(
                LocationSearchResult(
                    provider_id=int(item["id"]),
                    name=str(item["name"]),
                    display_name=_display_name(item),
                    latitude=float(item["latitude"]),
                    longitude=float(item["longitude"]),
                    iana_timezone=timezone,
                    country_code=item.get("country_code"),
                    country=item.get("country"),
                    admin1=item.get("admin1"),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return tuple(results)
