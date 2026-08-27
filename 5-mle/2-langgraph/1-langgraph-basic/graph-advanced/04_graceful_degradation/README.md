# 04_graceful_degradation — Tool 실패 5가지 전략

## 1. 한 줄 소개
외부 검색 tool 이 실패하는 5가지 시나리오에 대한 LangGraph 운영 패턴 모음 (4개의 작은 그래프 + 1개 prebuilt 패턴 설명).

## 2. 왜 필요한가
디폴트로 tool 예외가 발생하면 그래프 전체가 실패하고, 사용자에게는 "에러 났어요" 만 보입니다.
실서비스에서 외부 API 가 죽거나 일시적으로 흔들리는 일은 매일 발생합니다.

대표 실패 종류:
- 외부 API 타임아웃 / 5xx
- Rate limit (429)
- 인증 만료 (401)
- LLM 이 잘못된 인자 생성 (스키마 오류)
- tool 이 빈 결과 반환

> 핵심 원칙: **"에러 났어요"** 보다 **"이 부분은 못 했지만 이만큼은 했어요"** 가 항상 낫다.

## 3. 어떻게 해결하는가
한 파일 `graph.py` 안에 4개의 작은 그래프를 빌드합니다 (각 전략별).

| 전략 | 그래프 | 예시 tool | 설명 |
|------|--------|-----------|------|
| ① RetryPolicy | `graph_retry` | `flaky_search` | 일시 오류만 자동 재시도 (`TransientError`), 최대 4회 |
| ② Tool 안 try/except | `graph_try_except` | `always_failing_search` | 예외를 잡아 결과 문자열로 변환 → LLM 이 우회 |
| ③ Fallback 체인 | `graph_fallback` | primary→secondary→cached | 조건부 엣지로 단계별 fallback |
| ④ Partial Result | `graph_partial` | map-reduce 3 worker | 일부 worker 실패해도 부분 답변 |
| ⑤ LLM 재프롬프트 | (별도 그래프 X) | LangGraph prebuilt `ToolNode` | 잘못된 tool 인자를 ToolMessage 에 담아 재시도 — 부모 `graph-basic/15_react_tool_loop.py` 의 `ToolNode` 가 이미 처리 |

## 4. 그래프 구조

```
[graph_retry]
START ─▶ search (RetryPolicy: TransientError, max=4) ─▶ END

[graph_try_except]
START ─▶ search (try/except → 결과 문자열) ─▶ END

[graph_fallback]
START ─▶ primary ──ok──▶ END
            │ fail
            ▼
        secondary ──ok──▶ END
            │ fail
            ▼
          cached ─▶ END

[graph_partial]
START ─Send fanout─▶ worker(topic_a)
                  ─▶ worker(topic_b)   ─▶ reduce ─▶ END
                  ─▶ worker(topic_c)
```

## 5. 실행 방법

```bash
uv sync --extra advanced

uv run python graph-advanced/04_graceful_degradation/graph.py             # 4개 시나리오 차례 실행 (LLM 호출 없음, 순수 deterministic)
uv run langgraph dev --config langgraph-advanced.json               # Studio (graphs 4개 모두 등록됨)
```

LLM 호출이 없으므로 AWS 자격증명 없이도 동작합니다 (의존성으로만 들어가 있음).

## 6. 검증 시나리오

`python graph.py` 출력 예시:

```
[1] retry — flaky_search 처음 2회 실패 후 성공
  result: [flaky_search OK] 'langgraph' → result-after-3-tries
  history: ['flaky#1', 'flaky#2', 'flaky#3']      ← 3회 호출됨 (재시도 2회 포함)

[2] try_except — 영구 실패를 결과 문자열로
  result: (search unavailable: PermanentError: permanent failure for 'langgraph')

[3] fallback — primary 실패 → secondary 성공
  result: [secondary_search OK] 'langgraph'
  used_strategy: secondary
  history: ['always#1', 'secondary#1']

[4] partial — 3개 토픽 중 1개 실패해도 부분 응답
부분 응답: 2/3 성공.
- topic_a: [flaky_search OK] '...'         ← 첫 호출 성공 (counter 새로 리셋)
- topic_b: (failed: PermanentError)
- topic_c: [slow_search OK] '...'
실패한 토픽: ['topic_b']
```

> Studio 에서는 `main` (=fallback) 외 4개 그래프(retry/try_except/fallback/partial) 가 별도 항목으로 나타납니다.

## 7. 트레이드오프 / 운영 주의
- **Retry 는 idempotent 한 호출에만**. 결제/주문 같은 mutation 에 retry 걸면 중복 사이드이펙트 발생.
- **재시도 대상 예외 분류가 핵심**. 401(인증) 을 retry 하면 무의미한 부하만 발생. 영구/일시 구분 필수.
- **Backoff + Jitter** 미적용 시 thundering herd 위험. RetryPolicy 의 `backoff_factor` 활용.
- **Fallback 깊이가 너무 길면 latency 폭증**. cache 우선 전략 / 타임아웃 budget 설정 권장.
- **Partial Result 는 사용자에게 명확히 표시**. "일부 실패" 를 숨기면 데이터 신뢰도 문제.
- 실제 서비스에서는 circuit breaker (n분간 실패율 임계 초과 시 일시 차단) 도 추가 고려.

## 8. 부모 프로젝트와의 관계
- `graph/19_*` (RetryPolicy 패턴) 의 직접 응용.
- `graph-basic/30_map_reduce.py` 의 `Send` 패턴을 partial result 시나리오에 사용.
- `graph-basic/15_react_tool_loop.py` 의 prebuilt `ToolNode` 가 전략 ⑤ (LLM 재프롬프트) 를 무료로 제공함을 보임.
- `docs/심화주제.md` §4 직접 구현체.
