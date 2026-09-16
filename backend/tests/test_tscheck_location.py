def test_geocode_resolves_search_term(client):
    response = client.get('/geocode', params={'name': 'Bengaluru', 'countryCode': 'IN'})
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body.get('status') in {'LIVE', 'FALLBACK'}
    results = body.get('results', [])
    assert isinstance(results, list) and results
    assert any('bengal' in item['name'].lower() for item in results)


def test_geocode_rejects_blank_query(client):
    response = client.get('/geocode', params={'name': ''})
    assert response.status_code == 422
