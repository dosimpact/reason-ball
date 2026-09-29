# Docker examples

These are independent local Compose projects. Start one n8n variant at a time because both use port 5678 and the same container names.

| Directory | Purpose | Version | Local URL |
| --- | --- | --- | --- |
| `container-n8nio/` | n8n with external PostgreSQL | 2.41.3 | `http://localhost:5678` |
| `container-n8nio-custom/` | n8n image with Chromium and nmap | 2.41.3 | `http://localhost:5678` |
| `container-ollama-open-webui/` | Open WebUI connecting to a host Ollama service | 0.11.4 | `http://localhost:8080` |
| `container-qdrant/` | Qdrant with API keys | 1.19.1 | `http://localhost:6333` |

From a project directory, check its configuration with `docker compose config --quiet`, start it with `docker compose up -d`, and stop it with `docker compose down`. The n8n and Qdrant examples require a local `.env`; copy `.env.example` and fill in its blank values first. Never commit `.env` or runtime data.

Existing Open WebUI and Qdrant data directories are retained in place. Compose ports bind to `127.0.0.1` for local access. To make one of these services available beyond the host, configure its port binding and transport security deliberately.

The examples do not share a Docker network. If an n8n workflow needs Qdrant or Ollama, configure a reachable address for that service; `localhost` inside a container refers to that container.
