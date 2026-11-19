import { createServer } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { createParser } from '@openuidev/lang-core';
const spec = JSON.parse(readFileSync(new URL('../../src/shared/config/openui/system-prompt.spec.json', import.meta.url)));
const server = createServer(async (request, response) => {
  const chunks=[];
  for await (const chunk of request) chunks.push(chunk);
  try {
    const {program}=JSON.parse(Buffer.concat(chunks).toString());
    const parsed=createParser(spec.schema,spec.root).parse(program);
    const errors=[...parsed.meta.errors,...parsed.meta.unresolved].map(String);
    if(!parsed.root || parsed.meta.incomplete) errors.push('incomplete');
    response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify({valid:errors.length===0,errors}));
  } catch { response.statusCode=422;response.end(JSON.stringify({valid:false,errors:['invalid program']})); }
});
server.listen(Number(process.env.TALIB_VALIDATOR_PORT || 32985),'127.0.0.1');
