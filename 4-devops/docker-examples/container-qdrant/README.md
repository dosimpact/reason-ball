# Local Qdrant

This example uses Qdrant `v1.19.1`.

Qdrant listens at `http://localhost:6333` and uses the existing `qdrant_storage/` directory for persistent data. The port is bound to the local host.

Copy `.env.example` to `.env` and set separate admin and read-only API keys. The local `.env` and storage directory are ignored by Git. Run `docker compose config --quiet`, then `docker compose up -d`.

Requests need an `api-key` header. Keep the service local unless you configure TLS for remote access. See the [Qdrant security guide](https://qdrant.tech/documentation/security/).
