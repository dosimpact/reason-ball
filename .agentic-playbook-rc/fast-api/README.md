# FastAPI Developer Enablement Kit

FastAPI를 기초 수준에서 업무에 적용할 수 있도록 만든 문서와 예제 셋입니다.

## 구성

- [docs/playbook.md](docs/playbook.md): FastAPI 실무 적용 플레이북
- [examples/basic-service](examples/basic-service): REST API, async 처리, Prometheus metrics, Loki 로그, Docker 배포 예제

## 빠른 시작

```bash
cd examples/basic-service
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

확인:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/items
curl http://localhost:8000/metrics
```

Docker Compose로 앱, Prometheus, Loki, Grafana를 함께 실행:

```bash
cd examples/basic-service
docker compose up --build
```

접속:

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

Grafana 기본 계정은 `admin` / `admin`입니다.

