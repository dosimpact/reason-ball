import { copyFileSync, mkdirSync } from 'node:fs';
const target = new URL('../../3-langgraph-fast/src/domains/sec_chat/generated/', import.meta.url);
mkdirSync(target, { recursive: true });
copyFileSync(new URL('../src/features/sec-chat/generated/system-prompt.txt', import.meta.url), new URL('system-prompt.txt', target));
console.log('SEC UI catalog prompt synced to Python');
