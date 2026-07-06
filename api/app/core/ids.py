import re
import unicodedata
from datetime import datetime, timezone

from ulid import ULID


def generate_ulid_id(prefix: str) -> str:
    return f"{prefix}-{ULID()}"


def generate_claim_id() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"CLM-{today}-{ULID()}"


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug


def generate_zone_id(zone_name: str) -> str:
    return f"ZON-{slugify(zone_name)}"
