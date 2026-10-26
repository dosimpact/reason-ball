"""Validate exports, input snapshots, complete post coverage and exact XLSX provenance.

Run with: uv run --no-project --with jsonschema python scripts/validate-data.py
from app/. The app build itself requires only Python's standard library.
"""
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import hashlib
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[1]


def import_file(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


model = import_file('disclosure_validator', ROOT / 'packages/wedding-data-model/validate.py')
spreadsheet = import_file('source_catalog', ROOT / 'scripts/vendor/source_catalog.py')
vendors = json.loads((ROOT / 'src/entities/vendor/data/vendors.json').read_text())
metadata = json.loads((ROOT / 'src/entities/vendor/data/metadata.json').read_text())
assert len(vendors) == metadata['venues'] + metadata['planning']
assert len({vendor['id'] for vendor in vendors}) == len(vendors)
assert sum(vendor['kind'] == 'venue' for vendor in vendors) == metadata['venues']
assert sum(vendor['kind'] == 'planning' for vendor in vendors) == metadata['planning']
for input_source in metadata['inputs']:
    assert hashlib.sha256((ROOT / input_source['path']).read_bytes()).hexdigest() == input_source['sha256'], f"Input changed; regenerate data: {input_source['path']}"
for kind, directory in [('venue', '참가격_웨딩홀_업체별_공시원본'), ('planning', '참가격_결혼준비대행_자료')]:
    posts = json.loads((ROOT / 'database' / directory / '게시글_기본정보.json').read_text())['posts']
    represented = {parse_qs(urlparse(vendor['sourceUrl']).query).get('boardSeq', [''])[0] for vendor in vendors if vendor['kind'] == kind}
    assert {post['post_id'] for post in posts}.issubset(represented), f'Unrepresented current posts: {kind}'
workbooks = {}
exact_cells = 0
for vendor in vendors:
    path = ROOT / 'public/data/disclosures' / (vendor['id'] + '.json')
    model.validate(json.loads(path.read_text()), check_sources=True)
    sources = {source['id']: source for source in vendor['sources']}
    for evidence in vendor['evidence']:
        source = sources[evidence['sourceId']]
        if source['format'] != 'XLSX' or not evidence.get('cell'):
            continue
        source_path = source['path']
        if source_path not in workbooks:
            workbooks[source_path] = {sheet['name']: sheet for sheet in spreadsheet.sheets_from_xlsx(ROOT / source_path)}
        sheet = workbooks[source_path][evidence['sheet']]
        actual = spreadsheet.clean(sheet['cells'].get(evidence['cell']))
        assert actual == evidence['rawText'], f"Evidence mismatch: {vendor['name']} {evidence['sheet']} {evidence['cell']}"
        exact_cells += 1
print(f'PASS {len(vendors)} projections and disclosure envelopes: schema, references, ranges, source SHA-256, {len(metadata["inputs"])} input hashes, complete current-post coverage, {exact_cells} exact XLSX cells')
