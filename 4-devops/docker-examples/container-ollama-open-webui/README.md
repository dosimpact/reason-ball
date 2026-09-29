# Open WebUI with host Ollama

This example uses Open WebUI `v0.11.4`.

The UI runs at `http://localhost:8080` and connects to Ollama on the host at `http://host.docker.internal:11434`. Start Ollama on the host before using the model list.

The existing project directory is mounted at `/app/backend/data`, so `webui.db`, uploads, cache, and vector data remain where they are. These runtime paths are ignored by Git. Keep the generated `WEBUI_SECRET_KEY` in the local `.env`; replacing it can sign out existing sessions.

Run `docker compose config --quiet`, then `docker compose up -d`. For a fresh copy of this example, copy `.env.example` to `.env` and generate a persistent key with `openssl rand -hex 32`.
