import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@grafana/ui/package.json'));
const destination = new URL('../public/public/build/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(join(root, 'dist/public'), destination, { recursive: true });
// Grafana's Spinner requests spinner.svg, which is absent from the published bundle.
// Reuse its packaged rotating sync glyph for this asset name.
await cp(join(root, 'dist/public/img/icons/unicons/sync.svg'), new URL('img/icons/unicons/spinner.svg', destination));
// The time range picker also requests an absent left variant; mirror the packaged right glyph.
const right = await readFile(join(root, 'dist/public/img/icons/unicons/angle-double-right.svg'), 'utf8');
await writeFile(new URL('img/icons/unicons/angle-double-left.svg', destination), right.replace('<path ', '<path transform="translate(24 0) scale(-1 1)" '));
console.log('Synced pinned Grafana public assets.');
