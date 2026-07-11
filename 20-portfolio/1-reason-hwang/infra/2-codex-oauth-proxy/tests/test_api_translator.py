import unittest

from core.api_translator import _translate_messages_to_input


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


if __name__ == "__main__":
    unittest.main()
