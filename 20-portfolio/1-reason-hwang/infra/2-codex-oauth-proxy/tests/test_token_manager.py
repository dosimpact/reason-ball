import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer

from core.proxy_server import create_app
from core.token_manager import ChatGPTAuthExpiredError, TokenManager


class TokenReloadTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / 'auth.json'
        for target in ('core.auth_store.AUTH_FILE', 'core.token_manager.AUTH_FILE'):
            patcher = patch(target, self.path)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.write_auth('old', expires_at=0)
        self.manager = TokenManager()
        self.manager.validate_or_fail()

    def write_auth(self, token, expires_at=None):
        data = dict(access_token=token, refresh_token='refresh-' + token,
                    account_id='account-' + token,
                    expires_at=expires_at if expires_at is not None else time.time() + 3600)
        replacement = self.path.with_suffix('.tmp')
        replacement.write_text(json.dumps(data))
        replacement.replace(self.path)

    async def test_atomic_relogin_replaces_expired_cached_token(self):
        self.write_auth('new')
        with patch.object(self.manager, '_refresh_token', new_callable=AsyncMock) as refresh:
            self.assertEqual(await self.manager.get_token(), 'new')
            self.assertEqual(await self.manager.get_account_id(), 'account-new')
            refresh.assert_not_awaited()

    async def test_invalid_file_does_not_use_old_credentials_and_recovers(self):
        self.path.write_text('{}')
        with self.assertRaises(ChatGPTAuthExpiredError):
            await self.manager.get_token()
        self.write_auth('recovered')
        self.assertEqual(await self.manager.get_token(), 'recovered')

    async def test_health_recovers_without_server_restart(self):
        client = TestClient(TestServer(create_app(self.manager)))
        await client.start_server()
        try:
            self.path.write_text('{}')
            response = await client.get('/health')
            self.assertFalse((await response.json())['token_valid'])
            self.write_auth('new')
            response = await client.get('/health')
            self.assertTrue((await response.json())['token_valid'])
        finally:
            await client.close()

    async def test_deleted_file_fails_closed(self):
        self.path.unlink()
        with self.assertRaises(ChatGPTAuthExpiredError):
            await self.manager.get_token()
