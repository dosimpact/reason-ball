"""OpenAI SDK smoke test for the Claude Code proxy."""

from openai import OpenAI


client = OpenAI()

response = client.chat.completions.create(
    model="claude-code",
    messages=[
        {"role": "user", "content": "Say hello in one short sentence."},
    ],
)

print(response.choices[0].message.content)
