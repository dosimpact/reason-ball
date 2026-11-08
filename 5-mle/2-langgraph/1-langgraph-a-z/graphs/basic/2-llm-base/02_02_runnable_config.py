"""Example 02-02 — 광고 분석으로 State, Runtime, RunnableConfig 비교하기.

쉽게 이해하기
-------------
State는 작업 중 바뀌는 데이터, Runtime.context는 이번 요청의 비즈니스 실행 환경이다.
RunnableConfig는 thread·실행 제한·추적 설정이고 Runtime은 Store와 이벤트 전송 기능도 제공한다.
같은 user_id를 기술적으로 configurable에도 넣을 수 있지만, 이 예제는 용도별로 나누어 전달한다.

새 개념
-------
- State: messages, campaign_ids, analysis_result, current_step.
- MessagesState는 입력의 role/content dict를 HumanMessage/AIMessage 객체로 변환한다.
- Runtime.context: user_id, advertiser_id, locale, permissions, environment.
- RunnableConfig: configurable.thread_id, recursion_limit, max_concurrency, tags, metadata, run_name.
- runtime.store: 광고주별 목표 ROAS 조회와 분석 결과 보관. context 값 자체는 저장소가 아니다.
- runtime.stream_writer: custom 진행 이벤트 전송. stream_mode="custom"으로 관찰한다.
- context/config는 호출자가 전달하며 노드의 변경 결과는 state update로 반환한다.

그래프 구조
-----------
광고주 권한을 확인해 연습 캠페인을 읽고, 성과를 계산한 뒤 요약 메시지를 만든다.

START → fetch_campaigns → analyze → summarize → END
        fetching         analyzing  summarizing → completed

테스트 입력 예시
----------------
입력 State(JSON):
```json
{
  "messages": [{"role": "user", "content": "캠페인 성과 분석해줘"}],
  "campaign_ids": ["cmp_1", "cmp_2"],
  "analysis_result": null,
  "current_step": "fetching_campaigns"
}
```
별도 context(JSON, state/config와 분리):
```json
{
  "user_id": "user_123",
  "advertiser_id": "adv_456",
  "locale": "ko-KR",
  "permissions": ["campaign:read"],
  "environment": "production"
}
```
별도 config(JSON):
```json
{
  "configurable": {"thread_id": "thread_789"},
  "recursion_limit": 30,
  "max_concurrency": 5,
  "tags": ["advertiser-agent", "production"],
  "metadata": {"request_id": "req_123"},
  "run_name": "campaign_analysis"
}
```
관찰할 결과:
- current_step은 fetching_campaigns → analyzing → summarizing → completed로 바뀐다.
- analysis_result는 null에서 광고비 300000원, 매출 500000원, CTR 3.0%, ROAS 1.67이 된다.
- observations에 각 노드가 실제 받은 State, context, config와 Runtime 기능 유무를 기록한다.
- context와 사용자 config는 작업 결과로 덮어쓰지 않는다.
- run_name은 바깥 실행 이름이다. 노드 config에는 없을 수 있으며 이때 null을 표시한다.

실행: uv run python -m graphs.basic.2-llm-base.02_02_runnable_config (API 키 불필요)
Python: graph.invoke(sample_input(), context=DEMO_CONTEXT, config=DEMO_CONFIG)
Studio/API에서도 input/context/config를 구분해 전달한다. context의 필수 식별자가 필요하다.
CLI는 InMemoryStore와 InMemorySaver를 연결하고 custom/values 스트림을 출력한다.
공개 graph에는 로컬 Store/checkpointer를 고정하지 않아 서버의 주입을 따른다.
thread_id만 지정하고 checkpointer를 연결하지 않으면 상태 저장이 생기는 것은 아니다.
max_concurrency=5는 상한이며, 이 직선 그래프를 병렬 실행으로 바꾸지는 않는다.

광고 수치는 로컬 고정 fixture다. environment="production"은 비즈니스 표식일 뿐이며
실제 광고 API·운영 계정·LLM은 호출하지 않는다. Context는 인증된 호출자가 제공한다고
가정하며 campaign:read 확인만 보여준다. Store는 이 예제에서 분석 메모를 저장하며
InMemoryStore는 프로세스 재시작 시 사라진다.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any, TypedDict

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.runtime import Runtime
from langgraph.store.base import BaseStore


@dataclass(frozen=True)
class Context:
    user_id: str
    advertiser_id: str
    locale: str
    permissions: list[str]
    environment: str


class Campaign(TypedDict):
    id: str
    impressions: int
    clicks: int
    spend: int
    revenue: int


class AgentState(MessagesState, total=False):
    campaign_ids: list[str]
    campaigns: list[Campaign]
    analysis_result: dict[str, Any] | None
    current_step: str
    observations: list[dict[str, Any]]


# 실제 광고 API 대신 사용하는 읽기 전용 연습 데이터. 노드에서는 복사해 사용한다.
CAMPAIGNS: dict[str, dict[str, Campaign]] = {
    "adv_456": {
        "cmp_1": {
            "id": "cmp_1",
            "impressions": 10000,
            "clicks": 500,
            "spend": 100000,
            "revenue": 300000,
        },
        "cmp_2": {
            "id": "cmp_2",
            "impressions": 20000,
            "clicks": 400,
            "spend": 200000,
            "revenue": 200000,
        },
    },
}
DEMO_CONTEXT = Context(
    user_id="user_123",
    advertiser_id="adv_456",
    locale="ko-KR",
    permissions=["campaign:read"],
    environment="production",
)
DEMO_CONFIG: RunnableConfig = {
    "configurable": {"thread_id": "thread_789"},
    "recursion_limit": 30,
    "max_concurrency": 5,
    "tags": ["advertiser-agent", "production"],
    "metadata": {"request_id": "req_123"},
    "run_name": "campaign_analysis",
}


def sample_input() -> dict:
    return {
        "messages": [{"role": "user", "content": "캠페인 성과 분석해줘"}],
        "campaign_ids": ["cmp_1", "cmp_2"],
        "analysis_result": None,
        "current_step": "fetching_campaigns",
        "observations": [],
    }


def observe(
    state: AgentState, config: RunnableConfig, runtime: Runtime[Context], node: str
) -> dict:
    """비교 출력용 복사본이다. Runtime 객체/내부 callback은 state에 넣지 않는다."""
    return {
        "node": node,
        "state": {
            "messages": [
                {"type": message.type, "content": message.content} for message in state["messages"]
            ],
            "campaign_ids": list(state.get("campaign_ids", [])),
            "analysis_result": state.get("analysis_result"),
            "current_step": state.get("current_step"),
        },
        "context": asdict(runtime.context),
        "config": {
            "configurable": {"thread_id": config.get("configurable", {}).get("thread_id")},
            "recursion_limit": config.get("recursion_limit"),
            "max_concurrency": config.get("max_concurrency"),
            "tags": list(config.get("tags", [])),
            "metadata": {"request_id": config.get("metadata", {}).get("request_id")},
            "run_name": config.get("run_name"),
        },
        "runtime": {
            "store_available": runtime.store is not None,
            "stream_writer_available": callable(runtime.stream_writer),
        },
    }


def fetch_campaigns(state: AgentState, config: RunnableConfig, runtime: Runtime[Context]) -> dict:
    context = runtime.context
    if context is None or not context.user_id or not context.advertiser_id:
        raise ValueError("context에 user_id와 advertiser_id가 필요합니다.")
    if "campaign:read" not in context.permissions:
        raise PermissionError("campaign:read 권한이 필요합니다.")
    campaign_ids = state.get("campaign_ids", [])
    available = CAMPAIGNS.get(context.advertiser_id, {})
    if not campaign_ids or any(campaign_id not in available for campaign_id in campaign_ids):
        raise ValueError("해당 광고주의 연습 캠페인 ID를 하나 이상 지정하세요.")
    runtime.stream_writer({"type": "campaign_progress", "step": "fetching_campaigns"})
    return {
        "campaigns": [dict(available[campaign_id]) for campaign_id in dict.fromkeys(campaign_ids)],
        "current_step": "analyzing",
        "observations": [
            *state.get("observations", []),
            observe(state, config, runtime, "fetch_campaigns"),
        ],
    }


def analyze(state: AgentState, config: RunnableConfig, runtime: Runtime[Context]) -> dict:
    # state는 작업 데이터, context는 광고주 정보, config는 실행/요청 식별자다.
    advertiser_id = runtime.context.advertiser_id
    request_id = config.get("metadata", {}).get("request_id", "demo-request")
    campaigns = state["campaigns"]
    spend = sum(campaign["spend"] for campaign in campaigns)
    revenue = sum(campaign["revenue"] for campaign in campaigns)
    impressions = sum(campaign["impressions"] for campaign in campaigns)
    clicks = sum(campaign["clicks"] for campaign in campaigns)
    store = runtime.store
    settings = store.get(("advertisers", advertiser_id), "settings") if store else None
    target_roas = settings.value["target_roas"] if settings else 2.0
    roas = round(revenue / spend, 2) if spend else 0.0
    result = {
        "source": "local-fixture",
        "currency": "KRW",
        "campaign_count": len(campaigns),
        "spend": spend,
        "revenue": revenue,
        "ctr_percent": round(clicks / impressions * 100, 2) if impressions else 0.0,
        "roas": roas,
        "target_roas": target_roas,
        "meets_target": roas >= target_roas,
    }
    if store is not None:
        store.put(("advertisers", advertiser_id, "analyses"), request_id, result)
    runtime.stream_writer({"type": "campaign_progress", "step": "analyzing", "roas": roas})
    return {
        "analysis_result": result,
        "current_step": "summarizing",
        "observations": [
            *state.get("observations", []),
            observe(state, config, runtime, "analyze"),
        ],
    }


def summarize(state: AgentState, config: RunnableConfig, runtime: Runtime[Context]) -> dict:
    result = state["analysis_result"]
    if runtime.context.locale == "ko-KR":
        answer = f"연습 캠페인 {result['campaign_count']}개: 광고비 {result['spend']:,}원, 매출 {result['revenue']:,}원, ROAS {result['roas']}."
    else:
        answer = f"Training campaigns: {result['campaign_count']}; spend KRW {result['spend']:,}, revenue KRW {result['revenue']:,}, ROAS {result['roas']}."
    runtime.stream_writer({"type": "campaign_progress", "step": "completed"})
    return {
        "messages": [AIMessage(content=answer)],
        "current_step": "completed",
        "observations": [
            *state.get("observations", []),
            observe(state, config, runtime, "summarize"),
        ],
    }


def build_graph(*, store: BaseStore | None = None, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(AgentState, context_schema=Context)
    builder.add_node("fetch_campaigns", fetch_campaigns)
    builder.add_node("analyze", analyze)
    builder.add_node("summarize", summarize)
    builder.add_edge(START, "fetch_campaigns")
    builder.add_edge("fetch_campaigns", "analyze")
    builder.add_edge("analyze", "summarize")
    builder.add_edge("summarize", END)
    return builder.compile(store=store, checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.store.memory import InMemoryStore

    store = InMemoryStore()
    store.put(("advertisers", "adv_456"), "settings", {"target_roas": 2.0})
    standalone = build_graph(store=store, checkpointer=InMemorySaver())
    print("SUBMITTED CONTEXT", json.dumps(asdict(DEMO_CONTEXT), ensure_ascii=False))
    print("SUBMITTED CONFIG", json.dumps(DEMO_CONFIG, ensure_ascii=False))
    for mode, value in standalone.stream(
        sample_input(),
        context=DEMO_CONTEXT,
        config=DEMO_CONFIG,
        stream_mode=["custom", "values"],
    ):
        if mode == "custom":
            print("EVENT", json.dumps(value, ensure_ascii=False))
        else:
            final = value
            print("STATE", value.get("current_step"), value.get("analysis_result"))
    print("NODE INPUT COMPARISON", json.dumps(final["observations"], ensure_ascii=False, indent=2))
    print("ANSWER", final["messages"][-1].content)
    print("STORED ANALYSIS", store.get(("advertisers", "adv_456", "analyses"), "req_123").value)
