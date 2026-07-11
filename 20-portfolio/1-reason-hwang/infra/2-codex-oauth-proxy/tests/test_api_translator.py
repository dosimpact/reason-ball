import unittest

from core.api_translator import (
    _translate_messages_to_input,
    collect_sse_to_response,
    prepare_responses_passthrough,
    translate_request,
    translate_response,
)


class TranslateMessagesToInputTest(unittest.TestCase):
    def test_translates_user_text_block(self) -> None:
        result = _translate_messages_to_input([
            {
                "role": "user",
                "content": [{"type": "text", "text": "hello"}],
            },
        ])

        self.assertEqual(
            result[0]["content"],
            [{"type": "input_text", "text": "hello"}],
        )

    def test_translates_assistant_text_block(self) -> None:
        result = _translate_messages_to_input([
            {
                "role": "assistant",
                "content": [{"type": "text", "text": "hello"}],
            },
        ])

        self.assertEqual(
            result[0]["content"],
            [{"type": "output_text", "text": "hello"}],
        )

    def test_translates_image_url_block(self) -> None:
        result = _translate_messages_to_input([
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "https://example.com/image.png",
                            "detail": "high",
                        },
                    },
                ],
            },
        ])

        self.assertEqual(
            result[0]["content"],
            [
                {
                    "type": "input_image",
                    "image_url": "https://example.com/image.png",
                    "detail": "high",
                },
            ],
        )

    def test_preserves_responses_content_block(self) -> None:
        content = [{"type": "input_text", "text": "hello"}]

        result = _translate_messages_to_input([
            {"role": "user", "content": content},
        ])

        self.assertEqual(result[0]["content"], content)


class PrepareResponsesPassthroughTest(unittest.TestCase):
    def test_normalizes_input_without_mutating_source(self) -> None:
        source = {
            "model": "gpt-4o",
            "input": "hello",
            "tools": [],
            "max_output_tokens": 100,
        }

        result = prepare_responses_passthrough(source)

        self.assertEqual(source["input"], "hello")
        self.assertEqual(result["input"], [{"role": "user", "content": "hello"}])
        self.assertNotIn("tools", result)
        self.assertNotIn("max_output_tokens", result)
        self.assertTrue(result["stream"])
        self.assertFalse(result["store"])


class RequestResponseTranslationTest(unittest.TestCase):
    def test_translates_system_tool_call_and_tool_result(self) -> None:
        result = translate_request({
            "model": "gpt-4o",
            "max_tokens": 100,
            "messages": [
                {"role": "system", "content": "Be concise."},
                {
                    "role": "assistant",
                    "tool_calls": [{
                        "id": "call-1",
                        "function": {"name": "lookup", "arguments": '{"id": 1}'},
                    }],
                },
                {"role": "tool", "tool_call_id": "call-1", "content": "found"},
            ],
        })

        self.assertEqual(result["instructions"], "Be concise.")
        self.assertNotIn("max_output_tokens", result)
        self.assertEqual(result["input"][0]["type"], "function_call")
        self.assertEqual(result["input"][1]["type"], "function_call_output")

    def test_translates_text_and_tool_calls_back_to_chat_completion(self) -> None:
        result = translate_response({
            "id": "resp-1",
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "Checking"}],
                },
                {
                    "type": "function_call",
                    "call_id": "call-1",
                    "name": "lookup",
                    "arguments": "{}",
                },
            ],
            "usage": {"input_tokens": 2, "output_tokens": 3, "total_tokens": 5},
        }, "requested-model")

        choice = result["choices"][0]
        self.assertEqual(choice["finish_reason"], "tool_calls")
        self.assertEqual(choice["message"]["content"], "Checking")
        self.assertEqual(choice["message"]["tool_calls"][0]["function"]["name"], "lookup")
        self.assertEqual(result["usage"]["total_tokens"], 5)


class SseCollectionTest(unittest.TestCase):
    def test_merges_output_items_into_completed_response(self) -> None:
        sse = "\n".join([
            "event: response.output_item.done",
            'data: {"item":{"type":"function_call","name":"lookup"}}',
            "",
            "event: response.completed",
            'data: {"response":{"id":"resp-1","status":"completed","output":[]}}',
            "",
        ])

        result = collect_sse_to_response(sse)

        self.assertEqual(result["id"], "resp-1")
        self.assertEqual(result["output"][0]["name"], "lookup")

    def test_reconstructs_message_from_text_deltas(self) -> None:
        sse = "\n".join([
            "event: response.output_text.delta",
            'data: {"delta":"hel"}',
            "",
            "event: response.output_text.delta",
            'data: {"delta":"lo"}',
            "",
        ])

        result = collect_sse_to_response(sse)

        self.assertEqual(result["output"][0]["content"][0]["text"], "hello")


if __name__ == "__main__":
    unittest.main()
