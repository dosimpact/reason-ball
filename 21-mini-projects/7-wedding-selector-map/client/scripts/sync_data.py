"""Copy the catalogue and its reachable local documents into the client snapshot."""
import hashlib
import json
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit

CLIENT = Path(__file__).resolve().parents[1]
ROOT = CLIENT.parent
PREFIX = Path('database/참가격_웨딩홀_업체별_공시원본')


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def main():
    source = ROOT / PREFIX
    catalogue = json.loads((source / 'catalog.json').read_text())
    pending = {source / 'catalog.json', source / 'catalog.js', source / '엑셀_추출_목록.md'}
    pending.update(ROOT / value for value in strings(catalogue) if value.startswith(str(PREFIX) + '/'))
    selected = set()
    while pending:
        path = pending.pop().resolve()
        if path in selected:
            continue
        if not path.is_relative_to(source.resolve()) or not path.is_file():
            raise ValueError(f'Missing or out-of-scope dependency: {path}')
        selected.add(path)
        if path.suffix == '.md':
            for match in re.finditer(r'!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s]+))\)', path.read_text()):
                link = urlsplit(match.group(1) or match.group(2))
                if not link.scheme and not link.netloc and link.path:
                    pending.add(path.parent / unquote(link.path))
    records = []
    for path in sorted(selected):
        relative = path.relative_to(ROOT)
        target = CLIENT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        records.append({'path': str(relative), 'bytes': path.stat().st_size,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest = {'source': str(PREFIX), 'venues': len(catalogue['venues']), 'files': records}
    (CLIENT / 'database/snapshot-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Copied {len(records)} files / {sum(r["bytes"] for r in records):,} bytes / {manifest["venues"]} venues')


if __name__ == '__main__':
    main()
