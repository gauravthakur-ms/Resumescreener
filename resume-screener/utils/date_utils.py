"""Date parsing and duration utilities — migrated from original scan-resume.py."""

import re
from datetime import datetime
from dateutil.relativedelta import relativedelta


def parse_month_year(s: str) -> datetime | None:
    """Convert various month-year formats to datetime.
    
    Supports: Jan2021, Jan 2021, January2021, January 2021, 2021,
              01/2021, 1/2021
    """
    if not s:
        return None
    s = s.strip()
    if not s:
        return None

    # Handle MM/YYYY format
    slash_match = re.match(r"^(\d{1,2})/(\d{4})$", s)
    if slash_match:
        month, year = int(slash_match.group(1)), int(slash_match.group(2))
        if 1 <= month <= 12:
            return datetime(year, month, 1)

    formats = [
        "%b%Y",     # Jan2021
        "%b %Y",    # Jan 2021
        "%B%Y",     # January2021
        "%B %Y",    # January 2021
        "%Y",       # 2021
    ]

    # Normalize: take first 3 chars + last 4 chars for abbreviated month-year
    if len(s) > 4:
        value = s[:3] + s[-4:]
    else:
        value = s

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    # Try full string as fallback
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue

    return None


def duration_in_years(duration_str: str) -> float:
    """Calculate duration in years from a 'Start-End' string.
    
    Returns 0.0 if parsing fails.
    """
    if not duration_str or duration_str == "NDATA":
        return 0.0

    # Split on common separators
    parts = re.split(r"[-–—]", duration_str, maxsplit=1)
    if len(parts) != 2:
        return 0.0

    start = parse_month_year(parts[0].strip())
    end = parse_month_year(parts[1].strip())

    if start is None or end is None:
        return 0.0

    # If end date is current month & year, use today
    today = datetime.today()
    if end.year == today.year and end.month == today.month:
        end = today

    months = (end.year - start.year) * 12 + (end.month - start.month)
    return round(max(months / 12.0, 0), 1)


def replace_current_markers(text: str, max_replacements: int = 10) -> str:
    """Replace 'Present', 'Now', 'Current', 'Till now' etc. with current month-year."""
    current_date = datetime.now().strftime("%B%Y")
    pattern = r"(?i)\b(?:present|current|now|till\s+now|to\s+present|till\s+date)\b"
    return re.sub(pattern, current_date, text, count=max_replacements)


def months_since(date_str: str) -> int:
    """Calculate months between a date string and today. Returns -1 on failure."""
    dt = parse_month_year(date_str)
    if dt is None:
        return -1
    today = datetime.today()
    return (today.year - dt.year) * 12 + (today.month - dt.month)


def is_stale_resume(last_work_date: str, threshold_months: int = 6) -> bool:
    """Check if the resume's last work date is older than threshold."""
    months = months_since(last_work_date)
    if months < 0:
        return False
    return months > threshold_months
