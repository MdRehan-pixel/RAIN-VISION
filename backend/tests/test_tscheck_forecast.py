import re


def test_forecast_returns_coordinate_keyed_weather(client):
    response = client.get('/forecast', params={'latitude': 12.9716, 'longitude': 77.5946})
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body['latitude'] == 12.9716
    assert body['longitude'] == 77.5946
    assert body.get('status') in {'LIVE', 'FALLBACK'}
    assert 'current' in body['data'] and 'hourly' in body['data']


def test_forecast_rejects_invalid_coordinates(client):
    response = client.get('/forecast', params={'latitude': 99, 'longitude': 77.5946})
    assert response.status_code == 422
