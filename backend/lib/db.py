import certifi
"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

mongo_url = os.getenv("MONGO_URL")
db_name = os.getenv("DB_NAME", "app")

if mongo_url:
    client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
    db = client[db_name]
else:
    client = None
    db = None
    logger.warning("MongoDB is not configured; database-backed features are disabled.")

INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [
        IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")
    ],
    "sms_deliveries": [
        IndexModel(
            [("message_sid", ASCENDING)],
            name="message_sid",
            unique=True,
            sparse=True,
        ),
        IndexModel(
            [("idempotency_key", ASCENDING)],
            name="idempotency_key",
            unique=True,
        ),
        IndexModel(
            [("updated_at", DESCENDING)],
            name="updated_at_desc",
        ),
    ],
}


async def ensure_indexes() -> None:
    if db is None:
        return

    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error(
                    "ensure_indexes(%s.%s): %s",
                    collection,
                    model.document["name"],
                    exc,
                )
