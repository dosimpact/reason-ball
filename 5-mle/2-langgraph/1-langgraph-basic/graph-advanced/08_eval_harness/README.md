# 08_eval_harness — Golden Set + LLM-as-judge 평가

## 1. 한 줄 소개
ReAct 그래프 + golden dataset(JSON) + 3가지 평가지표(rule-based / tool-trace / LLM-as-judge) 로 구성된 최소 단위 평가 하네스.

## 2. 왜 필요한가
프롬프트/모델/tool 하나만 바꿔도 결과가 미묘하게 달라지는 LLM 시스템에서, **변경이 회귀를 일으켰는지 객관적으로 측정** 할 방법이 없으면 안전하게 배포할 수 없습니다.
"느낌상 잘 되는 것 같다" 는 운영 가능한 신호가 아닙니다.

## 3. 어떻게 해결하는가
- 작은 ReAct 그래프 (`graph.py`) — `get_current_time / calculate / lookup_info` 3개 tool
- `golden_dataset.json` — 10개 케이스. 각 케이스: `input` / `expected_keywords` / `expected_tool_calls`
- `run.py` — `graph.batch()` 로 일괄 실행 후 3가지 평가:
  1. **Rule-based**: 응답에 `expected_keywords` 가 모두 포함되는가
  2. **Tool trace**: 실제 호출된 tool 이름 set 이 `expected_tool_calls` 의 superset 인가
  3. **LLM-as-judge**: Haiku 로 1~5점 평가 (JSON 응답 강제)
- `pass = rule_based AND tool_trace AND judge_score >= 4`
- 결과를 `results.json` 으로 저장 + 콘솔 summary 출력

## 4. 그래프 구조

```
START ─▶ agent ⇄ tools ─▶ END
```

평가 흐름:
```
golden_dataset.json
       │
       ▼ batch
   graph (ReAct)
       │
       ▼
[answer + tool calls]
       │
       ├─▶ rule_based_check        (keyword in answer)
       ├─▶ tool_trace_check        (expected ⊆ actual)
       └─▶ llm_judge (Haiku, 1-5)
       │
       ▼
results.json + summary
```

## 5. 실행 방법

```bash
uv sync --extra advanced

# OPENAI_API_KEY 환경변수 사용
uv run python graph-advanced/08_eval_harness/run.py                       # 전체 평가
uv run python graph-advanced/08_eval_harness/run.py --limit 3             # 앞 3개만
uv run python graph-advanced/08_eval_harness/run.py --no-judge            # LLM-as-judge 생략
uv run python graph-advanced/08_eval_harness/graph.py                     # 그래프 단독 1회 실행
uv run langgraph dev --config langgraph-advanced.json                       # Studio
```

`--no-judge` 모드에서는 Sonnet 호출만 (10번), judge 모드는 Sonnet 10 + Haiku 10 = 20번 LLM 호출.

## 6. 검증 시나리오

`python run.py --limit 3` 출력 예시:

```
[eval] running graph.batch on 3 cases ...
============================================================
PASS  3/3    FAIL 0
  rule_based : 3/3
  tool_trace : 3/3
  avg_judge  : 4.667/5
============================================================
[PASS] time-1      rb=True  tt=True  judge=5
[PASS] time-2      rb=True  tt=True  judge=4
[PASS] calc-1      rb=True  tt=True  judge=5

results saved to: results.json
```

회귀 발견 예: 모델을 약한 것으로 바꾸면 `multi-1` (`지금 몇 시인지 알려주고, 12 * 7 도 계산해줘`) 케이스에서
`tool_trace=False` (calculate 호출 누락) 가 발생하는 식.

## 7. 트레이드오프 / 운영 주의
- **Golden set 유지비용이 핵심**. 10개로는 부족 — 운영하면서 실패 케이스를 골든셋으로 흡수하는 사이클 필요.
- **LLM-as-judge 자체가 비결정적**. 같은 응답에 점수가 흔들리므로 N=3 평균 / 별도 strict prompt / temperature=0 권장.
- **judge 모델 = target 모델** 이면 self-bias 가능 → judge 는 다른 패밀리 / 더 강한 모델 사용 권장.
- **Tool trace 비교** 는 set superset 으로 했지만 호출 횟수/순서까지 보고 싶다면 list 비교로 바꾸기.
- **Rule-based 키워드** 는 brittle. 토큰 변형(`56,088` vs `56088`) 에 약함 → 필요 시 정규식 또는 정규화 단계 추가.

### LangSmith 연동 (선택)
```bash
export LANGSMITH_API_KEY=...
export LANGSMITH_PROJECT=eval_harness
export LANGSMITH_TRACING=true
python run.py
```
- 각 batch 호출이 자동 트레이싱됨.
- LangSmith Datasets 로 `golden_dataset.json` 을 업로드하면 UI 에서 회귀 비교 가능.
- 본 프로젝트는 LangSmith 없이도 완결되도록 설계됨.

## 8. 부모 프로젝트와의 관계
- 그래프 자체는 `graph-basic/15_react_tool_loop.py` 와 동일한 ReAct 구조.
- 새로 추가된 것은 `run.py` 의 평가 파이프라인 — 부모 프로젝트는 평가 인프라가 없음.
- `docs/심화주제.md` §8 직접 구현체.
