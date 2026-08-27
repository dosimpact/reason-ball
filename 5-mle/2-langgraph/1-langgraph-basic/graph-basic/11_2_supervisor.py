"""
Example 11_2 — Hierarchical Supervisor (계층적 멀티에이전트).

11 번 예제(평면 supervisor)는 worker 가 늘어날수록
  1) supervisor 의 라우팅 enum 폭발
  2) system prompt 토큰 비대화
  3) 비슷한 worker 사이 라우팅 정확도 저하
문제가 생긴다. 이를 해결하기 위한 **계층적 supervisor** 패턴.

구조
----
top_supervisor 가 도메인 단위 "팀"을 고르고, 각 팀은 자기 worker 만 보는
team_supervisor 를 가진 **컴파일된 subgraph** 다. 각 supervisor 가 보는
선택지는 항상 3~5개로 유지되어 LLM 정확도가 회복된다.

  top_supervisor ─┬─▶ data_team    (sql / pandas / chart)
                  ├─▶ search_team  (web / kb / vector)
                  ├─▶ writing_team (draft / edit / summarize)
                  └─▶ FINISH ─▶ END

각 팀 subgraph 내부
  team_supervisor ─┬─▶ worker_A ─┐
                   ├─▶ worker_B ─┤── (worker → team_supervisor 복귀)
                   ├─▶ worker_C ─┘
                   └─▶ DONE ─▶ END(subgraph)

State 는 모든 레벨에서 `MessagesState` 를 공유하므로 팀이 만든 결과가
top 으로도 그대로 보인다.

학습 포인트
-----------
- 컴파일된 subgraph 를 부모의 노드로 부착 (예제 09 와 동일 메커니즘)
- 각 supervisor 가 자기 worker 만 아는 **국소화된 라우팅 enum**
- `MessagesState` 누적 + `name` 필드로 어떤 노드가 만든 메시지인지 추적
- top / team 각각 iteration 상한을 두어 무한 루프 방지

테스트 입력 예시
---------------
▶ data_team 만
   - "지난 분기 매출을 SQL 로 뽑고 차트로 보여줘"
▶ search_team 만
   - "LangGraph 가 뭔지 설명해줘"
▶ writing_team 만
   - "이 회의록을 한 문단으로 정리해줘: ... (긴 텍스트)"
▶ data → writing (다중 팀)
   - "지난 분기 매출 데이터를 분석하고 그 결과를 임원 보고용으로 정리해줘"
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


# ===========================================================================
# State
# ===========================================================================
class State(MessagesState):
    next_team: str  # top supervisor 결정: data | search | writing | FINISH
    next_worker: str  # team supervisor 결정: <worker name> | DONE
    top_iters: int  # top supervisor 호출 횟수
    team_iters: int  # 현재 팀 supervisor 호출 횟수


MAX_TOP_ITERS = 6  # top → 팀 디스패치 최대 횟수
MAX_TEAM_ITERS = 4  # 한 팀 안에서 worker 호출 최대 횟수


def _extract_text(content) -> str:
    """list 형식 content 를 문자열로 평탄화."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b["text"]
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return str(content)


# ===========================================================================
# Worker factory
# ===========================================================================
def _make_llm_worker(name: str, role_prompt: str):
    """LLM 으로 실제 답을 생성하는 워커 (writing_team 용)."""

    def node(state: State) -> dict:
        llm = create_llm()
        response = llm.invoke([SystemMessage(content=role_prompt), *state["messages"]])
        body = _extract_text(response.content)
        return {"messages": [AIMessage(content=f"[{name}] {body}", name=name)]}

    return node


def _make_stub_worker(name: str, mock_output: str):
    """LLM 호출 없이 고정 문자열만 돌려주는 더미 워커.

    데이터/검색 워커처럼 실제로 외부 시스템(SQL, 검색 API)을 붙여야 의미 있는
    역할은 데모용으로 mock 응답을 박아둔다. supervisor 라우팅 구조 학습이 목적.
    """

    def node(state: State) -> dict:
        return {"messages": [AIMessage(content=f"[{name}] {mock_output}", name=name)]}

    return node


# ---------------------------------------------------------------------------
# 팀 1: data_team — 모두 stub (실서비스에서는 SQL/pandas/chart 라이브러리 호출)
# ---------------------------------------------------------------------------
DATA_WORKERS = ["sql_runner", "pandas_runner", "chart_maker"]

sql_runner = _make_stub_worker(
    "sql_runner",
    "MOCK SQL result:\n"
    "  SELECT quarter, SUM(sales) FROM orders GROUP BY 1\n"
    "  → 2024Q4: 12.4억, 2024Q3: 10.1억, 2024Q2: 9.8억 (전분기 대비 +22.7%)",
)
pandas_runner = _make_stub_worker(
    "pandas_runner",
    "MOCK pandas transform:\n"
    "  df.groupby('region')['sales'].agg(['sum','mean']) 수행\n"
    "  → 수도권 7.2억(평균 240만), 영남 3.1억, 호남 2.1억",
)
chart_maker = _make_stub_worker(
    "chart_maker",
    "MOCK chart spec:\n"
    "  type=bar, x=quarter, y=sales, annotation='YoY +22.7% 전분기 대비 성장'\n"
    "  (실제 차트 객체 대신 spec 만 반환)",
)


