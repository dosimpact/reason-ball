# LangChain / LangGraph 전환을 고려한 코드 구조 규칙

## 핵심 원칙

LangChain `Runnable`이나 LangGraph `node`에 비즈니스 로직을 직접 넣지 않는다.

대신 먼저 프레임워크와 무관한 순수 로직을 분리하고, 그 위에 LangChain용 adapter와 LangGraph용 adapter를 얇게 만든다.

```text
core logic
  -> LangChain adapter
  -> LangGraph adapter
```

## 권장 디렉터리 구조

```text
app/
├── core/
│   ├── intent.py          # 순수 로직: 의도 분류 후처리, route 결정
│   ├── answer.py          # 답변 정책, 응답 포맷 처리
│   └── schemas.py         # 공통 타입, Pydantic 모델
├── llm/
│   ├── models.py          # LLM, embedding model 생성
│   └── prompts.py         # prompt 생성 또는 prompt template
├── chains/
│   └── routing_chain.py   # LangChain Runnable / LCEL 조립
├── graphs/
│   ├── state.py           # LangGraph State 정의
│   ├── nodes.py           # LangGraph node adapter
│   └── workflow.py        # graph edge, conditional edge, compile
├── services/
│   ├── vectorstore.py     # vector DB, retriever
│   └── external_api.py    # 외부 API, DB 접근
└── config.py              # 환경변수, 설정
```

## 레이어별 책임

### `core/`

LangChain, LangGraph를 모르는 순수 로직을 둔다.

```text
역할:
- 입력 정규화
- route 결정
- 의도 값 검증
- 응답 포맷 후처리
- 공통 타입 정의
- 프레임워크와 무관한 정책 로직
```

규칙:

```text
- langchain import 금지
- langgraph import 금지
- 가능하면 순수 함수로 작성
- 테스트하기 쉬운 형태로 유지
```

예시:

```python
from typing import Literal
from pydantic import BaseModel


Intent = Literal["rag", "chat", "summarize"]


class IntentResult(BaseModel):
    intent: Intent
    confidence: float = 1.0


def normalize_question(question: str) -> str:
    return question.strip()


def select_route(intent: Intent) -> str:
    if intent == "rag":
        return "rag"
    if intent == "summarize":
        return "summarize"
    return "chat"
```

## `llm/`

LLM 모델, embedding 모델, prompt template을 정의한다.

```text
역할:
- ChatOpenAI, embeddings 등 모델 생성
- prompt template 정의
- structured output 모델 연결
```

규칙:

```text
- 모델 생성 로직을 chain/node 내부에 직접 넣지 않기
- prompt 문자열을 여러 파일에 흩뿌리지 않기
```

## `chains/`

LangChain LCEL `Runnable` 조립만 담당한다.

```text
역할:
- prompt | model | parser 조립
- RunnableLambda adapter 작성
- RunnableBranch routing 구성
- LangChain 기반 실행 흐름 정의
```

규칙:

```text
- 복잡한 정책 로직은 core/로 분리
- chain 안에서는 조립과 연결에 집중
- Runnable 함수는 input -> output 형태로 유지
```

예시:

```python
from langchain_core.runnables import RunnableLambda, RunnableBranch, RunnablePassthrough

from app.core.intent import normalize_question, select_route
from app.llm.routing import router_chain


def classify_intent(inputs: dict) -> str:
    question = normalize_question(inputs["question"])
    result = router_chain.invoke({"question": question})
    return select_route(result.intent)


langchain_chain = (
    RunnablePassthrough.assign(route=RunnableLambda(classify_intent))
    | RunnableBranch(
        (lambda x: x["route"] == "rag", rag_chain),
        (lambda x: x["route"] == "summarize", summarize_chain),
        chat_chain,
    )
)
```

## `graphs/`

LangGraph 전용 state, node, workflow를 둔다.

```text
역할:
- State 정의
- node adapter 작성
- conditional edge 정의
- graph compile
```

규칙:

```text
- node는 state -> partial state 형태로 작성
- node 안에 복잡한 비즈니스 로직을 직접 넣지 않기
- route 판단은 가능하면 core 함수 재사용
- LangGraph 전용 흐름 제어만 graphs/에 둔다
```

예시:

```python
from app.core.intent import normalize_question, select_route
from app.llm.routing import router_chain


def classify_intent_node(state: dict) -> dict:
    question = normalize_question(state["question"])
    result = router_chain.invoke({"question": question})

    return {
        "intent": result.intent,
        "route": select_route(result.intent),
    }
```

```python
from langgraph.graph import StateGraph, END


def route_by_intent(state: dict) -> str:
    return state["route"]


graph = StateGraph(dict)

graph.add_node("classify_intent", classify_intent_node)
graph.add_node("rag", rag_node)
graph.add_node("summarize", summarize_node)
graph.add_node("chat", chat_node)

graph.set_entry_point("classify_intent")

graph.add_conditional_edges(
    "classify_intent",
    route_by_intent,
    {
        "rag": "rag",
        "summarize": "summarize",
        "chat": "chat",
    },
)

graph.add_edge("rag", END)
graph.add_edge("summarize", END)
graph.add_edge("chat", END)

app = graph.compile()
```

## `services/`

외부 시스템 접근 로직을 둔다.

```text
역할:
- vector store
- retriever
- database
- external API
- file storage
```

규칙:

```text
- 외부 I/O를 core 함수 안에 직접 넣지 않기
- chain/node에서는 service 함수를 호출하거나 주입해서 사용
```

## 작성 규칙 요약

```text
1. core/는 LangChain, LangGraph를 import하지 않는다.
2. chains/는 Runnable 조립만 담당한다.
3. graphs/는 LangGraph state, node, edge만 담당한다.
4. node 함수는 state -> partial state 형태로 작성한다.
5. Runnable 함수는 input -> output 형태로 작성한다.
6. prompt/model 생성은 chain/node 내부에 직접 넣지 않는다.
7. route 결정, 정규화, 검증 로직은 core/에 둔다.
8. DB, vector store, API 접근은 services/에 둔다.
9. LangChain으로 먼저 만들고, 복잡해지면 LangGraph adapter를 추가한다.
10. 같은 core 로직을 RunnableBranch와 conditional edge에서 재사용한다.
```

## 판단 기준

### LangChain만으로 충분한 경우

```text
- 단방향 pipeline
- intent routing
- 단순 RAG
- prompt -> model -> parser
- 간단한 fallback
- 요청 하나 안에서 끝나는 작업
```

### LangGraph를 고려할 경우

```text
- 여러 단계에서 공유 state가 필요함
- 조건부 분기가 여러 단계에 걸쳐 있음
- tool 호출 후 결과를 보고 다시 판단해야 함
- retry / reflect / revise loop가 있음
- multi-agent 구조
- human-in-the-loop
- checkpoint / resume 필요
- 대화 thread별 상태 관리가 중요함
```

## 최종 구조

```text
순수 로직: core 함수
LLM 호출: llm / chain 함수
LangChain 사용: Runnable adapter
LangGraph 사용: node adapter
```

이 구조를 따르면 처음에는 LangChain LCEL로 빠르게 구현하고, 이후 복잡도가 올라갔을 때 LangGraph로 비교적 자연스럽게 옮길 수 있다.
