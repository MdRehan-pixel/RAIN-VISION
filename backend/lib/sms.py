import base64
import hashlib
import hmac
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from models.sms import SmsAlertRequest, SmsConfigResponse, SmsSendResponse

logger = logging.getLogger(__name__)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def mask_phone(phone: str) -> str:
    return f"{phone[:3]}***{phone[-3:]}" if len(phone) > 7 else "***"


def normalize_status(value: str | None) -> str:
    status = (value or "unknown").upper()
    allowed = {"QUEUED", "ACCEPTED", "SCHEDULED", "SENDING", "SENT", "DELIVERED", "UNDELIVERED", "FAILED"}
    return status if status in allowed else "UNKNOWN"


@dataclass(frozen=True)
class SmsConfiguration:
    account_sid: str
    auth_token: str
    messaging_service_sid: str
    from_number: str
    callback_url: str
    automatic_alerts: bool

    @property
    def sender_type(self) -> str:
        if self.messaging_service_sid:
            return "MESSAGING_SERVICE"
        if self.from_number:
            return "PHONE_NUMBER"
        return "NONE"

    @property
    def configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.callback_url and self.sender_type != "NONE")


def get_sms_configuration() -> SmsConfiguration:
    return SmsConfiguration(
        account_sid=os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        auth_token=os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        messaging_service_sid=os.environ.get("TWILIO_MESSAGING_SERVICE_SID", "").strip(),
        from_number=os.environ.get("TWILIO_FROM_NUMBER", "").strip(),
        callback_url=os.environ.get("TWILIO_STATUS_CALLBACK_URL", "").strip(),
        automatic_alerts=os.environ.get("TWILIO_AUTO_SEND", "true").lower() == "true",
    )


# Sender ownership is verified against Twilio and cached briefly so the UI never
# shows READY for a sender the account does not actually own.
_SENDER_CACHE_TTL_SECONDS = 300
_sender_cache: dict[str, Any] = {"checked_at": None, "verification": "UNVERIFIED", "account_type": None}


async def verify_sender(client: httpx.AsyncClient, config: SmsConfiguration) -> tuple[str, str | None]:
    """Return (verification, account_type). verification is VERIFIED / NOT_PROVISIONED / UNVERIFIED / NOT_CONFIGURED."""
    if not config.configured:
        return "NOT_CONFIGURED", None
    checked_at = _sender_cache["checked_at"]
    if checked_at and (now_utc() - checked_at).total_seconds() < _SENDER_CACHE_TTL_SECONDS:
        return _sender_cache["verification"], _sender_cache["account_type"]
    auth = httpx.BasicAuth(config.account_sid, config.auth_token)
    base = f"https://api.twilio.com/2010-04-01/Accounts/{config.account_sid}"
    verification = "UNVERIFIED"
    account_type: str | None = None
    try:
        account = await client.get(f"{base}.json", auth=auth, timeout=10)
        account.raise_for_status()
        account_type = str(account.json().get("type", "unknown")).upper()
        if config.messaging_service_sid:
            owned = await client.get(f"https://messaging.twilio.com/v1/Services/{config.messaging_service_sid}", auth=auth, timeout=10)
            verified = owned.status_code == 200
        else:
            owned = await client.get(f"{base}/IncomingPhoneNumbers.json", auth=auth, params={"PhoneNumber": config.from_number}, timeout=10)
            owned.raise_for_status()
            verified = any(n.get("phone_number") == config.from_number for n in owned.json().get("incoming_phone_numbers", []))
        verification = "VERIFIED" if verified else "NOT_PROVISIONED"
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Twilio sender verification failed: %s", type(exc).__name__)
        return "UNVERIFIED", None
    _sender_cache.update(checked_at=now_utc(), verification=verification, account_type=account_type)
    return verification, account_type


