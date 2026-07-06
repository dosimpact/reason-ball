# 1-infra-graph-rag

Neo4j와 관측 스택(Loki, Promtail, Grafana)을 로컬에서 실행하는 인프라 프로젝트입니다.

## 1. 실행 방법

1. 환경 파일 준비
```bash
cd 1-infra-graph-rag
cp .env.example .env
```

2. 서비스 기동
```bash
pnpm run infra:up
```

3. 상태 확인
```bash
pnpm run infra:ps
docker compose logs --tail=100 neo4j
```

4. 주요 접속 주소
- Neo4j Browser: `http://localhost:7474`
- Grafana: `http://localhost:3001`
- Loki Ready: `http://localhost:3100/ready`

5. 종료
```bash
pnpm run infra:down
```

## 2. 핵심 기능들

- Neo4j 그래프 데이터베이스를 로컬에서 즉시 실행할 수 있습니다.
- Loki + Promtail + Grafana로 로그 수집/조회 환경을 함께 제공합니다.
- Docker 볼륨 기반으로 재기동 시 데이터/로그를 유지합니다.

## 3. 운영 복구

프로젝트 전체 bring-up, 포트 계약, PostgreSQL/Neo4j 복구 절차는
[../docs/05-runbooks/operations.md](../docs/05-runbooks/operations.md)를
기준으로 확인합니다.
