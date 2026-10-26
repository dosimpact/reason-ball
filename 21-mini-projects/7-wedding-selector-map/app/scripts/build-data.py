"""Build read projections from both frozen price.go.kr datasets without changing originals.

Uses the existing source-grounded venue extractor and the disclosure superset's
vocabulary. Unknown prices stay unknown; package/individual/per-person bases stay
separate. Also writes a schema-shaped disclosure export for traceable ingestion.
"""
from __future__ import annotations

import csv
from datetime import datetime
import hashlib
import importlib.util
import json
import mimetypes
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/entities/vendor/data'
VENUE = ROOT / 'database/참가격_웨딩홀_업체별_공시원본'
PLANNING = ROOT / 'database/참가격_결혼준비대행_자료'
MODEL = ROOT / 'packages/wedding-data-model'
spec = importlib.util.spec_from_file_location('source_catalog', ROOT / 'scripts/vendor/source_catalog.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
OBSERVED_AT = datetime.now().astimezone().isoformat()
SCHEMA_VERSION = json.loads((MODEL / 'schema/wedding-disclosure.schema.json').read_text())['properties']['schemaVersion']['const']
INPUT_PATHS = [VENUE / name for name in ['catalog.json', '게시글_기본정보.json', '수집목록.json', '추가원본_수집목록.json']] + [PLANNING / name for name in ['게시글_기본정보.json', '수집목록.json']] + [MODEL / 'schema/wedding-disclosure.schema.json']
INPUT_BYTES = {path: path.read_bytes() for path in INPUT_PATHS}


def load(path):
    return json.loads(INPUT_BYTES[path] if path in INPUT_BYTES else path.read_bytes())


def relative(path):
    return path.relative_to(ROOT).as_posix()


def source_record(path, url=None, sha=None):
    return {'id': 's-' + hashlib.sha256(relative(path).encode()).hexdigest()[:14],
            'title': path.name, 'path': relative(path), 'url': url,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'format': path.suffix.lstrip('.').upper()}


def excel_cell(row, column):
    letters = ''
    while column > 0:
        column, remainder = divmod(column - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters + str(row)


def blank_vendor(identifier, name, kind, region, address, phone, date, url):
    return dict(id=identifier, name=source.clean(name), kind=kind, region=region,
                address=address or None, phone=phone or None, publishedAt=date or None,
                priceYear=None, archived=False, latitude=None, longitude=None,
                mealMin=None, mealMax=None, rentalMin=None, guestsMin=None,
                packageMin=None, packageMax=None, serviceMin=None, serviceMax=None,
                categories=[], offers=[], priceTerms=[], documents=[], sources=[],
                evidence=[], sourceUrl=url, warnings=[],
                model={'schemaVersion': SCHEMA_VERSION,
                       'entityKind': 'core:venue' if kind == 'venue' else 'core:organization',
                       'disclosureId': 'd-' + identifier,
                       'interpretation': 'structured_unverified'})


def add_term(vendor, category, subject, raw, amounts, evidence, basis='item', condition='', role='payable', state='known'):
    index = len(vendor['priceTerms'])
    evidence_id = f"{vendor['id']}-e-{index}"
    evidence.update(id=evidence_id, rawText=source.clean(raw))
    vendor['evidence'].append(evidence)
    vendor['priceTerms'].append(dict(id=f"{vendor['id']}-p-{index}", category=category,
        subject=subject, label={'meal': '기본 식대', 'rental': '대관료', 'decoration': '장식',
            'studio': '스튜디오 기본상품', 'dress': '드레스 기본상품', 'makeup': '메이크업 기본상품',
            'package': '패키지 기본상품', 'other': '공시 기본상품'}[category],
        role=role, state=state, min=min(amounts) if amounts else None,
        max=max(amounts) if amounts else None, raw=source.clean(raw), basis=basis,
        condition=condition, evidenceId=evidence_id, sourceId=evidence['sourceId']))


def sanitized_offers(record):
    """Exclude recognizable option rows the historic parser treated as meal rows."""
    result = []
    for original in record['offers']:
        offer = dict(original)
        if re.search(r'기타\s*비용|선택\s*사항|진행시\s*추가|주례|메이크업|^\s*[~\d,]+원', offer['hall']):
            continue
        if re.search(r'소인|어린이|아동|초등|미취학', offer['condition']):
            continue
        if re.search(r'현역|군무원|예비역|군\s*회원', offer['hall'] + ' ' + offer['condition']):
            continue
        if re.search(r'프리드링크|^\s*음료', offer['meal']['raw']):
            continue
        if '식음료30만 별도' in offer['meal']['raw']:
            offer['meal'] = dict(min=49000, max=49000, raw=offer['meal']['raw'])
        result.append(offer)
    return result


def enrich_offer_conditions(record, offers):
    filename = record.get('files', {}).get('xlsx')
    if not filename:
        return offers
    sheets = {sheet['name']: sheet for sheet in source.sheets_from_xlsx(ROOT / filename)}
    result = []
    for offer in offers:
        locator = offer.get('evidence', {})
        sheet = sheets.get(locator.get('sheet'))
        row, col = locator.get('row'), locator.get('column')
        if sheet is None or row is None or col is None:
            result.append(offer)
            continue
        left = source.clean(sheet['rows'].get(row, {}).get(col - 1, ''))
        if re.search(r'초과시.*대체업장|추가\s*10\s*%', left, re.S):
            continue
        blocks = [source.price_block(sheet, r) for r, columns in sorted(sheet['rows'].items()) if r < row and any(re.search(r'예식홀명|예식장명|홀명', source.clean(v)) for v in columns.values())]
        block = next((block for block in reversed(blocks) if block and block['first'] <= row < block['end']), None)
        label = block['labels'].get(col, '') if block else ''
        own = offer['meal']['raw']
        conditions = []
        if re.search(r'미만|이상|이하|성수기|비수기|오후|오전|정가|적용|할인', label):
            conditions.append(label)
        own_guarantee = re.search(r'(?:기본|보증|최소)[^\n원]*?(?:명|인)', own)
        if own_guarantee:
            conditions.append(own_guarantee[0])
        elif left and not re.search(r'원|정가', left) and re.search(r'기본|보증|명|인|당', left):
            conditions.append(left)
        if conditions:
            offer['condition'] = ' · '.join(dict.fromkeys(conditions))
        if offer['guests'] is None:
            guarantee = re.search(r'(?:기본|보증(?:인원)?|최소\s*보증(?:인원)?)\s*[:：]?\s*([\d,]+)', offer['condition'])
            if guarantee:
                offer['guests'] = int(guarantee[1].replace(',', ''))
        context = label + ' ' + offer['condition']
        maximum = re.search(r'([\d,]+)\s*(?:명|인)\s*(미만|이하)', context)
        minimum = re.search(r'([\d,]+)\s*(?:명|인)\s*이상', context)
        if minimum and re.search(r'기본|보증', context[max(0, minimum.start() - 12):minimum.start()]):
            minimum = None
        if maximum:
            offer['maximumAttendees'] = int(maximum[1].replace(',', '')) - (1 if maximum[2] == '미만' else 0)
        if minimum:
            offer['minimumAttendees'] = int(minimum[1].replace(',', ''))
        result.append(offer)
    return result


def repair_seasonal_rentals(record, offers):
    """Pair meal and rental columns carrying the same explicit season header."""
    filename = record.get('files', {}).get('xlsx')
    if not filename:
        return offers
    try:
        sheets = {sheet['name']: sheet for sheet in source.sheets_from_xlsx(ROOT / filename)}
    except (KeyError, ValueError):
        return offers
    for offer in offers:
        locator = offer.get('evidence', {})
        sheet = sheets.get(locator.get('sheet'))
        row, col = locator.get('row'), locator.get('column')
        if sheet is None or row is None or col is None:
            continue
        blocks = [source.price_block(sheet, r) for r, columns in sorted(sheet['rows'].items()) if r < row and any(re.search(r'예식홀명|예식장명|홀명', source.clean(v)) for v in columns.values())]
        block = next((block for block in reversed(blocks) if block and block['first'] <= row < block['end']), None)
        if block is None:
            continue
        meal_label = block['labels'].get(col, '')
        season = 'off' if re.search(r'비수기|비성수기', meal_label) else 'peak' if '성수기' in meal_label else None
        event_type = '실내' if '실내' in offer['hall'] else '야외' if '야외' in offer['hall'] else None
        if season is None and event_type is None:
            continue
        for rental_col, label in block['labels'].items():
            rental_season = 'off' if re.search(r'비수기|비성수기', label) else 'peak' if '성수기' in label else None
            matching_condition = (season is not None and rental_season == season) or (event_type is not None and event_type in label)
            if re.search(r'대관|사용료', label) and matching_condition:
                rental = source.price(source.expanded(sheet, row, rental_col), 0, 500000000)
                if rental is not None:
                    offer['rental'] = rental
                    break
    return offers


def locate_price_evidence(sheet, row, raw, category):
    wanted = source.clean(raw)
    matches = [(r, c) for r, cols in sheet['rows'].items() for c, value in cols.items() if source.clean(value) == wanted]
    if not matches:
        return None
    same_row = [(r, c) for r, c in matches if r == row]
    if same_row:
        return excel_cell(*same_row[0])
    # Merged/forward-filled rental values may originate on another row of this hall.
    nearest = min(matches, key=lambda item: abs(item[0] - row))
    return excel_cell(*nearest)


def apply_reviewed_seasons(record, offers):
    """Reuse model-reviewed same-season meal/rental pair, instead of mixing seasons."""
    if record['name'] != '루이비스 강서점':
        return offers
    example = load(MODEL / 'examples/02-season-options.json')
    terms = {term['id']: term for term in example['priceTerms']}
    for offer in offers:
        season = 'off' if '비수기' in offer['condition'] else 'peak'
        rental = terms[season + '-rental']
        value = int(rental['amount']['value'])
        offer['rental'] = dict(min=value, max=value, raw=rental['rawText'])
    return offers


def build_venues():
    result = []
    for record in load(VENUE / 'catalog.json')['venues']:
        vendor = blank_vendor('venue-' + record['id'], record['name'], 'venue', record['region'],
            record['address'], record['phone'], record['publishedAt'], record['sourceUrl'])
        vendor.update(priceYear=record['priceYear'], archived=record['archived'],
                      documents=record['documents'], warnings=list(record['warnings']))
        for kind, filename in record['files'].items():
            path = ROOT / filename
            if path.exists():
                vendor['sources'].append(source_record(path, record['sourceUrl'], record.get('sourceSha256') if kind == 'xlsx' else None))
        vendor['sources'].append(source_record(VENUE / '게시글_기본정보.json', record['sourceUrl']))
        primary_source = next((s for s in vendor['sources'] if s['format'] == 'XLSX'), vendor['sources'][0])
        vendor['offers'] = apply_reviewed_seasons(record, repair_seasonal_rentals(record, enrich_offer_conditions(record, sanitized_offers(record))))
        if len(vendor['offers']) != len(record['offers']):
            vendor['warnings'].append('원본의 옵션·기타비용 행을 식대 통계에서 제외했습니다.')
        workbook_sheets = {}
        if primary_source['format'] == 'XLSX':
            workbook_sheets = {sheet['name']: sheet for sheet in source.sheets_from_xlsx(ROOT / primary_source['path'])}
        if record['name'] == '계룡 스파텔':
            vendor['warnings'].append('군 회원·현역·군무원·예비역 한정 할인은 일반 식대 비교에서 제외했습니다. 대체업장·소규모 식사 등 세부 조건은 원문을 확인해주세요.')
        for offer in vendor['offers']:
            if offer['additional']:
                continue
            for category, value in [('meal', offer['meal']), ('rental', offer['rental']), ('decoration', offer['decoration'])]:
                if value is None:
                    continue
                locator = offer.get('evidence', {})
                evidence = {'sourceId': primary_source['id'], 'sheet': locator.get('sheet'),
                    'verification': 'structured_unverified'}
                sheet = workbook_sheets.get(locator.get('sheet'))
                if sheet is not None:
                    cell = locate_price_evidence(sheet, locator.get('row', 1), value['raw'], category)
                    if cell:
                        evidence['cell'] = cell
                add_term(vendor, category, offer['hall'], value['raw'], [value['min'], value['max']],
                         evidence, 'person' if category == 'meal' else 'item', offer['condition'],
                         state='free' if value['max'] == 0 else 'known')
        base = [o for o in vendor['offers'] if not o['additional']]
        meals = [o['meal'] for o in base if o['meal']]
        rentals = [o['rental'] for o in base if o['rental']]
        guarantees = [o['guests'] for o in base if o['guests'] is not None]
        vendor.update(mealMin=min((x['min'] for x in meals), default=None),
            mealMax=max((x['max'] for x in meals), default=None),
            rentalMin=min((x['min'] for x in rentals), default=None),
            guestsMin=min(guarantees, default=None), categories=['meal', 'rental'])
        if vendor['mealMin'] is None:
            vendor['warnings'].append('비교 가능한 성인 기본 식대 미확인. 공시 원문을 확인해주세요.')
        result.append(vendor)
    return result


def add_missing_metadata_venues(vendors):
    """A current post is distinct from an archived post even if attachment bytes match."""
    covered_posts = {match[1] for vendor in vendors if (match := re.search(r'boardSeq=(\d+)', vendor['sourceUrl']))}
    manifest = load(VENUE / '추가원본_수집목록.json')
    mapping = {item['post_id']: item for item in manifest.get('current_attachment_mapping', [])}
    catalogue_by_id = {item['id']: item for item in load(VENUE / 'catalog.json')['venues']}
    for post in load(VENUE / '게시글_기본정보.json')['posts']:
        if post['post_id'] in covered_posts:
            continue
        attachment = mapping.get(post['post_id'])
        matched_id = re.search(r'__(\d+)\.[^.]+$', attachment['local_file']) if attachment else None
        canonical = next((vendor for vendor in vendors if matched_id and vendor['id'] == 'venue-' + matched_id[1] and vendor['name'] == post['company'] and vendor['address'] == post['address'] and vendor['phone'] == post['contact']), None)
        original_file = VENUE / attachment['local_file'] if attachment else None
        catalogue_record = catalogue_by_id.get(matched_id[1]) if matched_id else None
        same_bytes = original_file is not None and original_file.is_file() and catalogue_record and hashlib.sha256(original_file.read_bytes()).hexdigest() == catalogue_record.get('sourceSha256')
        if canonical and same_bytes and attachment.get('connection') == 'content_sha256':
            canonical['model']['previousDisclosures'] = [{'id': canonical['model']['disclosureId'] + '-historical', 'sourceUrl': canonical['sourceUrl'], 'publishedAt': None}]
            canonical.update(sourceUrl=post['source_url'], archived=False, publishedAt=post['data_publication_date'])
            canonical['sources'].append(source_record(original_file, post['source_url']))
            for source_item in canonical['sources']:
                if source_item['title'] == '게시글_기본정보.json':
                    source_item['url'] = post['source_url']
            canonical['warnings'].append('업체명·주소·전화와 첨부 SHA-256이 일치해 현재 게시글에 연결했습니다. 이전 게시글과 원본·추출 근거는 함께 보존합니다.')
            covered_posts.add(post['post_id'])
            continue
        vendor = blank_vendor('venue-post-' + post['post_id'], post['company'], 'venue', post['region'],
            post['address'], post['contact'], post['data_publication_date'], post['source_url'])
        vendor['sources'].append(source_record(VENUE / '게시글_기본정보.json', post['source_url']))
        attachment = mapping.get(post['post_id'])
        if attachment and (VENUE / attachment['local_file']).is_file():
            vendor['sources'].append(source_record(VENUE / attachment['local_file'], post['source_url']))
        vendor['warnings'].append('현재 게시글의 업체 정보와 원본은 확인했으나, 비교 가능한 성인 기본 식대는 아직 검수하지 않았습니다. 이전 공시 가격을 자동 승계하지 않습니다.')
        vendor['documents'].append({'title': '현재 게시글 안내', 'primary': True,
            'sections': [{'heading': '원본과 공시 시점', 'kind': 'text', 'items': ['첨부가 이전 공시와 같은 파일이어도 현재 게시글과 별도 공시로 보존합니다. 금액과 적용 조건은 참가격 원문에서 확인해주세요.']}]})
        vendors.append(vendor)
    return vendors


def price_state(raw):
    if re.search(r'포함|미발생', raw): return 'included'
    if re.fullmatch(r'\s*(무료|무상|0\s*원)\s*', raw): return 'free'
    if re.search(r'별도\s*문의|상담|문의', raw): return 'on_request'
    if re.fullmatch(r'\s*(해당\s*없음|없음|[-―ㅡ.]+)\s*', raw): return 'not_applicable'
    return 'known'


def category_for(sheet, header, next_header, filename):
    text = sheet['name'] + ' ' + filename
    preceding = [(r, source.clean(v)) for r, cols in sheet['rows'].items() if header - 8 <= r < header for c, v in cols.items() if c == 1 and len(source.clean(v)) < 70 and re.search(r'스튜디오|드레스|메이크업', source.clean(v))]
    if preceding:
        nearest = sorted(preceding)[-1][1]
        if re.search(r'메이크업', nearest): return 'makeup'
        if re.search(r'스튜디오', nearest): return 'studio'
        if re.search(r'드레스', nearest): return 'dress'
    header_text = ' '.join(source.clean(v) for r, cols in sheet['rows'].items() if header <= r < min(header + 3, next_header) for v in cols.values())
    if '드레스 도우미' in header_text or '핼퍼' in header_text: return 'dress'
    if '헤어피스' in header_text: return 'makeup'
    if '야외' in header_text or '야간' in header_text: return 'studio'
    if re.search(r'메이크업|헤어', text): return 'makeup'
    if '드레스' in text: return 'dress'
    if re.search(r'스튜디오|촬영|스냅', text): return 'studio'
    if '패키지' in text: return 'package'
    return 'other'


def unit_amounts(raw, multiplier=1):
    """Only explicit currency/numeric amounts; never page/garment/guest quantities."""
    text = source.clean(raw)
    if re.search(r'원|만원|만\s*[~∼]', text):
        return source.money_values(re.sub(r'최소|최대', '', text))
    if multiplier == 10000:
        text = re.sub(r'\d+(?:\.\d+)?\s*(?:페이지|벌|명|인|P|p|R|r|회|장|개|권|컷)', '', text)
        return [round(float(n.replace(',', '')) * multiplier) for n in re.findall(r'\d[\d,]*(?:\.\d+)?', text)]
    return source.money_values(raw)


def base_terms(vendor, sheet, file_source, workbook_unit=1):
    rows = sheet['rows']
    headers = [(r, c) for r, cols in sorted(rows.items()) for c, v in cols.items() if re.fullmatch(r'기본\s*가격(?:\s*\([^)]*\))?', source.clean(v))]
    unit_text = ' '.join(source.clean(v) for cols in rows.values() for v in cols.values() if '단위' in source.clean(v))
    multiplier = 10000 if re.search(r'단위\s*[:：]?\s*만\s*원', unit_text) else workbook_unit
    for hi, (header_row, header_col) in enumerate(headers):
        end = headers[hi + 1][0] if hi + 1 < len(headers) else max(rows, default=0) + 1
        end = min(end, next((r for r, cols in sorted(rows.items()) if r > header_row and any('계약해지' in source.clean(v) or '환급에 관한' in source.clean(v) for v in cols.values())), end))
        category = category_for(sheet, header_row, end, file_source['title'])
        right = next((c for c in sorted(rows[header_row]) if c > header_col), header_col + 2)
        # The merged basic-price header includes both product description and value.
        span_end = next((c2 for r1, c1, r2, c2 in sheet['merges'] if r1 <= header_row <= r2 and c1 == header_col), right - 1)
        last_col = min(span_end, right - 1)
        subheader_row = header_row + 1
        subheaders = {c: source.clean(rows.get(subheader_row, {}).get(c, '')) for c in range(header_col, last_col + 1)}
        first_option_col = next((c for c, label in subheaders.items() if re.search(r'피팅|헬퍼|도우미|선택|옵션|추가|위약|담당자|혼주', label)), last_col + 1)
        last_col = min(last_col, first_option_col - 1)
        current_subject = vendor['name']
        for row, cols in sorted(rows.items()):
            if not header_row + 1 < row < end:
                continue
            subject = source.expanded(sheet, row, 1)
            if subject and len(subject) < 100 and not subject.startswith(('※', '*', '①', '②', '사업자명')):
                current_subject = subject
            condition_col = header_col - 1 if header_col > 2 else header_col
            condition = source.clean(cols.get(condition_col, ''))
            if re.search(r'피팅|혼주|여혼주|남혼주|가봉|추가|헬퍼|도우미|대여\s*\+', condition + ' ' + current_subject):
                continue
            for column in range(header_col, last_col + 1):
                raw = cols.get(column)
                if raw is None:
                    continue
                text = source.clean(raw)
                if column == header_col and not re.search(r'원|만', text) and not re.fullmatch(r'[\d,.\s~∼-]+', text):
                    continue
                if re.search(r'피팅|혼주|여혼주|남혼주|추가|할인|헬퍼|도우미|가봉|\+\s*\d', text):
                    # Preserve complex basic+option mixtures in documents rather than invent a minimum.
                    continue
                state = price_state(text)
                amounts = unit_amounts(raw, multiplier) if state == 'known' else [0] if state == 'free' else []
                amounts = [x for x in amounts if 10000 <= x <= 100000000] if state == 'known' else amounts
                if not amounts and state == 'known':
                    continue
                evidence = {'sourceId': file_source['id'], 'sheet': sheet['name'],
                    'cell': excel_cell(row, column), 'verification': 'structured_unverified'}
                term_category = 'package' if state == 'known' and ('패키지' in condition or re.search(r'스드메.*토탈|스드메\s*패키지', text)) else category
                if term_category != 'package':
                    if re.search(r'메이크업|헤어|뷰티', current_subject):
                        term_category = 'makeup'
                    elif re.search(r'스튜디오|스냅|포토', current_subject):
                        term_category = 'studio'
                product_condition = condition if not re.search(r'원|만원', condition) and not re.fullmatch(r'[\d,.\s~∼-]+', condition) else ''
                subheader = subheaders.get(column, '')
                if subheader and not re.search(r'원|\d', subheader):
                    product_condition = ' · '.join(filter(None, [subheader, product_condition]))
                add_term(vendor, term_category, current_subject, text, amounts, evidence,
                         'package' if term_category == 'package' else 'person' if re.search(r'1\s*인', text) else 'item', product_condition, state=state)


def raw_document(sheet, file_source):
    """Keep every nonempty row, including options and cancellation policies."""
    items = []
    policies = []
    in_policy = False
    for row, cols in sorted(sheet['rows'].items()):
        values = [source.clean(value) for value in cols.values() if source.clean(value)]
        text = ' · '.join(values)
        if not text:
            continue
        if '계약해지' in text or '환급에 관한' in text:
            in_policy = True
        (policies if in_policy else items).append(text)
    sections = [{'heading': '기본상품 · 선택 품목 공시 원문', 'kind': 'text', 'items': items}]
    if policies:
        sections.append({'heading': '계약 취소 · 위약금 · 환급 규정', 'kind': 'text', 'items': policies})
    return {'title': sheet['name'], 'primary': True, 'sourceId': file_source['id'], 'sections': sections}


def read_spreadsheets(path):
    if path.suffix.lower() == '.xlsx':
        return [s for s in source.sheets_from_xlsx(path) if s.get('state', 'visible') == 'visible']
    if path.suffix.lower() == '.csv':
        with path.open(encoding='utf-8-sig', newline='') as handle:
            rows = {r: {c: v for c, v in enumerate(values, 1) if v.strip()} for r, values in enumerate(csv.reader(handle), 1)}
        return [{'name': path.stem, 'state': 'visible', 'rows': rows, 'merges': []}]
    return []


def build_planning():
    manifest = load(PLANNING / '수집목록.json')
    posts = load(PLANNING / '게시글_기본정보.json')['posts']
    files_by_post = {}
    for file in [*manifest['files'], *manifest.get('external_files', [])]:
        post_id = file.get('post_metadata', {}).get('post_id')
        files_by_post.setdefault(post_id, []).append(file)
        for extracted in file.get('extracted_spreadsheets', []):
            files_by_post.setdefault(post_id, []).append(extracted)
    vendors = []
    for post in posts:
        vendor = blank_vendor('planning-' + post['post_id'], post['company'], 'planning', post['region'],
            post['address'], post['contact'], post['data_publication_date'], post['source_url'])
        for file in files_by_post.get(post['post_id'], []):
            path = PLANNING / file['file']
            if not path.exists():
                continue
            file_source = source_record(path, file.get('url', post['source_url']), file.get('sha256'))
            vendor['sources'].append(file_source)
            sheets = read_spreadsheets(path)
            workbook_text = ' '.join(source.clean(v) for sheet in sheets for cols in sheet['rows'].values() for v in cols.values() if '단위' in source.clean(v))
            workbook_unit = 10000 if re.search(r'단위\s*[:：]?\s*만\s*원', workbook_text) else 1
            for sheet in sheets:
                vendor['documents'].append(raw_document(sheet, file_source))
                base_terms(vendor, sheet, file_source, workbook_unit)
        vendor['sources'].append(source_record(PLANNING / '게시글_기본정보.json', post['source_url']))
        basic = [t for t in vendor['priceTerms'] if t['state'] == 'known' and t['role'] == 'payable' and t['min'] is not None and t['min'] > 0]
        free_terms = [t for t in vendor['priceTerms'] if t['state'] == 'free']
        if free_terms:
            vendor['warnings'].append('무료 공시는 해당 촬영·상품 조건에서의 표시입니다. 단독 이용 가능 여부가 확인되지 않아 대표 유료 기본가 비교에서 제외했습니다. 원문과 무료 표시는 아래 상품별 정보에 보존합니다.')
        if any(t['basis'] == 'person' for t in vendor['priceTerms']):
            vendor['warnings'].append('성별·1인 단위 기본상품이 포함되어 있습니다. 이 최저가는 신랑·신부 두 사람의 합계가 아니므로 인원과 상품 구성을 함께 확인해주세요.')
        packages = [t for t in basic if t['category'] == 'package']
        singles = [t for t in basic if t['category'] != 'package']
        vendor.update(packageMin=min((t['min'] for t in packages), default=None),
            packageMax=max((t['max'] for t in packages), default=None),
            serviceMin=min((t['min'] for t in singles), default=None),
            serviceMax=max((t['max'] for t in singles), default=None),
            categories=sorted(set(t['category'] for t in vendor['priceTerms'])))
        vendor['warnings'].append('개별 기본상품은 스드메 전체 합계가 아닙니다. 업체·상품 구성과 선택 비용을 확인해주세요.')
        if not basic:
            vendor['warnings'].append('숫자로 비교 가능한 기본가 미확인. 첨부 원문 또는 업체 문의가 필요합니다.')
        if vendor['publishedAt'] and vendor['publishedAt'] > '2026-10-25':
            vendor['warnings'].append('원문 자료 공개일이 수집일보다 미래입니다. 원문 날짜를 그대로 보존했습니다.')
        vendors.append(vendor)
    return vendors


def actual_media_type(local_path):
    path = ROOT / local_path
    if path.suffix.lower() == '.xls':
        # The MH disclosure is an OLE HWP document despite its .xls filename.
        data = path.read_bytes()
        if data.startswith(bytes.fromhex('d0cf11e0a1b11ae1')) and b'HWP Document File' in data:
            return 'application/x-hwp'
    return mimetypes.guess_type(local_path)[0] or 'application/octet-stream'


def model_export(vendor):
    """Schema-conformant portable record. Structured automatic claims remain unreviewed."""
    disclosure_id = vendor['model']['disclosureId']
    source_ids = {s['id'] for s in vendor['sources']}
    evidence = [{'id': e['id'], 'sourceId': e['sourceId'],
        'locator': {'kind': 'spreadsheet', **({'sheet': e['sheet']} if e.get('sheet') else {}), **({'cellRange': e['cell']} if e.get('cell') else {})},
        'method': 'xml', 'verification': 'unreviewed', 'rawText': e['rawText']} for e in vendor['evidence'] if e['sourceId'] in source_ids]
    metadata_evidence = vendor['id'] + '-metadata'
    metadata_source = next(s for s in vendor['sources'] if s['title'] == '게시글_기본정보.json')
    evidence.append({'id': metadata_evidence, 'sourceId': metadata_source['id'],
        'locator': {'kind': 'whole_source'}, 'method': 'native_text', 'verification': 'source_checked',
        'rawText': vendor['name'] + ' / ' + (vendor['address'] or '') + ' / ' + (vendor['phone'] or '')})
    entities = [{'id': vendor['id'], 'kind': vendor['model']['entityKind'], 'label': vendor['name']}]
    services = sorted(set(t['category'] for t in vendor['priceTerms']))
    entities += [{'id': 'service-' + c, 'kind': 'service:' + c, 'label': c} for c in services]
    terms = []
    conditions = []
    facts = []
    policies = []
    subjects = {}
    for predicate, value in [('location:address', vendor['address']), ('contact:phone', vendor['phone'])]:
        facts.append(dict(id=vendor['id'] + '-fact-' + predicate.split(':')[1], evidenceIds=[metadata_evidence],
            disclosureId=disclosure_id, interpretation='unreviewed', subjectId=vendor['id'],
            predicate=predicate, valueState='known' if value else 'not_disclosed', **({'value': value, 'rawText': value} if value else {})))
    for term in vendor['priceTerms']:
        if term['evidenceId'] not in {e['id'] for e in evidence}:
            continue
        item = dict(id=term['id'], evidenceIds=[term['evidenceId']], disclosureId=disclosure_id,
            interpretation='unreviewed', subjectId=vendor['id'], itemId='service-' + term['category'],
            role=term['role'], state=term['state'],
            basis={'quantity': '1', 'unit': 'unit:person' if term['basis'] == 'person' else 'unit:event'},
            rawText=term['raw'], requirement='unknown', taxTreatment='not_disclosed',
            serviceChargeTreatment='not_disclosed')
        if term['subject'] != vendor['name']:
            subject_id = vendor['id'] + '-subject-' + hashlib.sha256(term['subject'].encode()).hexdigest()[:10]
            if subject_id not in subjects:
                subjects[subject_id] = {'id': subject_id, 'kind': 'core:space' if vendor['kind'] == 'venue' else 'core:organization', 'label': term['subject']}
            item['subjectId'] = subject_id
        if term['condition']:
            condition_id = term['id'] + '-condition'
            conditions.append(dict(id=condition_id, evidenceIds=[term['evidenceId']], disclosureId=disclosure_id,
                interpretation='unreviewed', label='공시 적용 조건', rawText=term['condition'], expression={'op': 'raw', 'text': term['condition']}))
            item['conditionIds'] = [condition_id]
        if term['min'] is not None:
            item.update(currency='KRW', amount={'kind': 'exact', 'value': str(term['min'])} if term['min'] == term['max'] else {'kind': 'range', 'lower': str(term['min']), 'upper': str(term['max'])})
        terms.append(item)
    entities.extend(subjects.values())
    for document in vendor['documents']:
        for section in document['sections']:
            if not re.search(r'취소|위약금|환급', section['heading']):
                continue
            raw = '\n'.join(item for item in section['items'] if isinstance(item, str))
            if raw:
                policy_id = vendor['id'] + '-policy-' + str(len(policies))
                policy_source = next((s for s in vendor['sources'] if s['id'] == document.get('sourceId')), next((s for s in vendor['sources'] if s['format'] == 'XLSX'), metadata_source))
                policy_evidence = policy_id + '-evidence'
                evidence.append(dict(id=policy_evidence, sourceId=policy_source['id'], locator={'kind': 'whole_source'},
                    method='native_text', verification='unreviewed', rawText=raw))
                policies.append(dict(id=policy_id, evidenceIds=[policy_evidence], disclosureId=disclosure_id,
                    interpretation='unreviewed', subjectId=vendor['id'], kind='contract:cancellation',
                    rawText=raw, evaluation='preserve_only', rules=[]))
    return dict(schemaVersion=SCHEMA_VERSION, datasetId=vendor['id'], entities=entities,
        sources=[dict(id=s['id'], kind='attachment', localPath=s['path'], sha256=s['sha256'],
                      mediaType=actual_media_type(s['path']), extractionState='partial') for s in vendor['sources']],
        disclosures=[dict(id=previous['id'], venueId=vendor['id'], sourceIds=list(source_ids),
            observedAt=OBSERVED_AT, status='historical', rawMetadata={'sourceUrl': previous['sourceUrl']}) for previous in vendor['model'].get('previousDisclosures', [])] + [dict(id=disclosure_id, venueId=vendor['id'], sourceIds=list(source_ids),
            observedAt=OBSERVED_AT, status='current_at_observation', rawMetadata={'sourceUrl': vendor['sourceUrl']},
            **({'supersedesId': vendor['model']['previousDisclosures'][-1]['id']} if vendor['model'].get('previousDisclosures') else {}))],
        evidence=evidence, conditions=conditions, facts=facts, priceTerms=terms, relations=[], policies=policies, derivations=[])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    vendors = add_missing_metadata_venues(build_venues()) + build_planning()
    (OUT / 'vendors.json').write_text(json.dumps(vendors, ensure_ascii=False, separators=(',', ':')) + '\n')
    export_dir = ROOT / 'public/data/disclosures'
    export_dir.mkdir(parents=True, exist_ok=True)
    vendor_ids = {vendor['id'] for vendor in vendors}
    for generated in export_dir.glob('*.json'):
        if generated.stem not in vendor_ids and load(generated).get('datasetId') == generated.stem:
            generated.unlink()
    for vendor in vendors:
        (export_dir / (vendor['id'] + '.json')).write_text(json.dumps(model_export(vendor), ensure_ascii=False, separators=(',', ':')) + '\n')
    metadata = dict(checkedAt='2026-10-25', generatedAt=OBSERVED_AT, schemaVersion=SCHEMA_VERSION,
        inputCatalogRecords=len(load(VENUE / 'catalog.json')['venues']),
        inputCurrentVenuePosts=len(load(VENUE / '게시글_기본정보.json')['posts']),
        inputs=[{'path': relative(path), 'sha256': hashlib.sha256(content).hexdigest()} for path, content in INPUT_BYTES.items()],
        venues=sum(v['kind'] == 'venue' for v in vendors), planning=sum(v['kind'] == 'planning' for v in vendors),
        venueMealPrices=sum(v['mealMin'] is not None for v in vendors),
        planningBasicPrices=sum(v['serviceMin'] is not None or v['packageMin'] is not None for v in vendors),
        terms=sum(len(v['priceTerms']) for v in vendors),
        method='Source-grounded projection; XML basic-price extraction; known option rows excluded; unknown values preserved; dates are disclosure snapshot, not booking quotes.')
    (OUT / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
