# Infra Graph RAG

> Summary: Local Docker-based infrastructure for Neo4j and a small observability stack with Loki, Promtail, and Grafana.

## Context

`1-infra-graph-rag` is an infrastructure-focused directory for running a local graph database environment with log collection and visualization. The setup is intended for quick startup on a developer machine and keeps persistent directories for Neo4j data, imports, plugins, and logs.

This note captures the current repository state as reusable team knowledge. It is not a feature-delivery document.

## Scope

- Neo4j database runtime
- Loki log storage
- Promtail log shipping from Docker container logs
- Grafana dashboard provisioning
- Local persistence directories used by Docker volumes

## Directory Snapshot

```text
1-infra-graph-rag/
├── README.md
├── docker-compose.yml
├── data/
├── import/
├── logs/
├── plugins/
└── monitoring/
    ├── grafana/
    │   ├── dashboards/
    │   └── provisioning/
    ├── loki/
    └── promtail/
```

## Key Points

- The stack is started with Docker Compose and runs four services: `neo4j`, `loki`, `promtail`, and `grafana`.
- Neo4j uses image `neo4j:5.26` and exposes HTTP on `7474` and Bolt on `7687` by default.
- The Neo4j container enables `apoc` and `apoc-extended` plugins and accepts the Neo4j license agreement.
- Persistent bind mounts are used for `data`, `logs`, `import`, and `plugins`.
- Loki receives logs from Promtail on `http://loki:3100/loki/api/v1/push`.
- Promtail reads Docker JSON log files from `/var/lib/docker/containers/*/*-json.log`.
- Grafana is preconfigured with a Loki datasource and a dashboard provider that loads dashboards from a mounted directory.
- A default dashboard filters logs with the Loki query `{job="containers"} |= "neo4j"`.

## Service Notes

### Neo4j

- Container name: `graph-rag-neo4j`
- Auth format: `${NEO4J_USER:-neo4j}/${NEO4J_PASSWORD:-test1234}`
- Healthcheck uses `cypher-shell` and runs `RETURN 1;`
- `NEO4J_dbms_security_procedures_unrestricted` is set to `apoc.*`

### Loki

- Container name: `graph-rag-loki`
- Image: `grafana/loki:2.9.8`
- Authentication is disabled in the current local config
- Storage uses local filesystem paths under `/tmp/loki`
- Schema uses `boltdb-shipper` with `schema: v11`

### Promtail

- Container name: `graph-rag-promtail`
- Image: `grafana/promtail:2.9.8`
- Reads Docker daemon logs through mounted Docker host paths
- Uses the `docker` pipeline stage to parse container log format

### Grafana

- Container name: `graph-rag-grafana`
- Image: `grafana/grafana:11.1.0`
- Default admin credentials come from environment variables with local defaults
- Loki datasource is provisioned as the default datasource with UID `loki`
- Dashboard provider loads dashboards into folder `Graph-RAG`

## Known Defaults

- Neo4j Browser: `http://localhost:7474`
- Neo4j Bolt: `localhost:7687`
- Grafana: `http://localhost:3000`
- Loki ready endpoint: `http://localhost:3100/ready`

## Operational Notes

- The stack is designed for local development rather than hardened production use.
- Default credentials are present in Compose fallbacks and should be overridden in `.env` for shared environments.
- Promtail depends on Docker host log paths, so this setup assumes a Docker host layout compatible with `/var/lib/docker/containers`.
- Loki storage is under `/tmp/loki` inside the container, so long-term retention behavior depends on container lifecycle unless persistent storage is added later.

## Observed Documentation Gap

- `README.md` currently refers to a different absolute path and project name (`4.graph-rag` under another workspace). That looks like copied setup text and should be aligned with the actual repository path `1-infra-graph-rag`.

## Terms

- Neo4j: Graph database used for node and relationship storage.
- APOC: Neo4j plugin set that adds utility procedures and functions.
- Loki: Log aggregation system optimized for label-based querying.
- Promtail: Agent that collects logs and pushes them to Loki.
- Grafana: Visualization and dashboard tool used here for log exploration.
- Bolt: Neo4j binary protocol used by drivers and CLI tools.

## Examples

- Start stack: `docker compose up -d`
- Check Neo4j logs: `docker compose logs --tail=100 neo4j`
- Check running services: `docker compose ps`
- Stop stack: `docker compose down`

## Source Files

- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/README.md`
- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/docker-compose.yml`
- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/monitoring/loki/loki-config.yaml`
- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/monitoring/promtail/promtail-config.yaml`
- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/monitoring/grafana/provisioning/datasources/loki.yaml`
- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/monitoring/grafana/provisioning/dashboards/dashboards.yaml`
- `/Users/dodo/workspace/projects/harness-engineering-3/1-infra-graph-rag/monitoring/grafana/dashboards/neo4j-logs-dashboard.json`

## Related Documents

- `/Users/dodo/workspace/projects/harness-engineering-3/docs/01-plan/glossary.md`
- `/Users/dodo/workspace/projects/harness-engineering-3/docs/01-plan/references/lexical-graph-structure.references.md`
