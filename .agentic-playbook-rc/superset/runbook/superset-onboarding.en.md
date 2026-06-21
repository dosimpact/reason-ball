# Apache Superset Basic Onboarding

This runbook explains how to start Apache Superset locally with Docker Compose and what Superset can do at a high level.

## 1. What Superset is

Apache Superset is an open-source, web-based BI and data exploration platform. The official documentation positions it around chart creation, dashboards, SQL Lab, database connections, a semantic layer, security/RBAC, and API-driven extensibility.

Common use cases include:

- Connect to many SQL databases or data engines for exploration.
- Write and save SQL queries in SQL Lab.
- Define Datasets with standardized columns, calculated metrics, and virtual columns.
- Build visualizations with the no-code Chart Builder, including tables, time series, and geospatial charts.
- Create interactive dashboards with filters, cross-filters, drill-to-detail, and drill-by workflows.
- Use Redis cache and Celery workers to separate slow queries, cache warmup, and asynchronous jobs.
- Control database, dataset, and dashboard access with roles and permissions.
- Enable scheduled alerts/reports with extra SMTP or Slack configuration plus a headless browser.
- Integrate Superset into internal platforms through REST APIs and custom visualization plugins.

## 2. Local infrastructure

The repository `docker-compose.yml` defines a learning-oriented Superset stack.

- `superset-db`: PostgreSQL metadata database for Superset. This stores Superset configuration, not your source analytics data.
- `superset-cache`: Redis cache, Celery broker, and Celery result backend.
- `superset-init`: One-shot initialization for DB migrations, admin user creation, example data loading, and permission sync.
- `superset-app`: Superset web UI/API, published at `http://localhost:8088`.
- `superset-worker`: Celery worker for async SQL Lab tasks, cache jobs, and optional future alert/report jobs.
- `superset-worker-beat`: Single Celery beat scheduler for scheduled jobs.

This is not a production stack. The official docs recommend Docker Compose for local sandbox or development use. Production use should address custom hardened images, metadata DB backup, external secret management, and Kubernetes/Helm or another production-grade orchestration path.

## 3. Start Superset

If the Docker Compose CLI plugin is available, run:

```bash
docker compose up -d
```

If your environment has standalone Compose instead, run:

```bash
docker-compose up -d
```

The first boot can take a few minutes because images are downloaded and example data is loaded. Skip examples with:

```bash
SUPERSET_LOAD_EXAMPLES=no docker-compose up -d
```

## 4. Access and verify

Open `http://localhost:8088`.

Default login:

```text
username: admin
password: admin
```

Health and status checks:

```bash
docker-compose ps
curl -f http://localhost:8088/health
```

Log checks:

```bash
docker-compose logs -f superset-app
docker-compose logs -f superset-init
```

Stop the stack:

```bash
docker-compose down
```

Reset all metadata by removing named volumes:

```bash
docker-compose down -v
```

## 5. Operational notes

- Replace the local default `SUPERSET_SECRET_KEY` with an environment variable before sharing the stack beyond local development.
- The PostgreSQL volume contains Superset's important metadata. Back it up if dashboards and datasets must be preserved.
- `apache/superset:6.0.0-dev` is chosen for local onboarding convenience. For production, build a custom image with the exact database drivers you need.
- Alerts and reports are disabled by default. Enabling them requires SMTP or Slack settings, a headless browser, and the related feature flag.
- Run only one Celery beat per environment to avoid duplicate scheduled jobs.

## 6. References

- Apache Superset Quickstart: https://superset.apache.org/user-docs/quickstart/
- Docker Compose installation: https://superset.apache.org/admin-docs/installation/docker-compose/
- Installation Methods: https://superset.apache.org/admin-docs/installation/installation-methods/
- Superset intro and features: https://superset.apache.org/user-docs/intro/
- Async Queries via Celery: https://superset.apache.org/admin-docs/configuration/async-queries-celery/
- Alerts and Reports: https://superset.apache.org/admin-docs/configuration/alerts-reports/
