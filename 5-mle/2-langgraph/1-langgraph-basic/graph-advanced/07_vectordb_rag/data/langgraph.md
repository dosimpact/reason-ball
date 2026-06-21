# LangGraph

LangGraph is a library for building stateful, multi-actor applications with LLMs.
It extends LangChain with cyclic graph support, allowing complex agent workflows
beyond simple chains.

## 핵심 개념

- **State**: 그래프 전체에서 공유되는 데이터 구조 (TypedDict 기반).
- **Node**: state 를 입력받아 부분 업데이트를 반환하는 함수.
- **Edge**: 노드 간 전이 규칙 (정적 / 조건부).
- **Checkpointer**: thread_id 별 state 스냅샷 저장.

## 일반 사용 사례

- ReAct 에이전트 (agent ⇄ tools 사이클)
- Supervisor / multi-agent orchestration
- 사람 개입 (interrupt + resume)
- RAG 파이프라인의 cycle (retrieve → grade → rewrite query → retrieve …)
