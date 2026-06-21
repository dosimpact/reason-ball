# Bedrock Guardrails

Bedrock Guardrails apply content filtering, PII masking, and prompt-injection
detection on inputs and outputs of foundation models.

## 차단 카테고리

- Hate / Insults / Sexual / Violence / Misconduct
- Prompt attack (jailbreak 시도 탐지)
- 민감 정보 (PII) 마스킹 또는 차단
- 사용자 정의 단어/주제 필터

## 사용 위치

LangGraph 노드의 LLM 호출 시 `guardrails={"guardrailIdentifier": ARN, "guardrailVersion": "N"}`
를 ChatBedrockConverse 에 넘기면 input/output 양방향에 자동 적용된다.
