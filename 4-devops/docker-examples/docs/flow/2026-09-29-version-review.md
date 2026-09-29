# 2026-09-29 Version review

- **Context:** The imported examples used floating `latest`, `main`, and untagged images. The custom n8n image was pinned to `2.41.3` but its Alpine tool stage floated within `3.24`.
- **Change:** Pinned both n8n examples to `2.41.3`, Qdrant to `v1.19.1`, Open WebUI to `v0.11.4`, and the custom build's Alpine tool stage to `3.24.2`.
- **Reason:** These were the latest stable releases reported by their official release pages on 2026-09-29. Explicit versions make future updates reviewable.
- **Current documentation:** Synchronized the collection README and each example README with the Compose and Dockerfile versions.
- **Validation:** Confirmed each image tag exists in its registry. All four `docker compose config --quiet` checks passed, and the custom n8n image built successfully with the pinned Alpine stage. Runtime services and existing data were not started or migrated.
