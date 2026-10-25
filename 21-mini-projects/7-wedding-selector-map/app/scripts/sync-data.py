"""Explicitly import only app-referenced source files; normal builds never run this."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

APP = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    args = parser.parse_args()
    source = args.source_root.resolve()
    if source == APP:
        parser.error('Source root must differ from the app')
    paths = set()
    def add(relative):
        path = (source / relative).resolve()
        if not path.is_relative_to(source / 'database'):
            raise ValueError(f'Outside source database: {relative}')
        if not path.is_file():
            raise FileNotFoundError(path)
        paths.add(path.relative_to(source).as_posix())
    vendors = json.loads((APP / 'src/entities/vendor/data/vendors.json').read_text())
    for vendor in vendors:
        for item in vendor['sources']:
            if item['path'].startswith('database/'):
                add(item['path'])
    metadata = json.loads((APP / 'src/entities/vendor/data/metadata.json').read_text())
    for item in metadata['inputs']:
        if item['path'].startswith('database/'):
            add(item['path'])
    venue = 'database/참가격_웨딩홀_업체별_공시원본/'
    catalog = json.loads((source / venue / 'catalog.json').read_text())
    for record in catalog['venues']:
        for value in record['files'].values():
            if (source / value).is_file():
                add(value)
    covered_posts = {record['sourceUrl'].split('boardSeq=')[-1].split('&')[0] for record in catalog['venues']}
    additions = json.loads((source / venue / '추가원본_수집목록.json').read_text())
    for attachment in additions.get('current_attachment_mapping', []):
        relative = venue + attachment['local_file']
        if attachment['post_id'] not in covered_posts and (source / relative).is_file():
            add(relative)
    planning = 'database/참가격_결혼준비대행_자료/'
    manifest = json.loads((source / planning / '수집목록.json').read_text())
    posts = json.loads((source / planning / '게시글_기본정보.json').read_text())['posts']
    post_ids = {post['post_id'] for post in posts}
    for item in [*manifest['files'], *manifest.get('external_files', [])]:
        if item.get('post_metadata', {}).get('post_id') not in post_ids:
            continue
        for attachment in [item, *item.get('extracted_spreadsheets', [])]:
            relative = planning + attachment['file']
            if (source / relative).is_file():
                add(relative)
    entries = []
    for relative in sorted(paths):
        original = source / relative
        destination = APP / relative
        digest = hashlib.sha256(original.read_bytes()).hexdigest()
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
            shutil.copy2(original, destination)
        assert hashlib.sha256(destination.read_bytes()).hexdigest() == digest
        entries.append({'path': relative, 'sha256': digest, 'bytes': destination.stat().st_size})
    output = {'version': 1, 'selection': 'vendor sources, build inputs, catalogue files and current planning attachments', 'files': entries}
    (APP / 'database/manifest.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'files': len(entries), 'bytes': sum(x['bytes'] for x in entries)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
