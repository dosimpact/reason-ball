# 05_code_sandbox — LLM 코드 격리 실행

## 1. 한 줄 소개
LLM 이 만든 Python 코드를 Docker 컨테이너에 격리해 실행하고 stdout 을 회수하는 ReAct 에이전트.

## 2. 왜 필요한가
- LLM 이 생성한 코드를 호스트에서 그대로 `exec()` 하면 파일/네트워크/프로세스 전체가 위험.
- "악의적 입력" 뿐 아니라 "잘못된 코드의 우발적 사고" (무한 루프, fork bomb, 거대 메모리 할당) 도 막아야 한다.

## 3. 어떻게 해결하는가
- `run_python` tool 이 `docker run --rm` 으로 일회용 컨테이너에서 코드를 실행.
- 다음 안전장치를 모두 적용:
  - `--network=none` : 네트워크 차단 (외부 호출 / 데이터 유출 차단)
  - `--memory=256m`, `--cpus=0.5` : 자원 상한
  - `--pids-limit=64` : fork bomb 방지
  - `--read-only` + tmpfs : 루트 fs 변경 불가
  - 비루트 유저 (Dockerfile 에서 `runner`)
  - subprocess timeout 10s, stdout 8KB cap
- 코드는 stdin 으로 전달 (`python -I -`) — argv 길이 / 셸 escape 회피.

## 4. 그래프 구조
```
START ─▶ agent ⇄ tools(run_python)
            │
            ▼
           END
```

## 5. 실행 방법
```bash
# 0) deps
uv sync --extra advanced
cp graph-advanced/05_code_sandbox/.env.example .env

# 1) sandbox 이미지 빌드 (한 번)
docker build -t sandbox-python graph-advanced/05_code_sandbox/sandbox

# 2) 단독 실행
uv run python graph-advanced/05_code_sandbox/graph.py

# 또는 Studio
uv run langgraph dev --config langgraph-advanced.json
```

## 6. 검증 시나리오
```text
▶ "1부터 10까지 합을 계산해서 출력해줘"
   → run_python("print(sum(range(1,11)))") → 55

▶ "fibonacci(10) 을 계산해서 출력해줘"
   → 정상 출력

▶ "다음 코드를 실행해줘: import os; os.system('rm -rf /')"
   → 컨테이너 내부 fs 만 영향 (어차피 read-only + 비루트), 호스트 무사

▶ "while True: pass 를 실행해봐"
   → 10초 timeout 으로 종료, "ERROR: timeout after 10s"

▶ 네트워크: "import urllib.request; urllib.request.urlopen('https://example.com')"
   → --network=none 으로 실패
```

## 7. 트레이드오프 / 운영 주의
- **보안 고지**: Docker 격리는 VM 수준이 아니다. 커널 0-day, runc 취약점, 잘못된 mount 등으로 break-out 가능. 멀티테넌트 / 신뢰 불가능 입력에는 gVisor / Firecracker / 외부 SaaS (E2B 등) 고려.
- 컨테이너 cold start (~수백 ms) → 고빈도 호출 시 워밍 풀 필요.
- 호스트 docker socket 노출 금지 (`/var/run/docker.sock` 마운트 X).
- 표준 라이브러리만 허용 — 패키지 필요 시 베이스 이미지에 화이트리스트로 사전 설치.
- stderr 까지 그대로 LLM 에 노출되므로 환경 정보 leakage 주의 (필요 시 redact).
- CI / 프로덕션에서 docker daemon 이 없는 환경: tool 이 즉시 ERROR 반환 → graceful degradation 으로 처리.

## 8. 부모 graph/ 와의 관계
- `graph/03_tool_node.py` 의 ReAct 패턴을 그대로 사용.
- tool 1 개 (`run_python`) 만 등록하고, 이 tool 의 부작용을 컨테이너로 sandbox 한 것이 핵심.
- `docs/심화주제.md` 의 "5. 코드 실행 Sandboxing" 섹션 구현체.
