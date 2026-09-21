import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from routers.weather import router as weather_router
from routers.sms import router as sms_router
from routers.historical import router as historical_router
from routers.push import router as push_router
from routers.ml import router as ml_router
from routers.ml_live import router as ml_live_router
from routers.lora import router as lora_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from lib.db import client, ensure_indexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())

    app.state.http = httpx.AsyncClient(
        timeout=httpx.Timeout(12.0, connect=4.0),
        limits=httpx.Limits(
            max_connections=20,
            max_keepalive_connections=10,
        ),
        headers={
            "User-Agent": "RAIN-VISION/1.0 (Smart India Hackathon prototype)"
        },
    )

    yield

    await app.state.http.aclose()

    if client is not None:
        client.close()


app = FastAPI(lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {
        "message": "RAIN VISION API",
        "status": "ready",
    }


api_router.include_router(weather_router)
api_router.include_router(sms_router)
api_router.include_router(historical_router)
api_router.include_router(push_router)
api_router.include_router(ml_router)
api_router.include_router(ml_live_router)
api_router.include_router(lora_router)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app.include_router(api_router)
