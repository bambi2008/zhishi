from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timedelta

from app.bazi import BaziCalculationInput, calculate_chart
from app.bazi.solar_time import TimeNormalizationError


LOCATIONS = (
    ("Asia/Shanghai", 121.4737),
    ("America/New_York", -74.0060),
    ("Europe/London", -0.1276),
    ("Asia/Tokyo", 139.6917),
    ("Australia/Sydney", 151.2093),
)


def verify(cases: int, seed: int) -> dict:
    randomizer = random.Random(seed)
    first_day = datetime(1901, 1, 1)
    day_span = (datetime(2099, 12, 31) - first_day).days
    failures: list[dict] = []
    skipped = 0
    started = time.perf_counter()

    for index in range(cases):
        timezone_name, longitude = LOCATIONS[index % len(LOCATIONS)]
        day = first_day + timedelta(days=randomizer.randrange(day_span))
        wall_time = day.replace(
            hour=randomizer.randrange(24),
            minute=randomizer.randrange(60),
            second=randomizer.randrange(60),
        )
        try:
            result = calculate_chart(
                BaziCalculationInput(
                    local_datetime=wall_time,
                    iana_timezone=timezone_name,
                    longitude=longitude,
                    uncertainty_minutes=0,
                    dst_fold=0,
                    gender="male" if index % 2 else "female",
                    luck_start_rule="precise_minutes" if index % 3 else "traditional_segments",
                    solar_time_mode=("civil", "mean_solar", "apparent_solar")[index % 3],
                    day_boundary_rule="late_zi_next_day" if index % 2 else "midnight",
                )
            )
        except TimeNormalizationError:
            skipped += 1
            continue

        failed_checks = [check for check in result.audit.checks if check.status == "failed"]
        if result.luck_cycles:
            failed_checks.extend(
                check for check in result.luck_cycles.audit.checks if check.status == "failed"
            )
        if failed_checks:
            failures.append(
                {
                    "wall_time": wall_time.isoformat(),
                    "timezone": timezone_name,
                    "checks": [
                        {
                            "name": check.name,
                            "primary": check.primary_value,
                            "verification": check.verification_value,
                        }
                        for check in failed_checks
                    ],
                }
            )

    return {
        "cases": cases,
        "evaluated": cases - skipped,
        "skipped_invalid_wall_times": skipped,
        "failures": len(failures),
        "failure_samples": failures[:10],
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "seed": seed,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deterministic dual-engine BaZi verification cases.")
    parser.add_argument("--cases", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20260807)
    args = parser.parse_args()
    report = verify(args.cases, args.seed)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
