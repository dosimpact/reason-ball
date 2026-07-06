# Project 12: LangSmith Observability Eval

## Purpose

LangSmith를 이용해 LangChain 실행 과정을 추적하고, 결과를 평가하는 실전 운영 흐름을 만듭니다. 최종 목표는 "잘 되는 것 같다"가 아니라 trace, dataset, evaluator, experiment를 근거로 품질 변화를 판단하는 것입니다.

## Learning Objectives

- LangSmith tracing을 켜고 chain/agent 실행 trace를 확인합니다.
- prompt, model call, tool call, retrieval 결과, latency, token 사용량을 관찰합니다.
- 실패한 run을 재현하고 원인을 분류합니다.
- dataset을 만들어 반복 가능한 평가 세트를 구성합니다.
- evaluator를 정의해 correctness, groundedness, format, latency 같은 기준을 측정합니다.
- prompt/model/retrieval 변경 전후 experiment를 비교합니다.

## Core Concepts

- **Trace**: LangChain 실행의 단계별 기록입니다.
- **Run**: 하나의 chain, model, tool, retriever 호출 단위입니다.
- **Dataset**: 반복 평가에 사용할 입력과 reference output 모음입니다.
- **Evaluator**: 출력 품질을 점수화하거나 pass/fail로 판단하는 함수 또는 LLM judge입니다.
- **Experiment**: 특정 버전의 앱을 dataset에 대해 실행한 결과입니다.
- **Regression evaluation**: 변경 후 기존 품질이 깨지지 않았는지 확인하는 평가입니다.

## Build Steps

1. 기존 chain 또는 agent 하나를 선택합니다. RAG chain을 사용하면 trace 확인 효과가 큽니다.
2. LangSmith 환경 변수를 설정합니다.
3. 앱을 한 번 실행하고 LangSmith UI에서 trace가 남는지 확인합니다.
4. trace에서 prompt, model input/output, tool call, retriever result를 확인합니다.
5. 대표 질문 5~10개로 dataset을 만듭니다.
6. rule-based evaluator를 하나 만듭니다. 예: 출력에 source가 포함되는지 확인.
7. LLM-as-judge evaluator를 하나 추가합니다. 예: reference answer와 의미적으로 일치하는지 평가.
8. prompt 또는 retrieval 설정을 변경한 뒤 experiment를 다시 실행하고 결과를 비교합니다.

## Environment Variables

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY="your-langsmith-api-key"
export LANGSMITH_PROJECT="langchain-projects-2"
```

모델 공급자 key도 함께 설정해야 합니다.

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

## Suggested File Layout

```text
project_12_langsmith_observability_eval/
  README.md
  app.py
  dataset.py
  evaluators.py
  run_eval.py
  eval_cases.jsonl
  tests/
    test_evaluators.py
```

## Evaluation Matrix

| Metric | Type | Example Pass Criteria |
| --- | --- | --- |
| Correctness | LLM judge or reference match | 핵심 사실이 reference와 일치합니다. |
| Groundedness | LLM judge or source check | 답변이 검색된 문서 근거를 벗어나지 않습니다. |
| Format | Rule-based | JSON/schema/markdown 형식을 지킵니다. |
| Latency | Numeric | p95 latency가 목표 이하입니다. |
| Tool success | Rule-based | 필요한 tool call이 성공했습니다. |

## Manual Test Scenarios

| Scenario | Action | Expected Behavior |
| --- | --- | --- |
| Trace smoke test | 앱을 한 번 실행 | LangSmith project에 trace가 생성됩니다. |
| Tool trace | tool을 쓰는 질문 실행 | tool input/output이 trace에서 보입니다. |
| Dataset eval | 5개 질문으로 evaluation 실행 | experiment 결과가 생성됩니다. |
| Regression check | prompt를 일부러 나쁘게 변경 | evaluator 점수가 하락합니다. |
| Debug failed run | 실패 run 하나 선택 | 실패 원인을 prompt/retrieval/model/tool 중 하나로 분류합니다. |

## Done Criteria

- LangSmith에서 최소 1개 trace를 확인했습니다.
- dataset과 evaluator를 이용해 최소 1개 experiment를 실행했습니다.
- 변경 전후 experiment를 비교했습니다.
- 실패 run을 하나 이상 분석하고 원인을 기록했습니다.
- 평가 결과가 다음 개선 작업을 결정하는 데 사용됩니다.

## Extension Tasks

- production trace에서 dataset 후보를 추출합니다.
- online evaluation 또는 automation rule을 설정합니다.
- RAG project의 retrieval 전략별 experiment를 비교합니다.
- CI에서 핵심 dataset 평가를 실행하는 script를 추가합니다.

## Official References

- LangSmith observability: https://docs.langchain.com/langsmith/observability
- LangSmith evaluation: https://docs.langchain.com/langsmith/evaluation
- Evaluation concepts: https://docs.langchain.com/langsmith/evaluation-concepts
- Manage datasets: https://docs.langchain.com/langsmith/manage-datasets
- Evaluate agents: https://docs.langchain.com/langsmith/evaluate-llm-application