# ---------------------------------------------------------------------------
# 팀 2: search_team — 모두 stub (실서비스에서는 검색 API/KB/벡터스토어 호출)
# ---------------------------------------------------------------------------
SEARCH_WORKERS = ["web_search", "kb_search", "vector_search"]

web_search = _make_stub_worker(
    "web_search",
    "MOCK web results:\n"
    "  - https://example.com/a — '관련 업계 동향 1'\n"
    "  - https://example.com/b — '관련 업계 동향 2'\n"
    "  - https://example.com/c — '관련 업계 동향 3'",
)
kb_search = _make_stub_worker(
    "kb_search",
    "MOCK internal KB results:\n"
    "  - confluence/팀위키/매출분석 가이드 v3\n"
    "  - confluence/재무팀/분기보고 템플릿\n"
    "  - confluence/CS팀/지난 분기 이슈로그",
)
vector_search = _make_stub_worker(
    "vector_search",
    "MOCK vector store results:\n"
    "  - score=0.91 'Q4 2024 retrospective: revenue beat plan by 12%'\n"
    "  - score=0.87 'Sales playbook update — enterprise tier'\n"
    "  - score=0.82 'Customer churn analysis 2024H2'",
)


# ---------------------------------------------------------------------------
# 팀 3: writing_team — LLM 으로 실제 글 생성
# ---------------------------------------------------------------------------
WRITING_WORKERS = ["drafter", "editor", "summarizer"]

drafter = _make_llm_worker(
    "drafter",
    "You are a drafter. Produce a first-draft answer for the user based on the "
    "conversation so far. Don't worry about polish — focus on covering content. "
    "Keep it under 150 words.",
)
editor = _make_llm_worker(
    "editor",
    "You are an editor. Take the latest draft in the conversation and improve "
    "clarity, flow, and tone. Return the polished version only. Keep it under 150 words.",
)
summarizer = _make_llm_worker(
    "summarizer",
    "You are a summarizer. Produce a concise one-paragraph summary of the "
    "conversation suitable for an executive audience. Keep it under 120 words.",
)


# ===========================================================================
# Team supervisor factory — 팀별로 자기 worker 만 알고 라우팅
# ===========================================================================
def _make_team_supervisor(team_name: str, workers: list[str], hint: str):
    """팀 supervisor 노드 + 라우터 + 빌드된 subgraph 를 함께 반환."""

    # 팀별 라우팅 스키마 (worker enum + DONE)
    enum_values = tuple(workers + ["DONE"])

    class TeamRoute(BaseModel):
        next_worker: Literal[enum_values] = Field(  # type: ignore[valid-type]
            description=(
                f"Pick the next worker from this {team_name} team, "
                "or DONE when the team has produced enough output."
            )
        )
        reason: str = Field(description="One-line reason")

    system = (
        f"You are the {team_name} team supervisor.\n"
        f"Your workers: {', '.join(workers)}.\n"
        f"Team purpose: {hint}\n\n"
        "Rules:\n"
        f"- Call each worker AT MOST ONCE per dispatch.\n"
        f"- After 1-2 worker outputs that adequately address the user's need, return DONE.\n"
        "- Never call a worker that does not belong to this team."
    )

    def team_supervisor(state: State) -> dict:
        iters = state.get("team_iters", 0) + 1
        if iters > MAX_TEAM_ITERS:
            return {
                "next_worker": "DONE",
                "team_iters": iters,
                "messages": [
                    AIMessage(
                        content=f"[{team_name}_supervisor → DONE] max team iterations",
                        name=f"{team_name}_supervisor",
                    )
                ],
            }
        llm = create_llm().with_structured_output(TeamRoute)
        routed = llm.invoke([SystemMessage(content=system), *state["messages"]])
        return {
            "next_worker": routed.next_worker,
            "team_iters": iters,
            "messages": [
                AIMessage(
                    content=f"[{team_name}_supervisor → {routed.next_worker}] {routed.reason}",
                    name=f"{team_name}_supervisor",
                )
            ],
        }

    def team_route(state: State) -> str:
        nxt = state.get("next_worker", "DONE")
        return "__end__" if nxt == "DONE" else nxt

    return team_supervisor, team_route


