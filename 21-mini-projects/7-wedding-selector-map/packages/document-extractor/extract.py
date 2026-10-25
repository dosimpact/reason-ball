"""Extract the collected wedding disclosures without modifying their source bytes.

Requires pypdfium2, pdfplumber, Pillow, pyhwp and olefile. OCR uses macOS Vision.
"""
from __future__ import annotations

import argparse
from collections import Counter
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile
import zlib

import olefile
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageEnhance
from lxml import etree


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def localname(node):
    return etree.QName(node).localname if isinstance(node.tag, str) else ""


def clean_text(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text).strip()


def fence(text):
    delim = "`" * max(3, max((len(s) + 1 for s in re.findall(r"`+", text)), default=0))
    return f"{delim}text\n{clean_text(text)}\n{delim}"


def link(path, base):
    return "<" + os.path.relpath(path, base).replace(os.sep, "/") + ">"


def cell(value):
    return clean_text(value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("|", "&#124;").replace("\n", "<br>")


def table_md(rows):
    width = max((len(r) for r in rows), default=0)
    if not width:
        return ""
    # Use source coordinates, rather than treating a possibly merged title as a header.
    out = ["| 원본 행 | " + " | ".join(f"열 {i + 1}" for i in range(width)) + " |",
           "| --- | " + " | ".join("---" for _ in range(width)) + " |"]
    for i, row in enumerate(rows):
        out.append("| " + str(i + 1) + " | " + " | ".join(cell(v) for v in row + [""] * (width - len(row))) + " |")
    return "\n".join(out)


def visible_html_text(node):
    parts = []
    for elem in node.iter():
        if elem.text and localname(elem) not in {"style", "script"}:
            parts.append(elem.text)
        if localname(elem) in {"p", "br"}:
            parts.append("\n")
        if elem.tail:
            parts.append(elem.tail)
    return clean_text("".join(parts))


def html_table(table):
    grid = {}; merges = []; maxrow = 0; maxcol = 0
    rows = [x for x in table if localname(x) == "tr"]
    if not rows:
        rows = table.xpath('./*[local-name()="tbody"]/*[local-name()="tr"]')
    for ri, row in enumerate(rows):
        ci = 0
        for td in row:
            if localname(td) not in {"td", "th"}:
                continue
            while (ri, ci) in grid:
                ci += 1
            rs = int(td.get("rowspan", "1")); cs = int(td.get("colspan", "1"))
            grid[ri, ci] = visible_html_text(td)
            for r in range(ri, ri + rs):
                for c in range(ci, ci + cs):
                    grid.setdefault((r, c), "")
            if rs > 1 or cs > 1:
                merges.append({"row": ri + 1, "column": ci + 1, "rowspan": rs, "colspan": cs})
            maxrow = max(maxrow, ri + rs); maxcol = max(maxcol, ci + cs); ci += cs
    return [[grid.get((r, c), "") for c in range(maxcol)] for r in range(maxrow)], merges


def xml_text(root):
    out = []
    def visit(node):
        name = localname(node)
        if name == "t":
            out.append("".join(node.itertext()))
            return
        elif name in {"lineBreak", "br", "cr"}:
            out.append("\n")
        elif name == "tab":
            out.append("\t")
        for child in node:
            visit(child)
        if name == "p":
            out.append("\n")
    visit(root)
    return clean_text("".join(out))


def xml_tables(root, hwpx):
    tables = []
    for table in root.iter():
        if localname(table) != "tbl":
            continue
        grid = {}; merges = []; maxrow = 0; maxcol = 0
        rows = [x for x in table if localname(x) == "tr"]
        for ri, tr in enumerate(rows):
            ci = 0
            for tc in tr:
                if localname(tc) != "tc":
                    continue
                rs = cs = 1
                if hwpx:
                    addr = next((x for x in tc if localname(x) == "cellAddr"), None)
                    span = next((x for x in tc if localname(x) == "cellSpan"), None)
                    r = int(addr.get("rowAddr", ri)) if addr is not None else ri
                    c = int(addr.get("colAddr", ci)) if addr is not None else ci
                    if span is not None:
                        rs = int(span.get("rowSpan", "1")); cs = int(span.get("colSpan", "1"))
                else:
                    r = ri; c = ci
                    for prop in tc.iter():
                        if localname(prop) == "gridSpan":
                            cs = int(next(iter(prop.attrib.values())))
                grid[r, c] = xml_text(tc)
                if rs > 1 or cs > 1:
                    merges.append({"row": r + 1, "column": c + 1, "rowspan": rs, "colspan": cs})
                maxrow = max(maxrow, r + rs); maxcol = max(maxcol, c + cs); ci = c + cs
        tables.append({"rows": [[grid.get((r, c), "") for c in range(maxcol)] for r in range(maxrow)], "merges": merges})
    return tables


class Extractor:
    def __init__(self, root, vision, temp):
        self.root = root; self.vision = vision; self.temp = temp
        self.temp.mkdir(parents=True, exist_ok=True)

    def ocr(self, image, assets):
        cached = image.with_name(image.stem + ".ocr.json") if image.parent == assets else assets / (image.stem + ".ocr.json")
        digest = sha(image.read_bytes())
        preprocessing = 'grayscale-autocontrast-0.5pct-contrast-1.5-upscale-2x' if not image.name.startswith('page-') else 'none'
        if cached.exists():
            result = json.loads(cached.read_text())
            if result.get("image_sha256") == digest and result.get('preprocessing') == preprocessing:
                return result
        ocr_input = image
        if preprocessing != 'none':
            im = Image.open(image).convert('L')
            im = ImageEnhance.Contrast(ImageOps.autocontrast(im, cutoff=.5)).enhance(1.5)
            scale = min(2, 4000 / max(im.size))
            if scale > 1:
                im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
            ocr_input = assets / (image.stem + '.ocr-input.png'); im.save(ocr_input)
        proc = subprocess.run([str(self.vision), str(ocr_input)], capture_output=True, text=True, timeout=180, check=True)
        result = json.loads(proc.stdout.strip())
        if result.get("error"):
            raise RuntimeError(result["error"])
        result.pop("path", None)
        result.update(engine="Apple Vision accurate ko-KR/en-US", image_sha256=digest,
                      coordinate_origin="bottom_left", manually_verified=False,
                      preprocessing=preprocessing, ocr_input_sha256=sha(ocr_input.read_bytes()))
        write_json(cached, result)
        return result

    def ocr_layout(self, result):
        rows = []
        for line in sorted(result["lines"], key=lambda x: -(x["y"] + x["height"] / 2)):
            cy = line["y"] + line["height"] / 2
            target = next((r for r in rows if abs(r["y"] - cy) < min(r["height"], line["height"]) * .45), None)
            if target is None:
                target = {"y": cy, "height": line["height"], "items": []}; rows.append(target)
            target["items"].append(line)
        out = []
        for row in rows:
            text = ""; end = 0
            for line in sorted(row["items"], key=lambda x: x["x"]):
                gap = max(1, round((line["x"] - end) * 150)) if text else round(line["x"] * 150)
                text += " " * min(gap, 80) + line["text"]
                end = line["x"] + line["width"]
            out.append(text.rstrip())
        return "\n".join(out)

    def add_ocr(self, image, assets, title):
        result = self.ocr(image, assets)
        low = [l for l in result["lines"] if l["confidence"] < .6]
        text = self.ocr_layout(result)
        block = [f"### {title}", "", "자동 OCR 결과입니다. 숫자·띄어쓰기·열 연결에 오인식이 있을 수 있으며 원본 대조가 필요합니다.", "", fence(text)]
        return "\n".join(block), {"image": str(image.relative_to(self.root)), "lines": len(result["lines"]),
                                  "low_confidence_lines": len(low), "text_characters": len(text)}

    def pdf(self, path, assets):
        sections = []; checks = []; tables_count = 0; native_chars = 0
        # PDFium renders independently from pdfminer/pdfplumber text extraction.
        doc = pdfium.PdfDocument(str(path))
        with pdfplumber.open(path) as pdf:
            assert len(doc) == len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                png = assets / f"page-{i+1:03}.png"
                if not png.exists():
                    bitmap = doc[i].render(scale=2.5)
                    bitmap.to_pil().save(png)
                text = clean_text(page.extract_text(layout=True) or "")
                native_chars += len(text)
                tables = page.extract_tables()
                tables = [t for t in tables if any(any(v for v in row) for row in t)]
                sections += [f"## 페이지 {i+1}", "", f"![원본 페이지 {i+1}]({link(png, path.parent)})", ""]
                if text:
                    sections += ["### PDF 텍스트 레이어", "", fence(text), ""]
                for n, rows in enumerate(tables, 1):
                    tables_count += 1
                    sections += [f"### 추출 표 {n}", "", "병합 셀의 빈칸은 임의로 채우지 않았습니다. 원본 페이지와 함께 확인합니다.", "", table_md(rows), ""]
                ocr, check = self.add_ocr(png, assets, "페이지 OCR " + ("보조 추출" if text else "본문 추출"))
                sections += [ocr, ""]
                check.update(page=i+1, native_characters=len(text), tables=len(tables)); checks.append(check)
        doc.close()
        return sections, {"method": "pdfplumber text/tables + PDFium render + Vision OCR", "pages": len(checks),
                          "tables": tables_count, "native_characters": native_chars, "ocr": checks}

    def hwp(self, path, assets):
        html_path = assets / "source-converted.xhtml"
        txt_path = assets / "source-paragraphs.txt"
        import hwp5.hwp5html as hwphtml
        bin_dir = Path(hwphtml.__file__).parent.parent / "bin"
        proc = subprocess.run([sys.executable, str(bin_dir / "hwp5html"), "--html", "--output", str(html_path), str(path)],
                              capture_output=True, text=True, timeout=180)
        if proc.returncode:
            raise RuntimeError("HWP HTML conversion: " + proc.stderr[-3000:])
        txt = subprocess.run([sys.executable, str(bin_dir / "hwp5txt"), str(path)], capture_output=True, timeout=180, check=True)
        text = clean_text(txt.stdout.decode("utf-8")); txt_path.write_text(text + "\n")
        root = etree.parse(str(html_path)).getroot()
        tables = [html_table(t) for t in root.iter() if localname(t) == "table"]
        sections = ["## 일반 본문 (문단 순서)", "", "일반 본문은 문단 순서로 보존합니다. `<표>` 위치의 실제 셀 내용과 행·열 관계는 아래 추출 표에서 확인합니다.", "", fence(text), ""]
        for i, (rows, merges) in enumerate(tables, 1):
            sections += [f"## 추출 표 {i}", "", table_md(rows), ""]
            if merges:
                sections += ["병합 범위: " + "; ".join(f"행 {m['row']} 열 {m['column']} ({m['rowspan']}행 × {m['colspan']}열)" for m in merges), ""]
        images = []
        with olefile.OleFileIO(path) as ole:
            for name in ole.listdir():
                if name[0] != "BinData":
                    continue
                data = ole.openstream(name).read()
                try:
                    decoded = zlib.decompress(data, -15)
                except zlib.error:
                    decoded = data
                try:
                    image = Image.open(io.BytesIO(decoded)); ext = "." + (image.format or "bin").lower()
                except Exception:
                    ext = Path(name[-1]).suffix or ".bin"
                dest = assets / (Path(name[-1]).stem + ext); dest.write_bytes(decoded)
                images.append(dest)
        ocrchecks = []
        for image in images:
            sections += ["## 원본 내장 이미지", "", f"![{image.name}]({link(image, path.parent)})", ""]
            try:
                Image.open(image)
            except Exception:
                sections += ["자동 OCR 미지원 형식입니다. 원본 자산으로 보존했습니다.", ""]; continue
            ocr, check = self.add_ocr(image, assets, "내장 이미지 OCR"); sections += [ocr, ""]; ocrchecks.append(check)
        return sections, {"method": "pyhwp HTML tables + independent paragraph text + embedded-image Vision OCR",
                          "native_characters": len(text), "tables": len(tables), "embedded_images": len(images),
                          "ocr": ocrchecks, "converter_stderr": proc.stderr.strip()[-3000:]}

    def zipped_document(self, path, assets, hwpx):
        sections = []; tables_count = 0; chars = 0; images = []; ocrchecks = []
        with zipfile.ZipFile(path) as z:
            names = sorted((n for n in z.namelist() if re.match(r"Contents/section\d+\.xml$", n)),
                           key=lambda n: int(re.search(r"section(\d+)", n)[1])) if hwpx else ["word/document.xml"]
            if not hwpx:
                names += [n for n in z.namelist() if re.match(r"word/(header|footer|footnotes|endnotes|comments)\d*\.xml$", n)]
            for name in names:
                root = etree.fromstring(z.read(name)); text = xml_text(root); chars += len(text)
                sections += [f"## 본문: {name}", "", fence(text), ""]
                for t in xml_tables(root, hwpx):
                    tables_count += 1; sections += [f"### 추출 표 {tables_count}", "", table_md(t['rows']), ""]
                    if t['merges']:
                        sections += ["병합 범위: " + json.dumps(t['merges'], ensure_ascii=False), ""]
            for name in z.namelist():
                if name.startswith(("BinData/", "word/media/")) and not name.endswith("/"):
                    dest = assets / Path(name).name; dest.write_bytes(z.read(name)); images.append(dest)
        for image in images:
            sections += ["## 원본 내장 이미지", "", f"![{image.name}]({link(image, path.parent)})", ""]
            try:
                Image.open(image)
            except Exception:
                sections += ["자동 OCR 미지원 형식입니다. 원본 자산으로 보존했습니다.", ""]; continue
            ocr, check = self.add_ocr(image, assets, "내장 이미지 OCR"); sections += [ocr, ""]; ocrchecks.append(check)
        return sections, {"method": "HWPX XML" if hwpx else "DOCX XML", "native_characters": chars,
                          "tables": tables_count, "embedded_images": len(images), "ocr": ocrchecks}

    def one(self, record):
        path = self.root / record["file"]; fmt = record["format"]
        assert sha(path.read_bytes()) == record["sha256"], "Source changed: " + str(path)
        md = path.with_name(path.name + ".md"); assets = path.with_name(path.name + ".assets")
        assets.mkdir(exist_ok=True)
        head = ["# " + record["company"], "", f"[원본 {fmt.upper()}]({link(path, path.parent)})", "",
                "## 기본정보", "", "| 항목 | 내용 |", "| --- | --- |"]
        fields = {"지역": record['region'], "첨부 ID": record['attachment_id'], "게시글 번호": record['post_id'],
                  **record.get('post_metadata', {}), "게시물 URL": record['source_url'], "다운로드 URL": record['download_url'],
                  "원본 SHA-256": record['sha256'], "추출일": dt.date.today().isoformat()}
        head.extend(f"| {cell(k)} | {cell(v)} |" for k, v in fields.items())
        head += ["", "가격·인원·적용 조건은 원문 그대로 보존합니다. 빈칸과 `-`를 0원으로 해석하지 않습니다. "
                 "자동 추출본이며 모든 금액에 대한 수동 검수를 완료했다는 의미는 아닙니다.", ""]
        if fmt == 'pdf':
            sections, info = self.pdf(path, assets)
        elif fmt == 'hwp':
            sections, info = self.hwp(path, assets)
        elif fmt in {'hwpx', 'docx'}:
            sections, info = self.zipped_document(path, assets, fmt == 'hwpx')
        elif fmt in {'png', 'jpeg'}:
            text, check = self.add_ocr(path, assets, '이미지 본문 OCR')
            sections = ["## 원본 이미지", "", f"![원본]({link(path, path.parent)})", "", text, ""]
            info = {'method': 'Vision image OCR', 'ocr': [check]}
        elif fmt == 'zip':
            sections = ['## ZIP 내부 파일', '', '| 내부 경로 | 크기(bytes) | SHA-256 | 로컬 추출본 |', '| --- | ---: | --- | --- |']
            with zipfile.ZipFile(path) as z:
                for name in z.namelist():
                    if name.endswith('/'):
                        continue
                    data = z.read(name); ext = Path(name).suffix
                    local = path.with_suffix(ext)
                    target = local.with_name(local.name + '.md') if ext == '.pdf' else local.with_suffix('.md')
                    assert local.exists() and sha(local.read_bytes()) == sha(data)
                    sections.append(f"| {cell(name)} | {len(data)} | {sha(data)} | [Markdown]({link(target, path.parent)}) |")
            info = {'method': 'ZIP member manifest; content linked to PDF/XLSX Markdown', 'ocr': []}
        else:
            raise ValueError(fmt)
        reviewed = assets / 'reviewed-notes.json'
        if reviewed.exists():
            notes = json.loads(reviewed.read_text())
            sections += ['## 원본 대조 확인 사항', '', notes['scope'], '',
                         '| 원본 위치 | 항목 | 원본 대조값 | 확인 사항 |', '| --- | --- | --- | --- |']
            for note in notes['notes']:
                sections.append('| ' + ' | '.join(cell(note[k]) for k in ['image', 'item', 'value', 'note']) + ' |')
            sections += ['']
            info['reviewed_notes'] = str(reviewed.relative_to(self.root))
        md.write_text('\n'.join(head + sections).rstrip() + '\n')
        info.update(file=record['file'], markdown=str(md.relative_to(self.root)), format=fmt, source_sha256=record['sha256'],
                    markdown_sha256=sha(md.read_bytes()), markdown_bytes=md.stat().st_size, manual_review='not_exhaustive',
                    status='extracted_with_ocr_review_required' if info.get('ocr') else 'extracted')
        write_json(assets / 'extraction.json', info)
        print('EXTRACTED', record['file'], 'tables', info.get('tables', 0), 'ocr', len(info.get('ocr', [])), flush=True)
        return info


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--vision', type=Path, required=True)
    parser.add_argument('--only', help='Attachment ID for a targeted retry')
    args = parser.parse_args(); root = args.root.resolve()
    manifest = json.loads((root / '추가원본_수집목록.json').read_text())
    extractor = Extractor(root, args.vision.resolve(), Path('/tmp/wedding-document-extraction'))
    records = [r for r in manifest['files'] if not args.only or r['attachment_id'] == args.only]
    results = []; errors = []
    # PDFium is not thread safe: each source document is handled sequentially.
    for rec in records:
        try:
            results.append(extractor.one(rec))
        except Exception as exc:
            errors.append({'file': rec['file'], 'error': str(exc)})
            print('ERROR', rec['file'], repr(exc), flush=True)
    output = {'checked_at': dt.datetime.now().astimezone().isoformat(), 'records': results, 'errors': errors,
              'summary': {'sources': len(records), 'extracted': len(results), 'errors': len(errors),
                          'formats': dict(Counter(r['format'] for r in results)),
                          'pdf_pages': sum(r.get('pages', 0) for r in results),
                          'tables': sum(r.get('tables', 0) for r in results),
                          'ocr_images': sum(len(r.get('ocr', [])) for r in results)}}
    out = root / 'docs/flow/2026-10-25-nonexcel-extraction-validation.json'
    if args.only:
        out = extractor.temp / ('retry-' + args.only + '.json')
    write_json(out, output)
    print(json.dumps(output['summary'], ensure_ascii=False), flush=True)
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
