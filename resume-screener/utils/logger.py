"""Structured JSON logger setup with trace_id support."""

import logging
import json
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Formats log records as structured JSON for Azure Monitor compatibility."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
            "level": record.levelname,
            "stage": getattr(record, "stage", "general"),
            "trace_id": getattr(record, "trace_id", ""),
            "message": record.getMessage(),
        }
        # Add optional fields
        if hasattr(record, "tokens_used"):
            log_entry["tokens_used"] = record.tokens_used
        if hasattr(record, "file_name"):
            log_entry["file_name"] = record.file_name
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def get_logger(name: str = "resume-screener") -> logging.Logger:
    """Get a configured logger instance with JSON formatting."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def log_with_context(logger: logging.Logger, level: str, message: str, **kwargs):
    """Log a message with additional context fields."""
    extra = {k: v for k, v in kwargs.items()}
    record = logger.makeRecord(
        logger.name,
        getattr(logging, level.upper(), logging.INFO),
        "",
        0,
        message,
        args=None,
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    logger.handle(record)
