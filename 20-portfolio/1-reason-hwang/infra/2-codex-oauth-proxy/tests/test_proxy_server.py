import unittest

from aiohttp.test_utils import TestClient, TestServer

from core.proxy_server import create_app


class FakeTokenManager:
    def __init__(self, token: str | None = "token") -> None:
        self.token = token

    async def get_token(self) -> str:
        if self.token is None:
            raise RuntimeError("missing token")
        return self.token

    async def get_account_id(self) -> str:
        return "account"


class ProxyServerTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.client = TestClient(TestServer(create_app(FakeTokenManager())))
        await self.client.start_server()

    async def asyncTearDown(self) -> None:
        await self.client.close()

    async def test_health_reports_token_status(self) -> None:
        response = await self.client.get("/health")

        self.assertEqual(response.status, 200)
        self.assertEqual(await response.json(), {"status": "ok", "token_valid": True})

    async def test_rejects_non_object_json(self) -> None:
        response = await self.client.post("/v1/responses", json=[])

        self.assertEqual(response.status, 400)
        body = await response.json()
        self.assertEqual(body["error"]["type"], "invalid_request_error")

    async def test_apps_keep_token_managers_isolated(self) -> None:
        invalid_client = TestClient(TestServer(create_app(FakeTokenManager(None))))
        await invalid_client.start_server()
        self.addAsyncCleanup(invalid_client.close)

        valid_response = await self.client.get("/health")
        invalid_response = await invalid_client.get("/health")

        self.assertTrue((await valid_response.json())["token_valid"])
        self.assertFalse((await invalid_response.json())["token_valid"])


if __name__ == "__main__":
    unittest.main()
