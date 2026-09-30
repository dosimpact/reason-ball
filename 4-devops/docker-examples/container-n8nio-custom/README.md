# n8n with Chromium and nmap

1. Copy `.env.example` to `.env`. Set the PostgreSQL host and password. Keep the existing encryption key if this instance already has encrypted credentials.
2. Run `docker compose config --quiet` to check the configuration.
3. Run `docker compose up -d --build n8n` and open `http://localhost:5678`.

This variant builds `n8n-chromium:local` from n8n `2.41.3` and Alpine `3.24.2`. Keep the base image and Alpine stage compatible when upgrading. `VOLUME_DIR_N8N` holds n8n state, import files, and shared data. PostgreSQL and its `n8n` database must already exist.

Import is optional. Place export files under `n8n/backup/credentials` and `n8n/backup/workflows`, then run `docker compose --profile import run --rm n8n-import`. The normal n8n startup does not run the import job.

## Legacy workflow sketch

The following example was carried over from the original notes and has not been validated against the current n8n version. Its `localhost:1337` address refers to the n8n container if used inside a workflow; use a reachable host or service address instead.

Ref : https://velog.io/@martin-han/n8n-ollama-chatGPT-%EC%82%AC%EC%9A%A9%ED%95%B4%EB%B3%B4%EA%B8%B0#docker-composeyml-%EC%88%98%EC%A0%95


워크플로우 등록
```
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "ask-llm",
        "responseMode": "onReceived",
        "responseData": "firstEntryJson"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [200, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:1337/v1",
        "method": "POST",
        "responseFormat": "json",
        "jsonParameters": true,
        "options": {},
        "bodyParametersJson": "={ \"prompt\": $json[\"question\"] }"
      },
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "position": [400, 300]
    },
    {
      "parameters": {
        "responseData": "={{ $json[\"response\"] }}",
        "responseCode": 200
      },
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [600, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```


```
http://localhost:5678/webhook-test/ask-llm

curl -X POST http://localhost:5678/webhook-test/ask-llm -H "Content-Type: application/json" -d '{"question": "What is AI?"}'

```


```
curl --location 'http://0.0.0.0:1337/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--data '{
    "messages": [
        {
            "content": "Hello, how are you?",
            "role": "user",
            "name": "JohnDoe"
        },
        {
            "content": "I'\''m good! How can I help?",
            "role": "assistant",
            "name": "AIHelper"
        }
    ],
    "model": "deepseek-r1-distill-qwen-1.5b",
    "stream": true
}'

---

curl --location 'http://host.docker.internal/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--data '{
    "messages": [
        {
            "content": "Hello, how are you?",
            "role": "user",
            "name": "JohnDoe"
        },
        {
            "content": "I'\''m good! How can I help?",
            "role": "assistant",
            "name": "AIHelper"
        }
    ],
    "model": "deepseek-r1-distill-qwen-1.5b",
    "stream": true
}'
```
