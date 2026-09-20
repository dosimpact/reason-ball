# BFF package guidance

Read the workspace [document map](../docs/INDEX.md) and [directory policy](../docs/stock/tech-shared/2-bff-apps/directory-policy.md).

- One business module: `UsCorporateFilingsModule`, installed in `AppModule`.
- Shared configuration: `src/shared/config.service.ts`. External SEC client, external types and specification: `src/lib/sec/`.
- Domain `entity/` holds TypeORM entities and DTOs; `service/` holds company, filing query and backfill services.
- Backfill POST endpoints stream SSE; persist filing state, not execution jobs. Preserve historical migrations and existing content.
- Follow workspace API/Bruno and browser/MCP validation rules. Commands and evidence live in the linked policy and flow.
