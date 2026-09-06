from __future__ import annotations

from datetime import date
from uuid import UUID

from .models import DailyCheckIn, DailyGuidance, LifeChapter, UserProfile, YearNavigation


class MemoryStore:
    """开发期内存存储；后续替换为 PostgreSQL repository。"""

    def __init__(self) -> None:
        self.users: dict[UUID, UserProfile] = {}
        self.checkins: dict[UUID, list[DailyCheckIn]] = {}
        self.guidance: dict[UUID, list[DailyGuidance]] = {}
        self.chapters: dict[UUID, list[LifeChapter]] = {}
        self.years: dict[tuple[UUID, int], YearNavigation] = {}

    def latest_checkin(self, user_id: UUID) -> DailyCheckIn | None:
        items = self.checkins.get(user_id, [])
        return items[-1] if items else None

    def today_guidance(self, user_id: UUID) -> DailyGuidance | None:
        items = self.guidance.get(user_id, [])
        today = date.today()
        return next((item for item in reversed(items) if item.date == today), None)


store = MemoryStore()
