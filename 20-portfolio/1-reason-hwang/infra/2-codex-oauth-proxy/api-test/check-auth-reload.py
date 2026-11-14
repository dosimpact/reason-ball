import asyncio
import json
import tempfile
import time
from pathlib import Path
from unittest.mock import patch
from aiohttp.test_utils import TestServer
from core.proxy_server import create_app
from core.token_manager import TokenManager

async def main():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        auth = root / 'auth.json'
        auth.write_text('{}')
        (root / 'bruno.json').write_text(json.dumps({'version': '1', 'name': 'OAuth reload', 'type': 'collection'}))
        with patch('core.auth_store.AUTH_FILE', auth), patch('core.token_manager.AUTH_FILE', auth):
            server = TestServer(create_app(TokenManager()))
            await server.start_server()
            try:
                for expected in (False, True):
                    if expected:
                        temp = root / 'auth.tmp'
                        temp.write_text(json.dumps(dict(access_token='fixture', refresh_token='fixture-refresh', account_id='fixture', expires_at=time.time()+3600)))
                        temp.replace(auth)
                    (root / 'health.bru').write_text('''meta {
  name: OAuth reload
  type: http
  seq: 1
}
get {
  url: %s
  body: none
  auth: none
}
assert {
  res.status: eq 200
  res.body.token_valid: eq %s
}
tests {
  test("auth status reflects file", function () {
    expect(res.body.token_valid).to.equal(%s);
  });
}
''' % (server.make_url('/health'), str(expected).lower(), str(expected).lower()))
                    proc = await asyncio.create_subprocess_exec('bru', 'run', cwd=root, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
                    try:
                        output, _ = await asyncio.wait_for(proc.communicate(), 40)
                    finally:
                        if proc.returncode is None:
                            proc.kill()
                            await proc.wait()
                    print(output.decode())
                    if proc.returncode:
                        raise RuntimeError('Bruno failed')
            finally:
                await server.close()
            print('PASS: same HTTP server recovered after atomic auth replacement; server closed, fixtures removed on exit.')
asyncio.run(main())
