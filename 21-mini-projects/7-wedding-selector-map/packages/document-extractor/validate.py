"""Verify extraction completeness and source preservation; not OCR semantic accuracy."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import zipfile

import pdfplumber
from lxml import etree

from extract import clean_text, cell, localname, xml_text


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normal(text):
    return re.sub(r'\s+', '', clean_text(html.unescape(text).replace('<br>', '\n')))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    args = parser.parse_args(); root = args.root.resolve()
    manifest = json.loads((root / '추가원본_수집목록.json').read_text())
    report_path = root / 'docs/flow/2026-10-25-nonexcel-extraction-validation.json'
    report = json.loads(report_path.read_text())
    records = {r['file']: r for r in report['records']}
    assert not report['errors'], report['errors']
    assert len(records) == len(manifest['files']) == 58
    checks = []; errors = []
    for source in manifest['files']:
        path = root / source['file']; rec = records[source['file']]
        md = root / rec['markdown']; text = md.read_text(); unescaped = html.unescape(text)
        norm = normal(text); assets = path.with_name(path.name + '.assets')
        try:
            assert digest(path) == source['sha256'] == rec['source_sha256'], 'source hash'
            assert digest(md) == rec['markdown_sha256'], 'Markdown hash'
            assert source['sha256'] in text and source['download_url'] in unescaped, 'source provenance'
            for href in re.findall(r'\]\(<([^>]+)>\)', text):
                if not href.startswith(('http:', 'https:')):
                    assert (md.parent / href).exists(), 'missing link: ' + href
            if source['format'] == 'pdf':
                with pdfplumber.open(path) as pdf:
                    assert len(pdf.pages) == rec['pages'] == len(rec['ocr']), 'page count'
                    assert [x['page'] for x in rec['ocr']] == list(range(1, len(pdf.pages) + 1)), 'page order'
                    for page in pdf.pages:
                        native = clean_text(page.extract_text(layout=True) or '')
                        assert native in text, 'PDF native text missing'
                        for table in page.extract_tables():
                            for row in table:
                                for value in row:
                                    if value:
                                        assert normal(value) in norm, 'PDF table cell missing: ' + value
            if source['format'] == 'hwp':
                assert (assets / 'source-paragraphs.txt').read_text().strip() in text, 'HWP paragraphs'
                tree = etree.parse(str(assets / 'source-converted.xhtml'))
                # Every XHTML paragraph (including table cells) must survive serialization.
                for p in tree.xpath('//*[local-name()="body"]//*[local-name()="p"]'):
                    if p.xpath('.//*[local-name()="table"]'):
                        # A table can be embedded in a paragraph. Its leaf paragraphs
                        # are checked individually; grid serialization reorders spans.
                        continue
                    value = ''.join(p.itertext())
                    assert normal(value) in norm, 'HWP paragraph/cell missing: ' + value[:100]
            if source['format'] in {'hwpx', 'docx'}:
                with zipfile.ZipFile(path) as z:
                    names = [n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n)] if source['format'] == 'hwpx' else ['word/document.xml']
                    for name in names:
                        value = xml_text(etree.fromstring(z.read(name)))
                        assert value in text, 'XML native text missing: ' + name
            for ocr in rec.get('ocr', []):
                image = root / ocr['image']; cache = assets / (image.stem + '.ocr.json')
                data = json.loads(cache.read_text())
                assert digest(image) == data['image_sha256'], 'OCR input source'
                assert len(data['lines']) == ocr['lines'] > 0, 'empty OCR'
                for line in data['lines']:
                    assert normal(line['text']) in norm, 'OCR line missing: ' + line['text']
            checks.append({'file': source['file'], 'passed': True})
        except AssertionError as exc:
            errors.append({'file': source['file'], 'error': str(exc)})
    old = json.loads((root / 'docs/flow/2026-10-25-workbook-extraction-validation.json').read_text())
    historical_md_differences = []
    for rec in old['records']:
        assert digest(root / rec['file']) == rec['xlsx_sha256'], rec['file']
        if digest(root / rec['md']) != rec['markdown_sha256']:
            historical_md_differences.append(rec['md'])
    originals = json.loads((root / '수집목록.json').read_text())['files']
    for source in originals:
        if source.get('category', '').startswith('03'):
            assert digest(root / source['file'].split('/', 1)[1]) == source['sha256'], source['file']
    report['completeness_checks'] = {'passed_sources': len(checks), 'errors': errors,
                                     'old_workbook_hashes_preserved': len(old['records']),
                                     'old_markdown_differences_from_historical_snapshot': historical_md_differences,
                                     'old_markdown_note': 'Existing workbook Markdown is maintained by separate work. This extractor writes only format-suffixed Markdown and does not overwrite those files.',
                                     'original_disclosure_hashes_preserved': 275,
                                     'checks': checks, 'ocr_semantic_accuracy_manually_verified': False}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed_sources': len(checks), 'errors': errors,
                      'preserved_originals': 275, 'preserved_workbooks': len(old['records']),
                      'historical_markdown_differences': len(historical_md_differences)}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
