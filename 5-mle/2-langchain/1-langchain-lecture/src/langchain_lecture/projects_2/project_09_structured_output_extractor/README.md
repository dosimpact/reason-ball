# Project 09: Structured Output Extractor

## Purpose

자유 형식 텍스트 응답 대신 Pydantic schema 같은 명확한 구조로 결과를 추출하는 정보 추출 프로젝트를 만듭니다. 최종 목표는 LLM 출력을 사람이 읽는 문장이 아니라 downstream 코드가 바로 사용할 수 있는 typed data로 다루는 것입니다.

## Learning Objectives

- `.with_structured_output()`의 목적과 한계를 설명합니다.
- Pydantic model로 출력 schema를 정의합니다.
- optional field, enum, list, nested object를 사용합니다.
- validation 실패, 누락 필드, 잘못된 타입을 처리합니다.
- 추출 결과를 JSON, DB row, API response로 변환합니다.
- schema 설계가 prompt 품질과 모델 선택에 미치는 영향을 이해합니다.

## Core Concepts

- **Schema-first extraction**: 원하는 출력 구조를 먼저 정의한 뒤 모델 응답을 그 구조에 맞춥니다.
- **Validation**: 모델 응답이 타입, 필수 필드, 값 범위를 만족하는지 확인합니다.
- **Partial extraction**: 입력에서 일부 정보만 찾을 수 있을 때 null 또는 빈 배열을 허용합니다.
- **Retry/fallback**: validation 실패 시 더 엄격한 prompt나 다른 모델로 재시도합니다.
- **Downstream contract**: 다음 단계 코드가 의존할 수 있는 안정적인 데이터 계약입니다.

## Build Steps

1. 추출할 도메인을 정합니다. 예: 회의록에서 action item 추출, 이메일에서 일정 추출, 기사에서 회사/인물 추출.
2. Pydantic model을 정의합니다.
3. 예시 입력 5개 이상을 준비합니다. 정상 입력, 모호한 입력, 정보 누락 입력을 포함합니다.
4. chat model에 `.with_structured_output()`을 적용합니다.
5. 추출 결과를 출력하고 Pydantic validation 오류를 확인합니다.
6. validation 실패 시 재시도 또는 fallback 응답을 구현합니다.
7. 추출 결과를 JSON 파일 또는 downstream 함수에 전달합니다.

## Suggested File Layout

```text
project_09_structured_output_extractor/
  README.md
  main.py
  schemas.py
  extractor.py
  examples/
    inputs.jsonl
  tests/
    test_extractor.py
```

## Example Schema Ideas

```python
from pydantic import BaseModel, Field

class ActionItem(BaseModel):
    owner: str | None = Field(description="Person responsible for the task")
    task: str = Field(description="Concrete task to complete")
    due_date: str | None = Field(description="Due date if mentioned")
    priority: str | None = Field(description="low, medium, high, or null")

class MeetingExtraction(BaseModel):
    summary: str
    action_items: list[ActionItem]
```

## Manual Test Scenarios

| Scenario | Input | Expected Behavior |
| --- | --- | --- |
| Complete extraction | 담당자, 할 일, 마감일이 모두 있는 회의록 | 모든 필드가 채워진 객체가 반환됩니다. |
| Missing optional fields | 마감일이 없는 할 일 | `due_date`가 null이거나 생략 정책에 맞게 처리됩니다. |
| Multiple items | 여러 담당자의 할 일이 있는 텍스트 | list에 여러 action item이 들어갑니다. |
| Ambiguous text | 담당자가 불분명한 문장 | 추측을 최소화하고 nullable field를 사용합니다. |
| Invalid output | 모델이 schema를 어기는 상황 | validation 오류를 잡고 retry 또는 fallback을 수행합니다. |

## Done Criteria

- Pydantic schema가 도메인 요구사항을 표현합니다.
- 정상/누락/모호/오류 입력을 모두 처리합니다.
- validation 실패가 애플리케이션 전체 실패로 번지지 않습니다.
- 추출 결과를 downstream 코드에서 별도 parsing 없이 사용할 수 있습니다.
- README의 manual test를 모두 통과합니다.

## Extension Tasks

- enum과 nested schema를 추가합니다.
- 추출 confidence 또는 evidence span을 함께 반환합니다.
- 같은 입력을 schema-free prompt와 schema-first 방식으로 비교합니다.
- batch extraction과 실패 케이스 재처리 queue를 구현합니다.

## Official References

- Structured output: https://docs.langchain.com/oss/python/langchain/structured-output
- Models: https://docs.langchain.com/oss/python/langchain/models
- Pydantic: https://docs.pydantic.dev/