async def config_response(client: httpx.AsyncClient) -> SmsConfigResponse:
    config = get_sms_configuration()
    verification, account_type = await verify_sender(client, config)
    sender = config.messaging_service_sid or config.from_number
    details = {
        "VERIFIED": "Twilio confirms the account owns the configured sender. QUEUED/SENT/DELIVERED are shown only from Twilio responses and signed status callbacks.",
        "NOT_PROVISIONED": f"Twilio credentials are valid, but the account owns no phone number or messaging service matching {mask_phone(sender)}. Provision a number in the Twilio console; until then DemoSmsAdapter prepares payloads without claiming delivery.",
        "UNVERIFIED": "Twilio could not be reached to verify the configured sender. Sends will be attempted, but no delivery is claimed until Twilio confirms it.",
        "NOT_CONFIGURED": "SMS gateway is not fully configured. Payload-ready demo behavior remains active.",
    }
    return SmsConfigResponse(
        configured=config.configured,
        gateway="Twilio Programmable Messaging",
        sender_type=config.sender_type,
        sender_masked=mask_phone(sender) if sender else None,
        sender_verification=verification,
        account_type=account_type,
        callback_configured=bool(config.callback_url),
        automatic_alerts=config.automatic_alerts,
        detail=details[verification],
    )


def build_message(alert: SmsAlertRequest) -> str:
    heading = "RAIN VISION TEST ALERT" if alert.test_mode else "RAIN VISION ALERT"
    return (
        f"{heading}\n"
        f"Location: {alert.location}\n"
        f"Risk: {alert.risk}/100 ({alert.severity})\n"
        f"Rainfall: {alert.rainfall:.1f} mm/h\n"
        f"Inundation: {alert.inundation}/100\n"
        f"Updated: {alert.last_live_update.isoformat()}\n"
        f"Action: {alert.recommended_action}"
    )


class DemoSmsAdapter:
    async def send(self, _: httpx.AsyncClient, alert: SmsAlertRequest) -> SmsSendResponse:
        return SmsSendResponse(
            configured=False,
            gateway="DemoSmsAdapter",
            status="NOT_CONFIGURED",
            detail="SMS ALERT PAYLOAD READY. Twilio sender configuration is incomplete; no message was submitted.",
            updated_at=now_utc(),
        )


class TwilioSmsNotificationService:
    def __init__(self, config: SmsConfiguration):
        self.config = config

    async def send(self, client: httpx.AsyncClient, alert: SmsAlertRequest) -> SmsSendResponse:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.config.account_sid}/Messages.json"
        data = {
            "To": alert.recipient,
            "Body": build_message(alert),
            "StatusCallback": self.config.callback_url,
        }
        if self.config.messaging_service_sid:
            data["MessagingServiceSid"] = self.config.messaging_service_sid
        else:
            data["From"] = self.config.from_number
        payload: dict[str, Any] = {}
        try:
            response = await client.post(url, data=data, auth=httpx.BasicAuth(self.config.account_sid, self.config.auth_token))
            payload = response.json()
            response.raise_for_status()
            provider_status = str(payload.get("status", "queued"))
            return SmsSendResponse(
                configured=True,
                gateway="Twilio Programmable Messaging",
                status=normalize_status(provider_status),
                message_sid=payload.get("sid"),
                provider_status=provider_status,
                detail="Twilio accepted the message request. Final delivery is pending the signed status callback.",
                updated_at=now_utc(),
            )
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Twilio message submission failed: %s", type(exc).__name__)
            raw_code = payload.get("code")
            error_code = None if raw_code is None else str(raw_code)
            provider_message = str(payload.get("message", "")).strip()
            detail = f"Twilio rejected the request (error {error_code}): {provider_message} No delivery is claimed." if error_code else "Twilio rejected or could not process the message request. No delivery is claimed."
            return SmsSendResponse(
                configured=True,
                gateway="Twilio Programmable Messaging",
                status="FAILED",
                error_code=error_code,
                provider_status="failed",
                detail=detail,
                updated_at=now_utc(),
            )


def get_sms_service() -> DemoSmsAdapter | TwilioSmsNotificationService:
    config = get_sms_configuration()
    return TwilioSmsNotificationService(config) if config.configured else DemoSmsAdapter()


def validate_twilio_signature(url: str, fields: dict[str, str], signature: str) -> bool:
    token = get_sms_configuration().auth_token
    if not token or not signature:
        return False
    signed = url + "".join(f"{key}{fields[key]}" for key in sorted(fields))
    digest = base64.b64encode(hmac.new(token.encode(), signed.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(digest, signature)