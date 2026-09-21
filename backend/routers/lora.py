from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

router = APIRouter(prefix="/lora", tags=["LoRa Gateway"])


@router.post("/event")
async def receive_lora_event(payload: dict[str, Any]):
    """
    LoRa Gateway software ingress.

    This endpoint represents the gateway receiving a LoRa node packet.
    It immediately evaluates the hazard and generates the actuator command.
    """

    node_id = payload.get("node_id", "RV-NODE-01")
    gateway_id = payload.get("gateway_id", "RV-GATEWAY-01")

    rainfall = float(payload.get("rainfall_mm_h", 0))
    water_level = float(payload.get("water_level_m", 0))
    risk = str(payload.get("risk", "")).upper()

    # Siren activation rule
    activate = (
        risk in {"HIGH", "EXTREME"}
        or rainfall >= 30
        or water_level >= 0.70
    )

    siren_command = "ACTIVATE" if activate else "STANDBY"

    now = datetime.now(timezone.utc)

    return {
        "status": "LIVE",
        "gateway": gateway_id,
        "node": node_id,
        "packet_received": True,

        "telemetry": {
            "rainfall_mm_h": rainfall,
            "water_level_m": water_level,
            "risk": risk or "LOW",
            "rssi_dbm": payload.get("rssi_dbm"),
            "snr_db": payload.get("snr_db"),
        },

        "siren_command": siren_command,
        "actuator_status": "COMMAND_GENERATED",

        "received_at": now.isoformat(),

        "message": (
            "Siren activation command generated."
            if activate
            else "System remains in standby."
        ),

        "prototype_note": (
            "Software gateway test. Physical siren is not connected."
        ),
    }


@router.get("/events")
async def get_lora_events(limit: int = 20):
    return {
        "status": "LIVE",
        "collection": "lora_events",
        "count": 0,
        "records": [],
        "prototype_note": (
            "Gateway command path is active. "
            "Persistent LoRa event storage is not enabled in this test."
        ),
    }