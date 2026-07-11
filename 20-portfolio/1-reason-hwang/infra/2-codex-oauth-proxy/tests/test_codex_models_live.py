import json
import os
import unittest

import aiohttp

from core.api_translator import collect_sse_to_response
from core.constants import CHATGPT_RESPONSES_URL
from core.models import SUPPORTED_CODEX_MODELS, UNAVAILABLE_CODEX_MODELS
from core.token_manager import TokenManager


@unittest.skipUnless(
    os.getenv("RUN_CODEX_LIVE_TESTS") == "1",
    "Set RUN_CODEX_LIVE_TESTS=1 to call the live Codex endpoint.",
)
class CodexModelsLiveTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        token_manager = TokenManager()
        token_manager.validate_or_fail()
        token = await token_manager.get_token()
        account_id = await token_manager.get_account_id()

        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "responses=experimental",
            "Accept": "text/event-stream",
        }
        if account_id:
            self.headers["chatgpt-account-id"] = account_id

        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=300),
        )

    async def asyncTearDown(self) -> None:
        await self.session.close()

    async def _post_model(self, model: str) -> tuple[int, str]:
        payload = {
            "model": model,
            "instructions": "Reply briefly and exactly as requested.",
            "input": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "Reply with exactly: model test passed",
                        },
                    ],
                },
            ],
            "store": False,
            "stream": True,
        }

        async with self.session.post(
            CHATGPT_RESPONSES_URL,
            json=payload,
            headers=self.headers,
        ) as response:
            return response.status, await response.text()

    async def test_supported_models_return_completed_text(self) -> None:
        for model in SUPPORTED_CODEX_MODELS:
            with self.subTest(model=model):
                status, body = await self._post_model(model)

                print(f"\n[{model}] HTTP {status}")
                if status != 200:
                    print(body)
                self.assertEqual(
                    status,
                    200,
                    msg=f"{model} returned: {body}",
                )

                result = collect_sse_to_response(body)
                self.assertEqual(result.get("status"), "completed")
                returned_model = result.get("model", "")
                self.assertTrue(
                    returned_model == model or returned_model.startswith(f"{model}-"),
                    msg=f"{model} returned unexpected model ID: {returned_model}",
                )

                text = "".join(
                    content.get("text", "")
                    for item in result.get("output", [])
                    if item.get("type") == "message"
                    for content in item.get("content", [])
                    if content.get("type") == "output_text"
                )
                print(json.dumps({"model": model, "text": text}, ensure_ascii=False))
                self.assertTrue(text.strip(), msg=f"{model} returned no output text")

    async def test_unavailable_model_returns_not_found(self) -> None:
        for model in UNAVAILABLE_CODEX_MODELS:
            with self.subTest(model=model):
                status, body = await self._post_model(model)

                print(f"\n[{model}] HTTP {status}")
                print(body)
                self.assertEqual(status, 404)
                error = json.loads(body)["error"]
                self.assertEqual(error.get("param"), "model")
                self.assertIn("Model not found", error.get("message", ""))


if __name__ == "__main__":
    unittest.main()