def _build_team_subgraph(team_name: str, workers: dict, hint: str):
    """team_supervisor + workers 로 구성된 컴파일된 subgraph 반환."""
    team_supervisor, team_route = _make_team_supervisor(
        team_name, list(workers.keys()), hint
    )

    sg = StateGraph(State)
    sg.add_node(f"{team_name}_supervisor", team_supervisor)
    for wname, wfn in workers.items():
        sg.add_node(wname, wfn)

    sg.add_edge(START, f"{team_name}_supervisor")
    sg.add_conditional_edges(
        f"{team_name}_supervisor",
        team_route,
        {**{w: w for w in workers}, "__end__": END},
    )
    # 진입할 때 team_iters 를 0 으로 리셋해야 다른 팀 진입 시 카운트가 섞이지 않는다.
    # 여기서는 단순화를 위해 그냥 누적 — 필요하면 worker 노드에서 reset 가능.
    for wname in workers:
        sg.add_edge(wname, f"{team_name}_supervisor")

    return sg.compile()


data_team = _build_team_subgraph(
    "data",
    {
        "sql_runner": sql_runner,
        "pandas_runner": pandas_runner,
        "chart_maker": chart_maker,
    },
    "Plan SQL queries, pandas transforms, and visualizations for tabular data analysis.",
)
search_team = _build_team_subgraph(
    "search",
    {"web_search": web_search, "kb_search": kb_search, "vector_search": vector_search},
    "Gather information from web, internal KB, and semantic vector store.",
)
writing_team = _build_team_subgraph(
    "writing",
    {"drafter": drafter, "editor": editor, "summarizer": summarizer},
    "Compose, polish, and summarize prose answers for the user.",
)


# ===========================================================================
# Top supervisor — 어떤 팀을 부를지 결정
# ===========================================================================
class TopRoute(BaseModel):
    next_team: Literal["data", "search", "writing", "FINISH"] = Field(
        description=(
            "Which team to dispatch next, or FINISH when the user's request "
            "has been fully addressed by the conversation so far."
        )
    )
    reason: str = Field(description="One-line reason")


_TOP_SYSTEM = (
    "You are the TOP supervisor coordinating three teams:\n"
    "- data    : SQL / pandas / charts for tabular data tasks\n"
    "- search  : web / KB / vector search for information lookup\n"
    "- writing : drafting / editing / summarizing prose\n\n"
    "Workflow:\n"
    "1) Inspect the latest user request and what teams have already produced.\n"
    "2) Dispatch the team that should act next.\n"
    "3) When the conversation contains a polished, user-facing answer, respond FINISH.\n\n"
    "Rules:\n"
    "- Each team should be dispatched AT MOST TWICE in total.\n"
    "- If a writing team output already exists, strongly prefer FINISH.\n"
    f"- Hard cap: {MAX_TOP_ITERS} top-level dispatches."
)


def top_supervisor(state: State) -> dict:
    iters = state.get("top_iters", 0) + 1
    if iters > MAX_TOP_ITERS:
        return {
            "next_team": "FINISH",
            "top_iters": iters,
            "messages": [
                AIMessage(
                    content="[top_supervisor → FINISH] max top iterations",
                    name="top_supervisor",
                )
            ],
        }
    llm = create_llm().with_structured_output(TopRoute)
    routed = llm.invoke([SystemMessage(content=_TOP_SYSTEM), *state["messages"]])
    return {
        "next_team": routed.next_team,
        "top_iters": iters,
        # 새 팀 진입 직전이므로 team_iters 리셋
        "team_iters": 0,
        "messages": [
            AIMessage(
                content=f"[top_supervisor → {routed.next_team}] {routed.reason}",
                name="top_supervisor",
            )
        ],
    }


def top_route(state: State) -> str:
    nxt = state.get("next_team", "FINISH")
    return "__end__" if nxt == "FINISH" else f"{nxt}_team"


# ===========================================================================
# Build top graph
# ===========================================================================
def build_graph():
    builder = StateGraph(State)
    builder.add_node("top_supervisor", top_supervisor)
    builder.add_node("data_team", data_team)  # 컴파일된 subgraph
    builder.add_node("search_team", search_team)  # 컴파일된 subgraph
    builder.add_node("writing_team", writing_team)  # 컴파일된 subgraph

    builder.add_edge(START, "top_supervisor")
    builder.add_conditional_edges(
        "top_supervisor",
        top_route,
        {
            "data_team": "data_team",
            "search_team": "search_team",
            "writing_team": "writing_team",
            "__end__": END,
        },
    )
    # 팀 종료 후 항상 top 으로 복귀해 다음 팀 / FINISH 결정
    builder.add_edge("data_team", "top_supervisor")
    builder.add_edge("search_team", "top_supervisor")
    builder.add_edge("writing_team", "top_supervisor")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content=(
                        "지난 분기 매출 데이터를 분석하고, "
                        "그 결과를 임원 보고용 한 문단으로 정리해줘."
                    )
                )
            ],
            "next_team": "",
            "next_worker": "",
            "top_iters": 0,
            "team_iters": 0,
        },
        config={"recursion_limit": 40},
    )
    print("\n=== transcript ===")
    for m in out["messages"]:
        tag = getattr(m, "name", None) or type(m).__name__
        body = _extract_text(m.content) if not isinstance(m.content, str) else m.content
        print(f"[{tag}] {body[:240]}")
