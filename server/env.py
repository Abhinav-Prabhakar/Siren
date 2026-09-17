"""Tiny stdlib .env loader — no third-party deps.

Reads server/.env (KEY=VALUE lines, `#` comments, blank lines ignored) into
os.environ using setdefault semantics — real environment variables always win.
Values may optionally be wrapped in matching single/double quotes.
"""
import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"

_loaded = False


def parse_env(path=ENV_PATH) -> dict:
    """Parse a .env file into a dict. Missing file -> {}."""
    out = {}
    try:
        text = Path(path).read_text()
    except OSError:
        return out
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        if key:
            out[key] = val
    return out


def load() -> None:
    """Populate os.environ from server/.env once (never overrides real env)."""
    global _loaded
    if _loaded:
        return
    _loaded = True
    for key, val in parse_env().items():
        os.environ.setdefault(key, val)


def get(key: str, default=None):
    """Read a config value from the process environment."""
    return os.environ.get(key, default)
