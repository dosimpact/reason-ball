import unittest
from unittest.mock import patch

from core import api_translator
from core import claude_runner


class ApiTranslatorTest(unittest.TestCase):
    def test_chat_request_to_prompt_formats_roles(self):
        prompt = api_translator.chat_request_to_prompt(
            {
                "messages": [
                    {"role": "system", "content": "Be concise."},
                    {"role": "user", "content": "Say hello."},
                ]
            }
        )

        self.assertEqual(prompt, "SYSTEM:\nBe concise.\n\nUSER:\nSay hello.")

    def test_chat_request_to_prompt_extracts_text_parts(self):
        prompt = api_translator.chat_request_to_prompt(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "First"},
                            {"type": "input_text", "text": "Second"},
                        ],
                    }
                ]
            }
        )

        self.assertEqual(prompt, "USER:\nFirst\nSecond")

    def test_responses_request_to_prompt_includes_instructions(self):
        prompt = api_translator.responses_request_to_prompt(
            {
                "instructions": "Answer as JSON.",
                "input": [{"role": "user", "content": "Ping"}],
            }
        )

        self.assertEqual(prompt, "SYSTEM:\nAnswer as JSON.\n\nUSER:\nPing")

    def test_make_chat_completion_is_openai_compatible_shape(self):
        response = api_translator.make_chat_completion("Hello.", "claude-code")

        self.assertEqual(response["object"], "chat.completion")
        self.assertEqual(response["model"], "claude-code")
        self.assertEqual(response["choices"][0]["message"]["role"], "assistant")
        self.assertEqual(response["choices"][0]["message"]["content"], "Hello.")

    def test_claude_code_model_uses_configured_default_model(self):
        with patch.object(claude_runner, "DEFAULT_CLAUDE_MODEL", "gemma4:e2b-mlx"):
            self.assertEqual(
                claude_runner.resolve_cli_model("claude-code"),
                "gemma4:e2b-mlx",
            )

    def test_specific_model_is_passed_through(self):
        self.assertEqual(
            claude_runner.resolve_cli_model("gemma4:e2b-mlx"),
            "gemma4:e2b-mlx",
        )


if __name__ == "__main__":
    unittest.main()
