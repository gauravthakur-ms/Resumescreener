"""Risk analyzer — detects gaps, overlaps, job hopping, freshness, domain shifts."""

import re
from datetime import datetime
from dateutil.relativedelta import relativedelta
from utils.date_utils import parse_month_year, is_stale_resume
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def analyze_risks(
    individual_exp: list[dict],
    last_work_date: str,
    domain_classification: str,
    trace_id: str = "",
) -> tuple[list[str], str, str]:
    """Analyze candidate risks from experience data.
    
    Returns:
        tuple: (risk_flags, gaps_description, discrepancy_description)
    """
    risk_flags = []
    gaps = []
    discrepancies = []

    # Parse and sort jobs by start date
    jobs = []
    for entry in individual_exp:
        start_end = entry.get("start_end", "NDATA")
        if start_end == "NDATA" or not start_end:
            continue

        parts = re.split(r"[-–—]", start_end, maxsplit=1)
        if len(parts) != 2:
            continue

        start = parse_month_year(parts[0].strip())
        end = parse_month_year(parts[1].strip())
        if start is None or end is None:
            continue

        jobs.append({
            "organization": entry.get("organization", "Unknown"),
            "start": start,
            "end": end,
            "duration_years": entry.get("duration_years", 0),
        })

    jobs.sort(key=lambda x: x["start"])

    # --- Job hopping detection ---
    short_stints = [j for j in jobs if j["duration_years"] < 1.0 and j["duration_years"] > 0]
    if len(short_stints) >= 3:
        risk_flags.append(f"Job hopper: {len(short_stints)} roles under 1 year")
    elif len(short_stints) >= 2:
        risk_flags.append(f"{len(short_stints)} short-term roles (< 1 year)")

    # --- Gap and overlap detection ---
    for i in range(len(jobs) - 1):
        current = jobs[i]
        nxt = jobs[i + 1]

        if nxt["start"] > current["end"]:
            # GAP
            diff = relativedelta(nxt["start"], current["end"])
            total_months = diff.years * 12 + diff.months
            if total_months > 1:  # Only flag gaps > 1 month
                if diff.years > 0:
                    gap_str = f"{diff.years} year(s) {diff.months} month(s) gap between {current['organization']} and {nxt['organization']}"
                else:
                    gap_str = f"{diff.months} month(s) gap between {current['organization']} and {nxt['organization']}"
                gaps.append(gap_str)

                if total_months > 6:
                    risk_flags.append(f"Employment gap: {total_months} months between {current['organization']} and {nxt['organization']}")

        elif nxt["start"] < current["end"]:
            # OVERLAP
            diff = relativedelta(current["end"], nxt["start"])
            total_months = diff.years * 12 + diff.months
            if total_months > 1:  # More than 1 month overlap
                disc_str = f"Dual employment: {current['organization']} and {nxt['organization']} overlap"
                discrepancies.append(disc_str)
                risk_flags.append(disc_str)

    # --- Resume freshness ---
    if last_work_date and last_work_date != "NDATA":
        if is_stale_resume(last_work_date):
            from utils.date_utils import months_since
            months = months_since(last_work_date)
            risk_flags.append(f"Resume freshness: last role ended {months} months ago")

    # --- Short tenure at individual companies ---
    for j in jobs:
        if 0 < j["duration_years"] < 0.5:
            risk_flags.append(f"Short tenure: {j['organization']} ({round(j['duration_years'] * 12)} months)")

    # Build descriptions
    gaps_desc = "; ".join(gaps) if gaps else "No Gap"
    disc_desc = "; ".join(discrepancies) if discrepancies else "No Discrepancy"

    return risk_flags, gaps_desc, disc_desc
