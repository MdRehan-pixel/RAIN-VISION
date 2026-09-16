import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


SmsDeliveryStatus = Literal[
    "NOT_CONFIGURED",
    "QUEUED",
    "ACCEPTED",
    "SCHEDULED",
    "SENDING",
    "SENT",
    "DELIVERED",
    "UNDELIVERED",
    "FAILED",
    "UNKNOWN",
]


class SmsAlertRequest(BaseModel):
    recipient: str
    location: str = Field(min_length=2, max_length=120)
    risk: int = Field(ge=0, le=100)
    severity: Literal["LOW", "MODERATE", "HIGH", "EXTREME"]
    rainfall: float = Field(ge=0)
    inundation: int = Field(ge=0, le=100)
    last_live_update: datetime
    recommended_action: str = Field(min_length=4, max_length=280)
    idempotency_key: str = Field(min_length=8, max_length=180)
    test_mode: bool = False

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, value: str) -> str:
        if not re.fullmatch(r"\+[1-9]\d{7,14}", value):
            raise ValueError("recipient must use E.164 format, for example +919876543210")
        return value


SenderVerification = Literal["VERIFIED", "NOT_PROVISIONED", "UNVERIFIED", "NOT_CONFIGURED"]


class SmsConfigResponse(BaseModel):
    configured: bool
    gateway: str
    sender_type: Literal["MESSAGING_SERVICE", "PHONE_NUMBER", "NONE"]
    sender_masked: str | None = None
    sender_verification: SenderVerification
    account_type: str | None = None
    callback_configured: bool
    automatic_alerts: bool
    detail: str


class SmsSendResponse(BaseModel):
    configured: bool
    gateway: str
    status: SmsDeliveryStatus
    message_sid: str | None = None
    provider_status: str | None = None
    error_code: str | None = None
    detail: str
    updated_at: datetime
    duplicate: bool = False


class SmsDeliveryStatusResponse(BaseModel):
    message_sid: str
    status: SmsDeliveryStatus
    provider_status: str
    recipient_masked: str
    error_code: str | None = None
    updated_at: datetime


class SmsCallbackAck(BaseModel):
    accepted: bool
    status: SmsDeliveryStatus