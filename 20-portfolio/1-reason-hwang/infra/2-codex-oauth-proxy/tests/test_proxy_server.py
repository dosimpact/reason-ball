import asyncio
from unittest.mock import patch
from aiohttp import web
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

    async def upstream(self, handler):
        app = web.Application()
        app.router.add_post("/responses", handler)
        server = TestServer(app)
        await server.start_server()
        self.addAsyncCleanup(server.close)
        mock = patch("core.proxy_server.CHATGPT_RESPONSES_URL", str(server.make_url("/responses")))
        mock.start()
        self.addCleanup(mock.stop)

    async def test_stream_is_incremental_and_preserves_event_bytes(self):
        release = asyncio.Event()
        first = b'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\n'
        last = b'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\n'

        async def handler(request):
            self.assertTrue((await request.json())["stream"])
            response = web.StreamResponse(headers={"Content-Type": "text/event-stream"})
            await response.prepare(request)
            await response.write(first)
            await release.wait()
            await response.write(last)
            await response.write_eof()
            return response

        await self.upstream(handler)
        response = await self.client.post("/v1/responses", json={"model": "gpt-5.6-terra", "input": "hi", "stream": True})
        self.assertEqual(response.content_type, "text/event-stream")
        try:
            self.assertEqual(await asyncio.wait_for(response.content.readexactly(len(first)), 2), first)
        finally:
            release.set()
        self.assertEqual(await response.read(), last)

    async def test_stream_without_content_type_is_validated_then_relayed(self):
        release = asyncio.Event()
        first = b'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"OK"}\n\n'
        async def handler(request):
            response = web.StreamResponse()
            await response.prepare(request)
            await response.write(first[:3])
            await asyncio.sleep(0.01)
            await response.write(first[3:])
            await release.wait()
            await response.write_eof()
            return response
        await self.upstream(handler)
        response = await self.client.post("/v1/responses", json={"stream": True})
        try:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.content_type, "text/event-stream")
            self.assertEqual(await asyncio.wait_for(response.content.readexactly(len(first)), 2), first)
        finally:
            release.set()
        await response.read()

    async def test_stream_disconnect_closes_idle_upstream(self):
        closed = asyncio.Event()
        transports = []

        async def handler(request):
            transports.append(request.transport)
            response = web.StreamResponse(headers={"Content-Type": "text/event-stream"})
            await response.prepare(request)
            await response.write(b": connected\n\n")
            for _ in range(100):
                if request.transport is None or request.transport.is_closing():
                    closed.set()
                    return response
                await asyncio.sleep(0.02)
            return response

        await self.upstream(handler)
        response = await self.client.post("/v1/responses", json={"input": "hi", "stream": True})
        await response.content.readexactly(len(b": connected\n\n"))
        response.close()
        async def wait_closed():
            while not transports[0].is_closing():
                await asyncio.sleep(0.02)
        await asyncio.wait_for(wait_closed(), 2)

    async def test_stream_auth_error_remains_json_before_headers(self):
        async def handler(request):
            return web.json_response({"error": {"message": "Expired token"}}, status=401)
        await self.upstream(handler)
        response = await self.client.post("/v1/responses", json={"stream": True})
        self.assertEqual(response.status, 401)
        self.assertEqual(response.content_type, "application/json")

    async def test_stream_rejects_non_stream_upstream_and_nonstream_still_works(self):
        payload = {"id": "response-1", "status": "completed", "output": []}
        async def handler(request):
            return web.json_response(payload)
        await self.upstream(handler)
        streamed = await self.client.post("/v1/responses", json={"stream": True})
        self.assertEqual(streamed.status, 502)
        ordinary = await self.client.post("/v1/responses", json={"stream": False})
        self.assertEqual(await ordinary.json(), payload)

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
