def test_spatial_pan_india_and_radar_contracts(client):
    spatial = client.get('/spatial', params={'latitude': 12.9716, 'longitude': 77.5946, 'radiusKm': 10})
    assert spatial.status_code == 200, spatial.text[:300]
    spatial_body = spatial.json()
    assert spatial_body.get('status') in {'LIVE', 'FALLBACK'}
    assert isinstance(spatial_body.get('points'), list)

    cities = client.get('/pan-india')
    assert cities.status_code == 200, cities.text[:300]
    city_body = cities.json()
    assert city_body.get('status') in {'LIVE', 'FALLBACK'}
    city_rows = city_body.get('cities', [])
    assert isinstance(city_rows, list)
    if city_rows:
        assert all('latitude' in city and 'longitude' in city for city in city_rows)

    radar = client.get('/radar', params={'latitude': 12.9716, 'longitude': 77.5946})
    assert radar.status_code == 200, radar.text[:300]
    assert radar.json().get('status') in {'LIVE', 'UNAVAILABLE'}
