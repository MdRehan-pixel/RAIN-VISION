import base64
import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from lib.db import db

router = APIRouter(prefix="/push", tags=["push"])


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


class PushMessage(BaseModel):
    subscription: PushSubscription
    title: str = "RAIN VISION WARNING"
    body: str = "Heavy rainfall or flood risk detected."
    url: str = "/"


class SubscribeRequest(BaseModel):
    subscription: PushSubscription


def get_vapid_private_key():
    value = os.getenv("VAPID_PRIVATE_KEY", "").strip()

    if not value:
        return None

    try:
        raw_private_key = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        return raw_private_key
    except Exception:
        return value


@router.get("/config")
async def push_config():
    public_key = os.getenv("VAPID_PUBLIC_KEY", "").strip()

    return {
        "configured": bool(public_key),
        "public_key": public_key,
    }


@router.post("/subscribe")
async def subscribe_push(request: SubscribeRequest):
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Push subscription storage requires MongoDB.",
        )

    subscription = request.subscription.model_dump()

    await db.push_subscriptions.update_one(
        {"endpoint": subscription["endpoint"]},
        {"$set": subscription},
        upsert=True,
    )

    return {
        "status": "SUBSCRIBED",
        "message": "This device is registered for RAIN VISION push notifications.",
    }


@router.post("/send")
async def send_push(message: PushMessage):
    private_key = get_vapid_private_key()
    subject = os.getenv(
        "VAPID_SUBJECT",
        "mailto:rainvision@example.com",
    )

    if not private_key:
        raise HTTPException(
            status_code=503,
            detail="VAPID private key is not configured.",
        )

    payload = json.dumps({
        "title": message.title,
        "body": message.body,
        "url": message.url,
        "tag": "rain-vision-alert",
    })

    try:
        webpush(
            subscription_info=message.subscription.model_dump(),
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
        )

        return {
            "status": "SENT",
            "message": "Push notification submitted successfully.",
        }

    except WebPushException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Push provider rejected the notification: {exc}",
        )