"""Optional one-time public venue geocoding. Runtime never calls Nominatim.

Usage policy: https://operations.osmfoundation.org/policies/nominatim/
Single machine/thread, 1.25s minimum between calls, persistent cache, no
suggest/autocomplete endpoint. Delete no cache when rerunning. OSM ODbL.
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ROOT = APP
OUTPUT = APP / 'src/entities/vendor/data/geocodes.json'
REGIONS = {
    '서울(강남)': '서울특별시 강남구', '서울(강남외)': '서울특별시',
    '경기도': '경기도', '강원도': '강원특별자치도', '경상도': '경상남도',
    '대구': '대구광역시', '대전': '대전광역시', '부산': '부산광역시',
    '울산': '울산광역시', '인천': '인천광역시', '전남광주': '광주광역시',
    '전라북도': '전북특별자치도', '제주도': '제주특별자치도',
    '충청.세종': '세종특별자치시',
}
QUERY_CACHE = APP / '.cache/geocode-queries.json'
state = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {
    'attribution': '© OpenStreetMap contributors, ODbL 1.0',
    'source': 'https://nominatim.openstreetmap.org/',
    'checkedAt': '2026-10-25', 'regions': {}, 'venues': {}, 'queries': {},
}
queries = state.pop('queries', {})
if QUERY_CACHE.exists():
    queries.update(json.loads(QUERY_CACHE.read_text()))
last_request = 0

def save():
    temporary_output = OUTPUT.with_suffix('.json.tmp')
    temporary_output.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    temporary_output.replace(OUTPUT)
    QUERY_CACHE.parent.mkdir(parents=True, exist_ok=True)
    temporary_cache = QUERY_CACHE.with_suffix('.json.tmp')
    temporary_cache.write_text(json.dumps(queries, ensure_ascii=False, indent=2) + '\n')
    temporary_cache.replace(QUERY_CACHE)

def request(query):
    global last_request
    if query in queries:
        return queries[query]
    time.sleep(max(0, 1.25 - (time.monotonic() - last_request)))
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
        'format': 'jsonv2', 'q': query, 'countrycodes': 'kr',
        'addressdetails': 1, 'limit': 1,
    })
    headers = {'User-Agent': 'WeddingAtlas/0.1 (one-time public wedding venue address research)',
               'Referer': 'http://localhost:3077/'}
    try:
        last_request = time.monotonic()
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=10) as response:
            result = json.load(response)
        queries[query] = result
        save()
        return result
    except Exception as error:
        print(f'Lookup failed {query}: {error}', flush=True)
        if getattr(error, 'code', None) in (403, 429):
            raise SystemExit('Geocoder declined requests; existing cache retained.')
        return []

def point(result, precision):
    return {'latitude': float(result['lat']), 'longitude': float(result['lon']),
            'precision': precision, 'displayName': result['display_name'],
            'osmType': result.get('osm_type'), 'osmId': result.get('osm_id'),
            'source': 'OpenStreetMap / Nominatim'}

def clean_address(address):
    address = re.sub(r'(로|길)\s+(\d+길)', r'\1\2', address)
    address = re.split(r'[,\n(]', address)[0].strip()
    # A road token can itself contain digits (테헤란로25길). The building
    # number follows the final 로/길 suffix, never the numeric road segment.
    match = re.search(r'^(.+(?:로|길))\s*(\d+(?:-\d+)?)(?:\s|$)', address)
    if match:
        return f'{match.group(1).strip()} {match.group(2)}'
    return address

for label, query in REGIONS.items():
    if label not in state['regions']:
        result = request(query)
        if result:
            state['regions'][label] = point(result[0], 'region')
            save()

catalog = json.loads((ROOT / 'database/참가격_웨딩홀_업체별_공시원본/catalog.json').read_text())
venues = [{'id': 'venue-' + v['id'], 'address': v.get('address'), 'name': v['name']}
          for v in catalog['venues']]
normalized = APP / 'src/entities/vendor/data/vendors.json'
if normalized.exists():
    data = json.loads(normalized.read_text())
    vendors = data if isinstance(data, list) else data.get('vendors', [])
    venues += [v for v in vendors if v.get('kind') == 'planning']

for index, venue in enumerate(venues):
    venue_id = venue['id']
    if state['venues'].get(venue_id) is not None or not venue.get('address'):
        continue
    query = clean_address(venue['address'])
    result = request(query)
    value = None
    if result:
        candidate = result[0]
        house_number = candidate.get('address', {}).get('house_number', '')
        number = re.search(r'(?:로|길)\s*(\d+(?:-\d+)?)$', query)
        road = candidate.get('address', {}).get('road', '')
        road_matches = bool(road and re.sub(r'\s+', '', road) in re.sub(r'\s+', '', query))
        municipality = next((token for token in query.split()[1:3] if token.endswith(('시', '군', '구'))), None)
        municipality_matches = not municipality or municipality in candidate['display_name']
        if int(candidate.get('place_rank', 0)) >= 28 and number and house_number == number.group(1) and road_matches and municipality_matches:
            value = point(candidate, 'address')
            value['matchedAddress'] = query
    state['venues'][venue_id] = value
    save()
    print(f'{index + 1}/{len(venues)} {venue["name"]}: {"address match" if value else "unresolved"}', flush=True)

print('Geocoded', sum(v is not None for v in state['venues'].values()), '/', len(state['venues']), flush=True)
