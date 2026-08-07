from __future__ import annotations

import argparse
import json
import random
import time
from datetime import UTC, datetime, timedelta

from app.bazi import (
    BaziCalculationInput,
    BaziCurrentContextInput,
    calculate_current_context,
)
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
    context_statuses = {"pre_luck": 0, "active": 0, "out_of_range": 0}
    skipped = 0
    uncertain_inputs = 0
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
            time_accuracy = "approximate" if index % 4 == 0 else "exact"
            if time_accuracy != "exact":
                uncertain_inputs += 1
            chart_input = BaziCalculationInput(
                local_datetime=wall_time,
                iana_timezone=timezone_name,
                longitude=longitude,
                time_accuracy=time_accuracy,
                uncertainty_minutes=30 if time_accuracy == "approximate" else 0,
                dst_fold=0,
                gender="male" if index % 2 else "female",
                luck_start_rule="precise_minutes" if index % 3 else "traditional_segments",
                solar_time_mode=("civil", "mean_solar", "apparent_solar")[index % 3],
                day_boundary_rule="late_zi_next_day" if index % 2 else "midnight",
            )
            relative_days = -365 if index % 5 == 0 else randomizer.randrange(1, 96 * 365)
            as_of_utc = (wall_time + timedelta(days=relative_days)).replace(tzinfo=UTC)
            context = calculate_current_context(
                BaziCurrentContextInput(chart=chart_input, as_of_utc=as_of_utc)
            )
            result = context.chart
        except TimeNormalizationError:
            skipped += 1
            continue

        context_statuses[context.current_luck.status] += 1
        if time_accuracy != "exact" and (
            context.status != "ambiguous"
            or context.user_visible
            or result.luck_cycles is None
            or result.luck_cycles.user_visible
        ):
            failures.append(
                {
                    "wall_time": wall_time.isoformat(),
                    "as_of_utc": as_of_utc.isoformat(),
                    "timezone": timezone_name,
                    "checks": [
                        {
                            "name": "uncertain_cycle_fail_closed",
                            "primary": context.status,
                            "verification": "ambiguous and hidden",
                        }
                    ],
                }
            )
            continue
        failed_checks = [check for check in result.audit.checks if check.status == "failed"]
        if result.luck_cycles:
            failed_checks.extend(
                check for check in result.luck_cycles.audit.checks if check.status == "failed"
            )
        failed_checks.extend(check for check in context.audit.checks if check.status == "failed")
        if failed_checks:
            failures.append(
                {
                    "wall_time": wall_time.isoformat(),
                    "as_of_utc": as_of_utc.isoformat(),
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
        "uncertain_inputs": uncertain_inputs,
        "current_luck_statuses": context_statuses,
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
