import os


class OpenAIProvider:
    def __init__(self, model: str | None = None) -> None:
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    async def complete(self, message: str) -> str:
        from openai import AsyncOpenAI

        client = AsyncOpenAI()
        response = await client.responses.create(
            model=self.model,
            input=message,
        )
        return response.output_text
