"""Build a source-grounded static catalogue and human-readable venue documents."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zipfile import ZipFile
import hashlib
import copy
import html
import json
import os
import posixpath
import re
import unicodedata
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'database/참가격_웨딩홀_업체별_공시원본'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
MONEY = re.compile(r'(\d[\d,]*(?:\.\d+)?)\s*(억\s*원?|천만\s*원?|백만\s*원?|십만\s*원?|만\s*원?|천\s*원?|원)?')


def clean(value):
    value = str('' if value is None else value).replace('\r\n', '\n').replace('\r', '\n')
    value = ''.join(c for c in value if unicodedata.category(c) != 'Co')
    return re.sub(r'[ \t]+', ' ', value).strip()


def money_values(value):
    """Return explicit/bare money amounts, never guest counts, dates or percentages."""
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        return [int(value)] if value == 0 or value >= 1000 else []
    text = clean(value)
    if re.fullmatch(r'(무료|무상|0\s*원)', text):
        return [0]
    text = re.sub(r'(\d+(?:\.\d+)?)\s*만\s*(\d+(?:\.\d+)?)\s*천\s*원?', lambda m: f'{round(float(m[1])*10000 + float(m[2])*1000)}원', text)
    text = re.sub(r'(?<!\d)(\d{1,3}(?:\.\d{3})+)(?!\d)', lambda m: m[1].replace('.', ','), text)
    matches = list(MONEY.finditer(text))
    amounts = []
    for i, match in enumerate(matches):
        if ',' in match[1] and not re.fullmatch(r'\d{1,3}(?:,\d{3})+(?:\.\d+)?', match[1]):
            continue
        after = text[match.end():].lstrip()
        if not match[2] and re.match(r'(명|인(?!당\s*[:：])|년|월|일|%|시|층|분)', after):
            continue
        number = float(match[1].replace(',', ''))
        unit = match[2] or ''
        if not unit and i + 1 < len(matches):
            gap = text[match.end():matches[i + 1].start()]
            if re.fullmatch(r'\s*[~∼〜–-]\s*', gap) and matches[i + 1][2]:
                unit = matches[i + 1][2]
        multiplier = 100000000 if '억' in unit else 10000000 if '천만' in unit else 1000000 if '백만' in unit else 100000 if '십만' in unit else 10000 if '만' in unit else 1000 if '천' in unit else 1
        amount = round(number * multiplier)
        if unit or amount >= 1000:
            amounts.append(amount)
    return amounts


def price(value, low=0, high=500000000):
    values = [v for v in money_values(value) if low <= v <= high]
    return {'min': min(values), 'max': max(values), 'raw': clean(value)} if values else None


def discount_delta(label):
    leaf = label.split('/')[-1].strip()
    return bool(re.search(r'할인\s*$|할인액|할인\s*금액', leaf)) and not re.search(r'할인가|할인\s*후|적용\s*후|할인\s*단가', leaf)


def coord(ref):
    letters, row = re.fullmatch(r'([A-Z]+)(\d+)', ref).groups()
    column = 0
    for char in letters:
        column = column * 26 + ord(char) - 64
    return int(row), column


def sheets_from_xlsx(path):
    with ZipFile(path) as archive:
        style_ids = []
        custom_formats = {}
        if 'xl/styles.xml' in archive.namelist():
            styles = ET.fromstring(archive.read('xl/styles.xml'))
            custom_formats = {int(n.attrib['numFmtId']): n.attrib['formatCode'] for n in styles.findall('s:numFmts/s:numFmt', NS)}
            style_ids = [int(n.attrib.get('numFmtId', '0')) for n in styles.findall('s:cellXfs/s:xf', NS)]
        def part_relationships(part):
            filename = posixpath.join(posixpath.dirname(part), '_rels', posixpath.basename(part) + '.rels')
            if filename not in archive.namelist():
                return {}
            output = {}
            for relation in ET.fromstring(archive.read(filename)):
                target = relation.attrib['Target']
                if relation.attrib.get('TargetMode') != 'External':
                    target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part), target))
                output[relation.attrib['Id']] = {'target': target, 'type': relation.attrib['Type']}
            return output
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            for item in ET.fromstring(archive.read('xl/sharedStrings.xml')):
                shared.append(''.join(item.itertext()))
        rels = {}
        for node in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels')):
            target = node.attrib['Target']
            rels[node.attrib['Id']] = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
        output = []
        for node in ET.fromstring(archive.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS):
            xml = ET.fromstring(archive.read(rels[node.attrib[REL]]))
            annotations = []
            invalid_styles = []
            cells = {}
            rows = defaultdict(dict)
            for cell in xml.findall('.//s:sheetData/s:row/s:c', NS):
                raw = cell.find('s:v', NS)
                value = raw.text if raw is not None else None
                kind = cell.attrib.get('t', '')
                if kind == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext()) if cell.find('s:is', NS) is not None else None
                elif kind == 's' and value is not None:
                    value = shared[int(value)]
                elif kind in ['', 'n'] and value is not None:
                    try:
                        number = float(value)
                        value = int(number) if number.is_integer() else number
                        style_index = int(cell.attrib.get('s', '0'))
                        if style_index >= len(style_ids):
                            invalid_styles.append(cell.attrib['r'])
                        else:
                            format_id = style_ids[style_index]
                            format_code = custom_formats.get(format_id, '')
                            if format_id in [9, 10] or '%' in format_code:
                                value = f'{number * 100:g}%'
                            elif format_id in range(14, 23):
                                converted = datetime(1899, 12, 30) + timedelta(days=number)
                                value = converted.strftime('%H:%M') if format_id in range(18, 22) else converted.strftime('%Y-%m-%d')
                    except ValueError:
                        pass
                if value is None or value == '':
                    continue
                ref = cell.attrib['r']
                cells[ref] = value
                r, c = coord(ref)
                rows[r][c] = value
            merges = []
            for merged in xml.findall('s:mergeCells/s:mergeCell', NS):
                start, end = merged.attrib['ref'].split(':')
                r1, c1 = coord(start)
                r2, c2 = coord(end)
                merges.append((r1, c1, r2, c2))
            sheet_rels = part_relationships(rels[node.attrib[REL]])
            for relation in sheet_rels.values():
                if relation['type'].endswith('/drawing'):
                    drawing = ET.fromstring(archive.read(relation['target']))
                    for paragraph in drawing.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}p'):
                        text = ''.join(paragraph.itertext()).strip()
                        if text:
                            annotations.append('원문 도형 안내: ' + text)
                elif relation['type'].endswith('/comments'):
                    comments = ET.fromstring(archive.read(relation['target']))
                    for comment in comments.findall('s:commentList/s:comment', NS):
                        text = ''.join(comment.itertext()).strip()
                        if text:
                            annotations.append('원문 주석: ' + text)
            for hyperlink in xml.findall('s:hyperlinks/s:hyperlink', NS):
                target = sheet_rels.get(hyperlink.attrib.get(REL), {}).get('target', hyperlink.attrib.get('location', ''))
                if target:
                    annotations.append(f"참고 링크 ({clean(cells.get(hyperlink.attrib['ref'], '원문'))}): {target}")
            output.append({'name': node.attrib['name'], 'state': node.attrib.get('state', 'visible'), 'cells': cells, 'rows': dict(rows), 'merges': merges, 'annotations': annotations, 'invalidStyles': invalid_styles})
        return output


def expanded(sheet, row, col):
    value = sheet['rows'].get(row, {}).get(col)
    if value is not None:
        return clean(value)
    for r1, c1, r2, c2 in sheet['merges']:
        if r1 <= row <= r2 and c1 <= col <= c2:
            return clean(sheet['rows'].get(r1, {}).get(c1, ''))
    return ''


def guest_count(text):
    text = clean(text)
    match = re.search(r'(?:기본|보증(?:인원)?|최소(?:보증인원)?)\s*[:：]?\s*([\d,]+)\s*(?:명|인)', text)
    return int(match[1].replace(',', '')) if match else None


def price_block(sheet, header=None):
    rows = sheet['rows']
    header = header or next((r for r, values in sorted(rows.items()) if r < 80 and any(re.search(r'예식홀명|예식장명|홀명|식사메뉴', clean(v)) and len(clean(v)) < 80 for v in values.values())), None)
    if header is None:
        return None
    end = next((r for r, values in sorted(rows.items()) if r > header and any(re.search(r'계약해지.*위약금|계약.*환급.*기준', clean(v)) for v in values.values())), max(rows, default=0) + 1)
    repeated = next((r for r, values in sorted(rows.items()) if r > header and any(re.search(r'예식홀명|예식장명', clean(v)) for v in values.values())), end)
    end = min(end, repeated)
    first = next((r for r in sorted(rows) if header < r < end and any(money_values(v) for v in rows[r].values())), None)
    if first is None:
        return None
    max_col = max((max(row, default=0) for row in rows.values()), default=0)
    labels = {}
    for col in range(1, max_col + 1):
        parts = []
        for row in range(header, first):
            value = expanded(sheet, row, col)
            if value and value not in parts and len(value) < 160:
                parts.append(value)
        labels[col] = ' / '.join(parts)
    # Some original templates omit the horizontal merge but still use adjacent
    # condition/price columns beneath a single food or rental heading.
    previous = ''
    for col in range(1, max_col + 1):
        if labels[col]:
            previous = labels[col]
        elif previous:
            labels[col] = previous
    if any('식사메뉴' in label for label in labels.values()):
        labels = {c: ('식대 / ' + label if label == '금액' else label) for c, label in labels.items()}
    hall_col = next((c for c, label in labels.items() if re.search(r'예식홀명|예식장명|홀명', label)), 1)
    return {'header': header, 'first': first, 'end': end, 'labels': labels, 'hall_col': hall_col}


def parse_offers(sheet, selected_block=None):
    if selected_block is None:
        blocks = [price_block(sheet, r) for r, values in sorted(sheet['rows'].items()) if any(re.search(r'예식홀명|예식장명|홀명|식사메뉴', clean(v)) and len(clean(v)) < 80 for v in values.values())]
        blocks = [block for block in blocks if block]
        if len(blocks) > 1:
            return [offer for block in blocks for offer in parse_offers(sheet, block)]
    block = selected_block or price_block(sheet)
    if not block:
        # MH HWP-derived workbook: explicitly transcribed source values.
        if sheet['name'] == '가격 안내':
            meal = next((price(v[2]) for v in sheet['rows'].values() if v.get(1) == '뷔페 식대' and 2 in v), None)
            rent = next((price(v[2]) for v in sheet['rows'].values() if v.get(1) == '홀 대관료' and 2 in v), None)
            return [{'hall': '원본 가격 안내', 'meal': meal, 'rental': rent, 'rentalKind': 'rental', 'decoration': None, 'guests': None, 'condition': '적용연도 미기재. 원본 스캔에서 옮긴 금액.', 'evidence': {'sheet': sheet['name'], 'row': 9}, 'additional': False}] if meal else []
        return []
    labels = block['labels']
    food_cols = [c for c, label in labels.items() if re.search(r'(?<!장)식비|식대|뷔페|식음료', label) and not re.search(r'추가|선택품목', label) and not discount_delta(label) and not re.fullmatch(r'\s*(음주류|음료|주류)\s*', label.split('/')[-1])]
    rent_cols = [c for c, label in labels.items() if re.search(r'대관|대여|사용료', label) and not re.search(r'추가|선택', label) and not discount_delta(label)]
    decoration_cols = [c for c, label in labels.items() if re.search(r'장식|플라워', label) and not re.search(r'추가|선택|대관', label)]
    offers = []
    current_hall = '전체 홀'
    for row_index in sorted(sheet['rows']):
        if not block['first'] <= row_index < block['end']:
            continue
        values = sheet['rows'][row_index]
        hall = expanded(sheet, row_index, block['hall_col'])
        if hall and len(hall) < 100 and not re.search(r'^(※|②|③|기본|추가|대관|장식|\*|보증)', hall):
            current_hall = hall
        context = ' '.join(clean(v) for v in values.values())
        additional = bool(re.search(r'추가\s*1\s*(?:명|인)', context))
        guests = next((g for v in values.values() if (g := guest_count(v))), None)
        for col in food_cols:
            raw = values.get(col)
            if raw is None:
                continue
            if re.search(r'소인|어린이|아동|초등', clean(raw)):
                continue
            meal = price(raw, 0, 600000)
            # A package total cannot become a cheap per-person amount by filtering its endpoints.
            amounts = money_values(raw)
            if amounts and max(amounts) > 600000:
                continue
            if not meal:
                continue
            rent = None
            rental_kind = 'rental'
            for rc in rent_cols:
                candidate = values.get(rc)
                if candidate is None or re.search(r'정가\s*[:：]', clean(candidate)):
                    continue
                left = clean(values.get(rc - 1, ''))
                if re.search(r'장식|생화|무대', left) and not re.search(r'대관', left):
                    continue
                parsed = price(candidate, 0, 500000000)
                if parsed and (parsed['min'] == 0 or parsed['min'] >= 10000):
                    rent = parsed
                    if re.search(r'대관\s*[+＋·및]\s*장식|대관.*장식.*포함', left + ' ' + labels[rc]):
                        rental_kind = 'combined'
            decoration = next((p for c in decoration_cols if (p := price(values.get(c, ''), 0, 500000000))), None)
            cell_label = labels[col]
            left_condition = clean(values.get(col - 1, ''))
            local_guest = guest_count(raw) or guest_count(left_condition) or guests
            offers.append({'hall': current_hall, 'meal': meal, 'rental': rent, 'rentalKind': rental_kind, 'decoration': decoration, 'guests': local_guest, 'condition': ' · '.join(filter(None, [left_condition if re.search(r'기본|보증|추가|명|인', left_condition) else '', cell_label if re.search(r'성수기|비수기|피크|정가|적용|할인', cell_label) else ''])), 'evidence': {'sheet': sheet['name'], 'row': row_index, 'column': col}, 'additional': additional})
    # A declaration on a following line is still the rental for that hall.
    for offer in offers:
        if not offer['rental']:
            for other in offers:
                if other['hall'] == offer['hall'] and other['rental']:
                    offer['rental'] = other['rental']
                    offer['rentalKind'] = other['rentalKind']
                    break
    unique = {}
    for offer in offers:
        signature = json.dumps({k: v for k, v in offer.items() if k != 'evidence'}, ensure_ascii=False, sort_keys=True)
        unique.setdefault(signature, offer)
    return list(unique.values())


def semantic_sections(sheet):
    blocks = [price_block(sheet, r) for r, values in sorted(sheet['rows'].items()) if any(re.search(r'예식홀명|예식장명|홀명|식사메뉴', clean(v)) and len(clean(v)) < 80 for v in values.values())]
    blocks = [block for block in blocks if block]
    sections = []
    notes = []
    cancellation = []
    details = []
    in_cancel = False
    for row, values in sorted(sheet['rows'].items()):
        block = next((block for block in blocks if block['first'] <= row < block['end']), None)
        texts = [clean(v) for v in values.values() if clean(v) and clean(v) not in ['-', '—']]
        if not texts:
            continue
        joined = '\n'.join(dict.fromkeys(texts))
        if re.search(r'계약해지.*위약금|계약.*환급.*기준', joined):
            in_cancel = True
        if in_cancel:
            cancellation.append(joined)
            continue
        if block and block['first'] <= row < block['end']:
            fields = []
            skipped = set()
            for col, value in sorted(values.items()):
                if col in skipped:
                    continue
                text = clean(value)
                if not text or text in ['-', '—'] or col == block['hall_col']:
                    continue
                label = block['labels'].get(col, '')
                next_value = values.get(col + 1)
                if next_value is not None and money_values(next_value) and re.search(r'^(기본|추가|보증|최소|대관|장식비|생화|예식비)', text):
                    label = text
                    text = clean(next_value)
                    skipped.add(col + 1)
                label = re.sub(r'필수품목 가격\s*/?|선택품목 가격\s*/?', '', label).strip(' /') or '상세 안내'
                fields.append({'label': label, 'value': text})
            hall = expanded(sheet, row, block['hall_col'])
            if fields or hall:
                details.append({'title': hall or '세부 조건과 추가 항목', 'fields': fields})
        elif not any(b['header'] <= row < b['first'] for b in blocks):
            if not re.fullmatch(r'[①②③④⑤]?\s*가격.*', joined) and len(joined) > 4:
                notes.append(joined)
    if details:
        sections.append({'heading': '홀별 세부 조건과 추가 항목', 'kind': 'details', 'items': details})
    if notes:
        sections.append({'heading': '공시 안내와 제공 조건', 'kind': 'text', 'items': list(dict.fromkeys(notes))})
    if cancellation:
        sections.append({'heading': '계약 취소·위약금·환급 규정', 'kind': 'text', 'items': cancellation})
    if sheet.get('annotations'):
        sections.append({'heading': '원문에 덧붙인 안내와 참고 링크', 'kind': 'text', 'items': sheet['annotations']})
    return sections


def text_metadata(path):
    prefix = path.read_text().split('===== EXCEL_CONTENT_EXPORT_V1 =====')[0]
    return dict(line.split(': ', 1) for line in prefix.splitlines() if ': ' in line)


def won(value):
    if value is None:
        return '미공개'
    return f'{value:,}원'


def price_text(value):
    if not value:
        return '원문 확인'
    return won(value['min']) if value['min'] == value['max'] else f"{won(value['min'])} ~ {won(value['max'])}"


def escape(text):
    return html.escape(clean(text), quote=False).replace('|', '&#124;').replace('\n', '<br>')


def document(venue):
    lines = [f"# {venue['name']}", '', f"{venue['region']}에 있는 {venue['type']}의 공개 공시를 위치·가격·이용 조건으로 정리했습니다.", '', '## 위치와 연락처', '',
             f"- **주소:** {venue['address']}", f"- **전화:** {venue['phone']}", f"- **자료 공개일:** {venue['publishedAt']}", f"- **가격 자료 표기 연도:** {venue['priceYear'] or '연도 미기재'}", '', '## 가격 한눈에 보기', '']
    if venue['offers']:
        lines += ['| 홀·상품 | 기본·보증 인원 | 성인 1인 식대 | 대관 비용 | 적용 조건 |', '| --- | --- | --- | --- | --- |']
        for offer in venue['offers']:
            kind = ' (대관·장식 합계)' if offer['rentalKind'] == 'combined' else ''
            lines.append('| ' + ' | '.join([escape(offer['hall']), f"{offer['guests']}명" if offer['guests'] else '원문 확인', price_text(offer['meal']) + (' (추가 인원)' if offer['additional'] else ''), price_text(offer['rental']) + kind, escape(offer['condition']) or '원문 조건 참고']) + ' |')
    else:
        lines += ['공시 자료에서 성인 1인 기본 식대를 통계용으로 확정하지 못했습니다. 아래 안내와 원본 가격표를 확인하세요.']
    lines += ['', '가격 범위는 공시된 조건의 범위입니다. 예약 가능 여부나 확정 견적을 의미하지 않으며, 대관·장식·필수 추가 항목의 포함 여부는 아래 조건과 원문을 함께 확인해야 합니다.', '']
    for sheet in venue['documents']:
        lines += [f"## {sheet['title']}", '']
        if sheet['primary']:
            lines += ['대표 가격 공시로 사용한 자료입니다.', '']
        elif sheet.get('state') != 'visible':
            lines += ['원본에 숨김 상태로 들어 있는 별도·참고 자료입니다. 이 업체의 대표 가격 통계에는 사용하지 않습니다.', '']
        for section in sheet['sections']:
            lines += [f"### {section['heading']}", '']
            if section['kind'] == 'details':
                for item in section['items']:
                    lines += [f"#### {item['title']}", '']
                    for field in item['fields']:
                        lines += [f"- **{escape(field['label'])}:** {escape(field['value'])}"]
                    lines += ['']
            else:
                for item in section['items']:
                    lines += [clean(item), '']
    if venue['assets']:
        lines += ['## 원본 이미지와 이미지 안내', '', '원본 가격표·로고·계약서 이미지를 보존했습니다. 이미지에서 자동 인식한 안내는 판독 오류가 있을 수 있어 가격 통계의 확정 근거로 사용하지 않습니다.', '']
        for asset in venue['assets']:
            relative = os.path.relpath(ROOT / asset['path'], (ROOT / venue['files']['md']).parent)
            if Path(relative).suffix.lower() == '.emf':
                lines += [f'[원본 벡터 이미지](<{relative}>)', '']
            else:
                lines += [f"![{venue['name']} 원본 공시 이미지](<{relative}>)", '']
            if asset.get('text'):
                lines += ['### 이미지에서 읽은 안내', '', asset['text'], '']
    if venue['warnings']:
        lines += ['## 확인할 사항', '', *[f'- {warning}' for warning in venue['warnings']], '']
    lines += ['## 원본과 출처', '']
    for key, label in [('xlsx','공시 XLSX'),('original','공시 원본'),('txt','기본정보 및 전체 추출 TXT')]:
        if venue['files'].get(key):
            target = os.path.relpath(ROOT / venue['files'][key], (ROOT / venue['files']['md']).parent)
            lines += [f'- [{label}](<{target}>)']
    lines += [f"- [참가격 게시물]({venue['sourceUrl']})", f"- [참가격 본문]({venue['bodyUrl']})", '', '원문 조건과 수치를 보존해 항목별로 재구성했습니다. 병합 위치나 Excel 행·열 번호는 이용자 문서의 표 구조로 사용하지 않습니다.', '']
    return '\n'.join(lines)


def supplement_content(item):
    """Expose supplemental OCR with its originals; do not turn it into verified prices."""
    md = BASE / item.get('markdown', '')
    if not md.is_file():
        return [], []
    text = md.read_text()
    sections = []
    blocks = re.findall(r'```[^\n]*\n(.*?)```', text, re.S)
    for block in blocks:
        before, after = [], []
        cancel = False
        for line in block.splitlines():
            line = clean(line)
            if not line:
                continue
            if re.search(r'위약|계약.*해지|취소.*환급', line):
                cancel = True
            (after if cancel else before).append(line)
        if before:
            sections.append({'heading':'가격·이용 안내 (원문 자동 판독)', 'kind':'text', 'items':before})
        if after:
            sections.append({'heading':'취소·환급 안내 (원문 자동 판독)', 'kind':'text', 'items':after})
    if not sections:
        sections.append({'heading':'추가 공시 안내','kind':'text','items':['원본 및 별도 추출 문서에서 상세 정보를 확인할 수 있습니다.']})
    assets = []
    for target in re.findall(r'!\[[^\]]*\]\(<([^>]+)>\)', text):
        path = (md.parent / target).resolve()
        if path.is_file() and path.is_relative_to(BASE.resolve()):
            assets.append({'path':str(path.relative_to(ROOT)), 'text':'', 'ocr':False})
    return sections, assets


def include_all_posts(venues):
    metadata_path = BASE / '게시글_기본정보.json'
    if not metadata_path.exists():
        return venues
    extra_path = BASE / '추가원본_수집목록.json'
    extra = json.loads(extra_path.read_text()) if extra_path.exists() else {'files':[], 'current_attachment_mapping':[]}
    by_post = {v['postId']:v for v in venues}
    by_file = {str((ROOT / v['files']['xlsx']).relative_to(BASE)):v for v in venues}
    extras = defaultdict(list)
    for item in extra.get('files', []):
        source = BASE / item['file']
        if source.is_file():
            if hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
                raise ValueError(f'Supplement source changed: {source}')
            extras[item['post_id']].append(item)
    mappings = defaultdict(list)
    for item in extra.get('current_attachment_mapping', []):
        mappings[item['post_id']].append(item)
    for post in json.loads(metadata_path.read_text())['posts']:
        identifier = post['post_id']
        venue = by_post.get(identifier)
        if venue is None:
            # Connect an archived price sheet only on an exact name+address match.
            simplify = lambda s: re.sub(r'[\s,.()\-]', '', clean(s))
            venue = next((v for v in venues if v['archived'] and simplify(v['name']) == simplify(post['company']) and simplify(v['address']) == simplify(post['address'])), None)
        if venue is None:
            shared = next((by_file.get(item.get('local_file')) for item in mappings[identifier] if by_file.get(item.get('local_file'))), None)
            safe_name = re.sub(r'[\\/:*?"<>|]', '_', post['company'])[:90]
            profile = BASE / post['region'] / f'{safe_name}__post-{identifier}.md'
            if shared:
                venue = copy.deepcopy(shared)
                venue['duplicateOf'] = shared['id']
                venue['warnings'].append('다른 공시와 동일한 원본 파일을 공유하므로 가격 통계에는 한 번만 반영합니다.')
            else:
                venue = {'offers':[], 'metrics':{k:None for k in ['mealMin','mealMax','rentalMin','combinedMin','guestsMin']}, 'documents':[], 'assets':[], 'warnings':['이 자료의 가격은 원문·자동 판독 대조가 필요해 숫자 통계에서 제외합니다.'], 'archived':False, 'primarySheet':'추가 공시 원문', 'priceYear':None, 'sourceSha256':''}
            venue.update({'id':'p'+identifier, 'name':post['company'], 'region':post['region'], 'address':post['address'], 'phone':post['contact'], 'publishedAt':post['data_publication_date'], 'sourceUrl':post['source_url'], 'bodyUrl':post['body_url'], 'type':'호텔' if re.search(r'호텔|리조트|메리어트|조선|하얏트|워커힐|앰배서더', post['company']) else '웨딩홀'})
            venue['files'] = {**(shared['files'] if shared else {}), 'md':str(profile.relative_to(ROOT)), 'txt':str(profile.with_suffix('.txt').relative_to(ROOT))}
            venue['generatedProfile'] = True
            venues.append(venue)
        venue['postId'] = identifier
        venue['currentSourceUrl'] = post['source_url']
        attached = []
        for item in extras[identifier]:
            source = BASE / item['file']
            attached.append({'path':str(source.relative_to(ROOT)), 'format':item['format'], 'title':source.name})
            sections, assets = supplement_content(item)
            venue['documents'].append({'title':item['company']+' · '+item['format'].upper()+' 공시', 'primary':False, 'state':'visible', 'sections':sections})
            venue['assets'].extend(asset for asset in assets if not any(old['path'] == asset['path'] for old in venue['assets']))
        if attached:
            venue['attachments'] = attached
            venue['files'].setdefault('original', attached[0]['path'])
        elif not venue['files'].get('xlsx'):
            venue['warnings'].append('기본정보만 공개되었거나 내려받을 수 있는 가격 첨부가 없습니다. 게시물 또는 전화로 상세 조건을 확인하세요.')
        by_post[identifier] = venue
    return venues


def build():
    manifest = json.loads((BASE / '수집목록.json').read_text())
    ocr = json.loads((BASE / 'image-text.json').read_text()) if (BASE / 'image-text.json').exists() else {}
    source_files = [item for item in manifest['files'] if item['file'].startswith('03_참가격_업체별_공시원본/')]
    venues = []
    for source in source_files:
        old = BASE / source['file'].split('/', 1)[1]
        path = old.with_suffix('.xlsx')
        meta = text_metadata(path.with_suffix('.txt'))
        sheets = sheets_from_xlsx(path)
        parsed = [parse_offers(sheet) for sheet in sheets]
        candidates = [i for i, offers in enumerate(parsed) if offers and sheets[i]['state'] == 'visible']
        primary = next((i for i in candidates if re.search(r'현재|최신', sheets[i]['name'])), candidates[0] if candidates else 0)
        offers = parsed[primary]
        base_offers = [o for o in offers if not o['additional']]
        meals = [o['meal'] for o in base_offers if o['meal']]
        rentals = [o['rental'] for o in base_offers if o['rental'] and o['rentalKind'] == 'rental']
        combined = [o['rental'] for o in base_offers if o['rental'] and o['rentalKind'] == 'combined']
        name = meta.get('업체명', path.stem.split('__')[0])
        region = source.get('region', path.parent.name).replace('_이전공시', '')
        kind = '호텔' if re.search(r'호텔|리조트|스파텔|쉐라톤|팰리스|파크하얏트|롯데시티|조선|메리어트|워커힐|앰배서더|하얏트|노보텔', name) else '웨딩홀'
        first_rows = ' '.join(clean(v) for row, values in sheets[primary]['rows'].items() if row < 5 for v in values.values()) if sheets else ''
        years = re.findall(r'(202[4-9]|203\d)\s*년', first_rows + ' ' + sheets[primary]['name']) if sheets else []
        relative = path.relative_to(ROOT)
        warnings = []
        archived = '_이전공시' in str(old)
        if archived:
            warnings.append('이전 공시 자료로 기본 가격 통계에서 제외합니다.')
        published = meta.get('자료 공개일(게시물 본문 원문)', '')
        if not re.fullmatch(r'20\d{2}-\d{2}-\d{2}', published):
            warnings.append(f'원문 공개일 표기 확인 필요: {published}')
        if not meals:
            warnings.append('기본 성인 1인 식대를 확정하지 못해 해당 가격 통계에서 제외합니다. 패키지·이미지·별도 상담 항목을 확인하세요.')
        if any(sheet.get('invalidStyles') for sheet in sheets):
            warnings.append('원본의 일부 셀에 유효하지 않은 표시 형식 참조가 있습니다. 값은 보존했으며 별도 서식을 추정하지 않았습니다.')
        assets = []
        asset_dir = path.parent / (path.stem + '.assets')
        if asset_dir.exists():
            for asset in sorted(asset_dir.iterdir()):
                recognized = ocr.get(str(asset.relative_to(BASE)), [])
                lines = [line for line in recognized if line.get('text')]
                lines.sort(key=lambda line: (-round(line['y'] / .015), line['x']))
                assets.append({'path': str(asset.relative_to(ROOT)), 'text': '\n'.join(line['text'] for line in lines), 'ocr': bool(lines)})
        venue = {
            'id': source['filename'].rsplit('__', 1)[-1].split('.')[0], 'name': name, 'region': region,
            'postId': meta.get('게시물 번호', ''),
            'address': meta.get('주소', ''), 'phone': meta.get('연락처', ''), 'publishedAt': published,
            'priceYear': int(years[0]) if len(set(years)) == 1 else None, 'type': kind, 'archived': archived,
            'primarySheet': sheets[primary]['name'] if sheets else '', 'offers': offers,
            'metrics': {'mealMin': min((p['min'] for p in meals), default=None), 'mealMax': max((p['max'] for p in meals), default=None), 'rentalMin': min((p['min'] for p in rentals), default=None), 'combinedMin': min((p['min'] for p in combined), default=None), 'guestsMin': min((o['guests'] for o in base_offers if o['guests']), default=None)},
            'documents': [{'title': sheet['name'], 'primary': i == primary, 'state': sheet['state'], 'sections': semantic_sections(sheet)} for i, sheet in enumerate(sheets) if sheet['cells']],
            'assets': assets, 'warnings': warnings, 'sourceUrl': meta.get('게시물 URL', ''), 'bodyUrl': meta.get('본문 URL', ''),
            'files': {ext: str(relative.with_suffix('.' + ext)) for ext in ['xlsx', 'txt', 'md']},
            'sourceSha256': hashlib.sha256(old.read_bytes()).hexdigest(),
        }
        if venue['sourceSha256'] != source['sha256']:
            raise ValueError(f'Original source changed: {old}')
        venues.append(venue)
    venues = include_all_posts(venues)
    venues.sort(key=lambda v: (v['region'], v['name']))
    for venue in venues:
        destination = ROOT / venue['files']['md']
        destination.parent.mkdir(exist_ok=True, parents=True)
        contents = document(venue)
        destination.write_text(contents)
        if venue.get('generatedProfile'):
            (ROOT / venue['files']['txt']).write_text(contents)
    # Rebuild the two entry documents with named business fields as well.
    index_lines = ['# 웨딩홀 정보 목록', '', '업체별 정보를 위치·홀별 가격·추가 항목·이용 조건·취소 규정으로 재구성했습니다. 웹과 Markdown은 같은 자료를 사용합니다.', '', '| 지역 | 업체 | 공시 1인 식대 | 상세 문서 | Excel | TXT |', '| --- | --- | --- | --- | --- | --- |']
    for venue in venues:
        paths = {key: str((ROOT / value).relative_to(BASE)) for key, value in venue['files'].items()}
        meal = None if venue['metrics']['mealMin'] is None else {'min': venue['metrics']['mealMin'], 'max': venue['metrics']['mealMax']}
        original = paths.get('xlsx') or paths.get('original')
        index_lines.append('| ' + ' | '.join([escape(venue['region']), escape(venue['name']), price_text(meal), f"[읽기](<{paths['md']}>)", f"[열기](<{original}>)" if original else '첨부 없음', f"[열기](<{paths['txt']}>)"]) + ' |')
    (BASE / '엑셀_추출_목록.md').write_text('\n'.join(index_lines) + '\n')
    overview = BASE / 'outputs/2026-10-25-company-details/업체별_기본정보.md'
    workbook_venues = [venue for venue in venues if not venue.get('generatedProfile')]
    summary_lines = ['# 웨딩홀 전체 기본정보', '', f'통합 Excel과 대응하는 {len(workbook_venues)}개 원본 공시의 기본정보입니다. 전체 게시물은 상위 전체 정보 목록에서 확인할 수 있습니다.', '', '| 업체 | 지역 | 주소 | 연락처 | 자료 공개일 | 상세 안내 |', '| --- | --- | --- | --- | --- | --- |']
    for venue in workbook_venues:
        target = os.path.relpath(ROOT / venue['files']['md'], overview.parent)
        summary_lines.append('| ' + ' | '.join([escape(venue[key]) for key in ['name','region','address','phone','publishedAt']] + [f'[읽기](<{target}>)']) + ' |')
    overview.write_text('\n'.join(summary_lines) + '\n')
    catalogue = {'schemaVersion': 2, 'title': 'Vow Atlas', 'checkedAt': '2026-10-25', 'method': {'meal': '대표 공시의 성인 1인 기본 식대 최저값. 소인·추가 인원·패키지·이미지 추정 가격 제외.', 'rental': '공간 대관료와 대관·장식 합계를 분리. 추가 장식과 전체 필수 비용을 합산한 견적이 아님.', 'years': '적용연도 미기재 공시 포함. 자료 공개일과 적용연도 구분.'}, 'venues': venues}
    (BASE / 'catalog.json').write_text(json.dumps(catalogue, ensure_ascii=False, separators=(',', ':')))
    (BASE / 'catalog.js').write_text('globalThis.WeddingCatalog=' + json.dumps(catalogue, ensure_ascii=False, separators=(',', ':')) + ';\n')
    summary = {'venues': len(venues), 'mealComparable': sum(v['metrics']['mealMin'] is not None and not v['archived'] and not v.get('duplicateOf') for v in venues), 'rentalComparable': sum(v['metrics']['rentalMin'] is not None and not v['archived'] and not v.get('duplicateOf') for v in venues), 'combinedComparable': sum(v['metrics']['combinedMin'] is not None and not v['archived'] and not v.get('duplicateOf') for v in venues), 'unpriced': [v['name'] for v in venues if v['metrics']['mealMin'] is None], 'mealOutliers': [(v['name'], v['metrics']['mealMin']) for v in venues if v['metrics']['mealMin'] is not None and (v['metrics']['mealMin'] < 25000 or v['metrics']['mealMin'] > 200000)]}
    (BASE / 'docs/flow/2026-10-25-catalog-coverage.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return catalogue


if __name__ == '__main__':
    build()
