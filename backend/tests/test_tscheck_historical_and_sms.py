def test_historical_incidents_list_and_404(client):
    listing = client.get("/historical/incidents")
    assert listing.status_code == 200, listing.text[:300]
    body = listing.json()
    incidents = body if isinstance(body, list) else body.get("incidents", [])
    assert len(incidents) >= 1
    chennai = next((i for i in incidents if i.get("id") == "chennai-floods-2015"), None)
    assert chennai is not None, incidents
    observation_count = chennai.get("observationCount") or chennai.get("observation_count")
    assert observation_count == 672, chennai

    missing = client.get("/historical/incidents/unknown")
    assert missing.status_code == 404, missing.text[:300]


def test_sms_config_reports_unprovisioned_trial(client):
    config = client.get("/sms/config")
    assert config.status_code == 200, config.text[:300]
    body = config.json()
    assert body.get("sender_verification") == "NOT_PROVISIONED", body
    assert body.get("account_type") == "TRIAL", body
