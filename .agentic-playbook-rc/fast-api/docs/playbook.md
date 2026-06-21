# FastAPI 실무 적용 플레이북

## 목적

이 문서는 FastAPI를 처음 업무에 적용하는 개발자가 공통 기준으로 REST API 서버를 만들고, 비동기 처리 모델을 이해하며, 기본 모니터링과 Docker 배포까지 구성할 수 있도록 돕는다.

범위:

- REST API 기본 정의
- FastAPI의 async 처리 방식
- Prometheus metrics 노출
- Loki로 수집 가능한 구조화 로그 출력
- Dockerfile 기반 배포

범위 밖:

- SQL, SQLAlchemy
- Redis
- Kafka
- 외부 인증/인가
- 복잡한 도메인 설계

## 권장 기본 스택

- Python 3.12+
- FastAPI
- Uvicorn
- Pydantic
- prometheus-client
- python-json-logger
- Docker
- Prometheus, Loki, Grafana

## 1. REST API 기본 정의

FastAPI의 API는 path operation function으로 정의한다.

```python
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

app = FastAPI()

class ItemCreate(BaseModel):
    name: str
    price: float

class Item(BaseModel):
    id: int
    name: str
    price: float

@app.get("/items", response_model=list[Item])
async def list_items():
    return []

@app.post("/items", response_model=Item, status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemCreate):
    return Item(id=1, **payload.model_dump())

@app.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: int):
    if item_id != 1:
        raise HTTPException(status_code=404, detail="item not found")
    return Item(id=1, name="sample", price=1000)
```

팀 표준:

- 요청 모델과 응답 모델을 분리한다.
- 응답에는 `response_model`을 명시한다.
- 생성 API는 `201 Created`를 사용한다.
- 실패는 `HTTPException`으로 명시한다.
- URL은 명사형 복수 리소스를 기본으로 한다. 예: `/items`, `/users`.

## 2. FastAPI 비동기 처리

FastAPI는 ASGI 기반 프레임워크이므로 Node.js처럼 하나의 프로세스 안에서 비동기 I/O를 처리할 수 있다. `async def` endpoint 안에서 `await` 가능한 I/O 작업을 만나면 이벤트 루프가 다른 요청을 처리할 수 있다.

중요한 기준:

- 네트워크 I/O, 파일 I/O, 외부 API 호출처럼 기다리는 시간이 긴 작업은 async 이점이 크다.
- CPU를 오래 쓰는 작업은 async만으로 해결되지 않는다.
- blocking 함수를 `async def` 안에서 그대로 호출하면 이벤트 루프가 막힌다.
- 동시 처리량은 코드, 작업 종류, worker 수, CPU, 네트워크, timeout, connection pool에 따라 달라지므로 “몇 개 요청”이라고 고정할 수 없다.

실무 판단:

```python
@app.get("/async-wait")
async def async_wait():
    await asyncio.sleep(1)
    return {"mode": "non-blocking"}
```

위 코드는 기다리는 동안 다른 요청을 처리할 수 있다.

```python
@app.get("/bad-blocking")
async def bad_blocking():
    time.sleep(1)
    return {"mode": "blocking"}
```

위 코드는 `async def`여도 이벤트 루프를 막는다.

운영 기준:

- I/O 중심 API는 `async def`를 기본으로 한다.
- blocking 라이브러리를 써야 하면 thread pool 실행 또는 동기 endpoint를 검토한다.
- CPU 중심 작업은 별도 worker, job queue, process pool을 검토한다.
- 운영 동시성은 부하 테스트로 측정한다.

예시 부하 테스트:

```bash
hey -z 30s -c 100 http://localhost:8000/async-wait
```

## 3. Prometheus Metrics

FastAPI 앱은 `/metrics` endpoint로 Prometheus scrape 대상이 될 수 있다. 이 키트는 `prometheus-client`의 ASGI app을 mount한다.

권장 metric:

- 요청 수: `http_requests_total`
- 요청 latency: `http_request_duration_seconds`
- endpoint, method, status_code label
- 서비스 정보: `service_info`

주의:

- 사용자 ID, 주문 ID 같은 고유값을 label에 넣지 않는다.
- label cardinality가 커지면 Prometheus 비용과 성능 문제가 생긴다.
- `/metrics`는 운영 환경에서 네트워크 접근 제어를 적용한다.

## 4. Loki 로그

애플리케이션은 stdout으로 JSON 로그를 남기고, Docker/Promtail/Alloy 같은 수집기가 Loki로 전달하는 구성을 기본으로 한다. 앱 코드가 Loki에 직접 push하는 방식보다 배포 환경과 분리하기 쉽다.

권장 로그 필드:

- `timestamp`
- `level`
- `logger`
- `message`
- `request_id`
- `method`
- `path`
- `status_code`
- `duration_ms`

로그 기준:

- 정상 요청은 `INFO`
- 클라이언트 오류는 `WARNING`
- 서버 오류와 예외는 `ERROR`
- 비밀번호, 토큰, 개인정보는 로그에 남기지 않는다.
- 모든 요청에 `X-Request-ID`를 붙이거나 생성한다.

## 5. Docker 배포

기본 Dockerfile 기준:

- slim Python image 사용
- dependency layer와 source layer 분리
- root가 아닌 사용자로 실행
- `PYTHONUNBUFFERED=1`
- container 내부 포트는 `8000`
- 실행 명령은 `uvicorn app.main:app --host 0.0.0.0 --port 8000`

빌드:

```bash
docker build -t fastapi-basic-service .
```

실행:

```bash
docker run --rm -p 8000:8000 fastapi-basic-service
```

## 6. 운영 체크리스트

개발 완료 전:

- `/health` endpoint가 있다.
- `/metrics` endpoint가 있다.
- OpenAPI 문서가 정상 생성된다.
- 요청/응답 모델이 명확하다.
- 에러 응답이 일관적이다.
- request id가 로그에 남는다.
- Docker image가 빌드된다.
- container로 실행했을 때 정상 응답한다.

배포 전:

- 환경 변수 기본값과 필수값이 정리되어 있다.
- 로그에 민감정보가 없다.
- Prometheus scrape 설정이 준비되어 있다.
- Loki 수집 경로가 준비되어 있다.
- worker 수와 timeout은 부하 테스트로 결정한다.

## 참고 문서

- FastAPI async 공식 문서: https://fastapi.tiangolo.com/async/
- FastAPI Docker 공식 문서: https://fastapi.tiangolo.com/deployment/docker/
- Prometheus client libraries: https://prometheus.io/docs/instrumenting/clientlibs/
- Grafana Loki log shipping: https://grafana.com/docs/loki/latest/send-data/

