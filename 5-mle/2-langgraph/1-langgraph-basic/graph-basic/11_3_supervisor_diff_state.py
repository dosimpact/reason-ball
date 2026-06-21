"""
Example 11_3 — Hierarchical Supervisor with **per-team isolated State**.

11_2 는 부모 그래프와 모든 팀 subgraph 가 **하나의 State 클래스**를 공유했다.
구현은 단순하지만 다음 단점이 있다:

  - 팀 내부에서만 의미 있는 필드(중간 SQL 결과, 초안, 리비전 카운트 등)가
    부모 state 에도 그대로 노출됨 → 스키마가 거대해지고 책임 경계가 흐려짐
  - 한 팀이 추가한 필드를 다른 팀이 실수로 덮어쓸 위험
  - 부모 응답에 팀 내부 디버그 필드까지 섞여 나갈 수 있음

본 예제는 **부모와 각 팀이 서로 다른 State 클래스**를 쓰면서도
**messages 만 자동으로 공유**되도록 분리한다.

핵심 메커니즘
-------------
LangGraph 는 컴파일된 subgraph 를 부모의 노드로 부착할 때,
**부모와 자식의 state schema 에서 키 이름이 일치하는 필드만 양방향으로 전달**한다.

  - ParentState 와 각 TeamState 가 모두 `MessagesState` 를 상속 → `messages` 공유
  - 그 외 필드는 각자의 schema 안에만 존재 → 캡슐화

따라서:
  - 팀이 messages 에 push 한 AIMessage 는 부모로 자동 전파
  - 팀의 내부 스크래치 필드(sql_result, draft, revision_count, team_iters 등)는
    부모 schema 에 정의되지 않았으므로 부모로 전파되지 않음 (= 캡슐화 성공)
  - 부모의 라우팅 필드(next_team, top_iters)는 팀 schema 에 없으므로 팀 안에서 안 보임

State 매핑 도식
---------------
    ParentState                 DataTeamState              WritingTeamState
    ───────────                 ─────────────              ────────────────
    messages       ◀──공유──▶   messages       (공유 X)    messages       ◀──공유──▶
    next_team                   next_worker                next_worker
    top_iters                   team_iters                 team_iters
                                sql_result                 draft
                                pandas_result              revision_count
                                chart_spec

구조 (11_2 와 동일)
-------------------
  top_supervisor ─┬─▶ data_team    (sql / pandas / chart, 내부 스크래치 보유)
                  ├─▶ writing_team (draft / edit, 초안+리비전 카운트 보유)
                  └─▶ FINISH ─▶ END

테스트 입력 예시
---------------
- {"messages": [{"role": "user", "content": "지난 분기 매출을 분석하고 임원 보고용으로 정리해줘"}]}

확인 포인트
-----------
- out["messages"]: data_team / writing_team 의 발화가 모두 누적
- out 키에 sql_result / draft 등 팀 내부 필드는 **존재하지 않음** (= 누설 차단)
- out 키 = {"messages", "next_team", "top_iters"} 만 존재
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


# ===========================================================================
# State 정의 — 부모와 각 팀이 서로 다른 클래스
# ===========================================================================
class ParentState(MessagesState):
    """부모는 라우팅 정보만 들고 다닌다. 팀 내부 필드는 모름."""
    next_team: str       # data | writing | FINISH
    top_iters: int


class DataTeamState(MessagesState):
    """data_team 전용 — SQL/pandas/chart 의 중간 산출물을 내부에 보관."""
    next_worker: str
    team_iters: int
    sql_result: str       # ← 부모에 노출 안 됨
    pandas_result: str    # ← 부모에 노출 안 됨
    chart_spec: str       # ← 부모에 노출 안 됨


class WritingTeamState(MessagesState):
    """writing_team 전용 — 초안과 리비전 횟수를 내부에 보관."""
    next_worker: str
    team_iters: int
    draft: str            # ← 부모에 노출 안 됨
    revision_count: int   # ← 부모에 노출 안 됨


MAX_TOP_ITERS = 6
MAX_TEAM_ITERS = 4


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b["text"] for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return str(content)


# ===========================================================================
# data_team — 내부 스크래치 필드(sql_result/pandas_result/chart_spec) 사용
# ===========================================================================
def sql_runner(state: DataTeamState) -> dict:
    """SQL 결과를 내부 필드 sql_result 에 저장하고 messages 에도 한 줄 push."""
    mock = (
        "2024Q4: 12.4억, 2024Q3: 10.1억 (전분기 대비 +22.7%)"
    )
    return {
        "sql_result": mock,  # 팀 내부에만 보존
        "messages": [
            AIMessage(content=f"[sql_runner] {mock}", name="sql_runner")
        ],
    }


def pandas_runner(state: DataTeamState) -> dict:
    """이전 sql_result 를 읽어 추가 가공 후 pandas_result 에 저장."""
    base = state.get("sql_result", "(no sql)")
    derived = f"groupby(region).sum() on [{base}] → 수도권 7.2억, 영남 3.1억"
    return {
        "pandas_result": derived,
        "messages": [
            AIMessage(content=f"[pandas_runner] {derived}", name="pandas_runner")
        ],
    }


def chart_maker(state: DataTeamState) -> dict:
    """앞 단계 결과를 종합해 차트 스펙만 생성."""
    spec = "type=bar, x=quarter, y=sales, annotation='YoY +22.7%'"
    return {
        "chart_spec": spec,
        "messages": [
            AIMessage(content=f"[chart_maker] spec={spec}", name="chart_maker")
        ],
    }


DATA_WORKERS = {"sql_runner": sql_runner, "pandas_runner": pandas_runner, "chart_maker": chart_maker}


# ===========================================================================
# writing_team — 내부 스크래치 필드(draft/revision_count) 사용
# ===========================================================================
def drafter(state: WritingTeamState) -> dict:
    """첫 초안을 LLM 으로 생성해 draft 에 저장."""
    llm = create_llm()
    response = llm.invoke([
        SystemMessage(
            content="You are a drafter. Write a first-draft executive summary "
                    "based on the conversation so far. Under 120 words."
        ),
        *state["messages"],
    ])
    body = _extract_text(response.content)
    return {
        "draft": body,
        "revision_count": 0,
        "messages": [AIMessage(content=f"[drafter] {body}", name="drafter")],
    }


def editor(state: WritingTeamState) -> dict:
    """draft 를 다듬어 갱신, revision_count++. (초안이 없으면 새로 작성)"""
    base = state.get("draft", "")
    rev = state.get("revision_count", 0) + 1
    llm = create_llm()
    prompt = (
        "You are an editor. Polish the following draft for clarity and tone. "
        "Return only the polished version, under 120 words.\n\n"
        f"DRAFT:\n{base}"
    )
    response = llm.invoke([SystemMessage(content=prompt), *state["messages"]])
    polished = _extract_text(response.content)
    return {
        "draft": polished,
        "revision_count": rev,
        "messages": [
            AIMessage(content=f"[editor rev={rev}] {polished}", name="editor")
        ],
    }


WRITING_WORKERS = {"drafter": drafter, "editor": editor}


# ===========================================================================
# Team supervisor factory (팀 schema 를 인자로 받음)
# ===========================================================================
def _make_team_supervisor(team_name: str, workers: list[str], hint: str):
    enum_values = tuple(workers + ["DONE"])

    class TeamRoute(BaseModel):
        next_worker: Literal[enum_values] = Field(  # type: ignore[valid-type]
            description=f"Pick the next worker in the {team_name} team, or DONE."
        )
        reason: str = Field(description="One-line reason")

    system = (
        f"You are the {team_name} team supervisor.\n"
        f"Workers: {', '.join(workers)}.\n"
        f"Purpose: {hint}\n\n"
        "Rules:\n"
        "- Call each worker AT MOST ONCE per dispatch.\n"
        "- After 1-2 outputs that adequately address the user, return DONE.\n"
        "- Never call a worker outside this team."
    )

    def supervisor(state) -> dict:
        iters = state.get("team_iters", 0) + 1
        if iters > MAX_TEAM_ITERS:
            return {
                "next_worker": "DONE",
                "team_iters": iters,
                "messages": [
                    AIMessage(
                        content=f"[{team_name}_supervisor → DONE] max team iters",
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

    def route(state) -> str:
        nxt = state.get("next_worker", "DONE")
        return "__end__" if nxt == "DONE" else nxt

    return supervisor, route


def _build_team_subgraph(team_name: str, state_cls, workers: dict, hint: str):
    """팀 schema(state_cls) 를 명시적으로 받아 빌드."""
    supervisor, route = _make_team_supervisor(team_name, list(workers.keys()), hint)

    sg = StateGraph(state_cls)  # ← 팀별 고유 schema
    sg.add_node(f"{team_name}_supervisor", supervisor)
    for wname, wfn in workers.items():
        sg.add_node(wname, wfn)

    sg.add_edge(START, f"{team_name}_supervisor")
    sg.add_conditional_edges(
        f"{team_name}_supervisor",
        route,
        {**{w: w for w in workers.keys()}, "__end__": END},
    )
    for wname in workers.keys():
        sg.add_edge(wname, f"{team_name}_supervisor")
    return sg.compile()


data_team = _build_team_subgraph(
    "data",
    DataTeamState,
    DATA_WORKERS,
    "Run SQL queries, pandas transforms, and chart specs for tabular analysis.",
)
writing_team = _build_team_subgraph(
    "writing",
    WritingTeamState,
    WRITING_WORKERS,
    "Draft and polish executive-style prose answers.",
)


# ===========================================================================
# Top supervisor — ParentState 만 사용
# ===========================================================================
class TopRoute(BaseModel):
    next_team: Literal["data", "writing", "FINISH"] = Field(
        description="Which team to dispatch, or FINISH when answer is ready."
    )
    reason: str = Field(description="One-line reason")


_TOP_SYSTEM = (
    "You are the TOP supervisor coordinating two teams:\n"
    "- data    : SQL / pandas / chart for tabular analysis\n"
    "- writing : drafting and editing prose answers\n\n"
    "Workflow:\n"
    "1) Inspect the latest user request and what teams have produced.\n"
    "2) Dispatch the team that should act next.\n"
    "3) When a polished, user-facing answer exists, respond FINISH.\n\n"
    "Rules:\n"
    "- Each team should be dispatched AT MOST TWICE in total.\n"
    "- If a writing team output already exists, strongly prefer FINISH.\n"
    f"- Hard cap: {MAX_TOP_ITERS} top-level dispatches."
)


def top_supervisor(state: ParentState) -> dict:
    iters = state.get("top_iters", 0) + 1
    if iters > MAX_TOP_ITERS:
        return {
            "next_team": "FINISH",
            "top_iters": iters,
            "messages": [
                AIMessage(
                    content="[top_supervisor → FINISH] max top iters",
                    name="top_supervisor",
                )
            ],
        }
    llm = create_llm().with_structured_output(TopRoute)
    routed = llm.invoke([SystemMessage(content=_TOP_SYSTEM), *state["messages"]])
    return {
        "next_team": routed.next_team,
        "top_iters": iters,
        "messages": [
            AIMessage(
                content=f"[top_supervisor → {routed.next_team}] {routed.reason}",
                name="top_supervisor",
            )
        ],
    }


def top_route(state: ParentState) -> str:
    nxt = state.get("next_team", "FINISH")
    return "__end__" if nxt == "FINISH" else f"{nxt}_team"


# ===========================================================================
# Build top graph — ParentState 사용
# ===========================================================================
def build_graph():
    builder = StateGraph(ParentState)  # ← 부모는 ParentState
    builder.add_node("top_supervisor", top_supervisor)
    builder.add_node("data_team", data_team)        # subgraph(DataTeamState)
    builder.add_node("writing_team", writing_team)  # subgraph(WritingTeamState)

    builder.add_edge(START, "top_supervisor")
    builder.add_conditional_edges(
        "top_supervisor",
        top_route,
        {
            "data_team": "data_team",
            "writing_team": "writing_team",
            "__end__": END,
        },
    )
    builder.add_edge("data_team", "top_supervisor")
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
            "top_iters": 0,
        },
        config={"recursion_limit": 40},
    )

    print("\n=== transcript (messages — 공유 키) ===")
    for m in out["messages"]:
        tag = getattr(m, "name", None) or type(m).__name__
        body = _extract_text(m.content) if not isinstance(m.content, str) else m.content
        print(f"[{tag}] {body[:200]}")

    print("\n=== parent state keys (팀 내부 필드 누설 여부 확인) ===")
    print(sorted(out.keys()))
    # 기대: ['messages', 'next_team', 'top_iters']
    # sql_result / draft / revision_count / team_iters 등은 보이지 않아야 함
