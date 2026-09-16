import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from lib.db import db
from lib.sms import config_response, get_sms_service, mask_phone, normalize_status, validate_twilio_signature
from models.sms import SmsAlertRequest, SmsCallbackAck, SmsConfigResponse, SmsDeliveryStatusResponse, SmsSendResponse

router = APIRouter(prefix="/sms")


@router.get("/config", response_model=SmsConfigResponse)
async def get_sms_config(request: Request):
    return await config_response(request.app.state.http)


@router.post("/alerts", response_model=SmsSendResponse)
async def send_sms_alert(alert: SmsAlertRequest, request: Request):
    if not alert.test_mode and alert.severity not in {"HIGH", "EXTREME"}:
        raise HTTPException(status_code=422, detail="automatic SMS requires HIGH or EXTREME severity")
    existing = await db.sms_deliveries.find_one({"idempotency_key": alert.idempotency_key})
    if existing:
        return SmsSendResponse(
            configured=existing.get("configured", False),
            gateway=existing.get("gateway", "Twilio Programmable Messaging"),
            status=existing.get("status", "UNKNOWN"),
            message_sid=existing.get("message_sid"),
            provider_status=existing.get("provider_status"),
            detail="Duplicate alert suppressed; returning the existing provider state.",
            updated_at=existing.get("updated_at", datetime.now(timezone.utc)),
            duplicate=True,
        )
    result = await get_sms_service().send(request.app.state.http, alert)
    document = {
        **result.model_dump(exclude_none=True),
        "idempotency_key": alert.idempotency_key,
        "recipient_masked": mask_phone(alert.recipient),
        "location": alert.location,
        "severity": alert.severity,
        "test_mode": alert.test_mode,
    }
    await db.sms_deliveries.insert_one(document)
    return result


@router.get("/status/{message_sid}", response_model=SmsDeliveryStatusResponse)
async def get_sms_status(message_sid: str):
    delivery = await db.sms_deliveries.find_one({"message_sid": message_sid})
    if not delivery:
        raise HTTPException(status_code=404, detail="SMS delivery record not found")
    return SmsDeliveryStatusResponse(
        message_sid=message_sid,
        status=delivery.get("status", "UNKNOWN"),
        provider_status=delivery.get("provider_status", "unknown"),
        recipient_masked=delivery.get("recipient_masked", "***"),
        error_code=delivery.get("error_code"),
        updated_at=delivery.get("updated_at", datetime.now(timezone.utc)),
    )


@router.post("/status-callback", response_model=SmsCallbackAck)
async def sms_status_callback(request: Request):
    form = await request.form()
    fields = {key: str(value) for key, value in form.items()}
    signature = request.headers.get("X-Twilio-Signature", "")
    callback_url = os.environ.get("TWILIO_STATUS_CALLBACK_URL", str(request.url))
    if os.environ.get("TWILIO_VALIDATE_SIGNATURE", "true").lower() == "true" and not validate_twilio_signature(callback_url, fields, signature):
        raise HTTPException(status_code=403, detail="invalid Twilio callback signature")
    message_sid = fields.get("MessageSid") or fields.get("SmsSid")
    if not message_sid:
        raise HTTPException(status_code=422, detail="MessageSid is required")
    provider_status = fields.get("MessageStatus") or fields.get("SmsStatus") or "unknown"
    status = normalize_status(provider_status)
    await db.sms_deliveries.update_one(
        {"message_sid": message_sid},
        {"$set": {"status": status, "provider_status": provider_status, "error_code": fields.get("ErrorCode"), "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return SmsCallbackAck(accepted=True, status=status)