"""
Lecture 06 — Agentic RAG.

`project/agentic-rag` 의 graph, chains, nodes, state, consts 를 한 파일로 합친 예제.

큰 흐름
-------
1. route_question: 질문을 vectorstore 또는 websearch 로 라우팅한다.
2. retrieve: 로컬 문서에서 관련 문서를 가져온다.
3. grade_documents: 검색 문서가 질문과 관련 있는지 평가한다.
4. websearch: 부족하면 웹 검색 결과를 문서로 추가한다.
5. generate: 문서 기반 답변을 생성한다.
6. hallucination/answer grader: 답변이 근거에 기반하고 질문에 답하는지 확인한다.
"""

from typing import Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

load_dotenv()


# ---------------------------------------------------------------------------
# 1. State and constants
# ---------------------------------------------------------------------------
RETRIEVE = "retrieve"
GRADE_DOCUMENTS = "grade_documents"
GENERATE = "generate"
WEBSEARCH = "websearch"


class GraphState(TypedDict, total=False):
    question: str
    generation: str
    web_search: bool
    documents: list[Document]


# ---------------------------------------------------------------------------
# 2. Small local retriever
# ---------------------------------------------------------------------------
# 원본은 Chroma + Lilian Weng 글 임베딩을 사용한다. 이 저장소 기본 의존성에는
# Chroma/loader 가 없으므로, Studio import 테스트가 가능하도록 작은 로컬 문서
# 컬렉션으로 같은 RAG 흐름을 재현한다.
LOCAL_DOCS = [
    Document(
        page_content=(
            "Agent memory lets an AI system retain useful context across steps. "
            "Short-term memory tracks the current task, while long-term memory can "
            "store user preferences, facts, and prior outcomes."
        )
    ),
    Document(
        page_content=(
            "Prompt engineering covers instructions, examples, decomposition, and "
            "constraints that guide language model behavior."
        )
    ),
    Document(
        page_content=(
            "Adversarial attacks on LLMs include prompt injection, data poisoning, "
            "jailbreak attempts, and retrieval manipulation."
        )
    ),
]


def _local_retrieve(question: str) -> list[Document]:
    terms = {token.strip("?.!,").lower() for token in question.split()}
    scored = []
    for doc in LOCAL_DOCS:
        text = doc.page_content.lower()
        score = sum(1 for term in terms if term and term in text)
        if score:
            scored.append((score, doc))
    return [doc for _, doc in sorted(scored, key=lambda item: item[0], reverse=True)]


# ---------------------------------------------------------------------------
# 3. Chains
# ---------------------------------------------------------------------------
llm = ChatOpenAI(temperature=0)


class RouteQuery(BaseModel):
    """Route a user query to the most relevant datasource."""

    datasource: Literal["vectorstore", "websearch"] = Field(
        description="Choose vectorstore for agent/prompt/adversarial topics, else websearch."
    )


route_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You route questions to vectorstore or websearch. The vectorstore contains "
            "documents about agents, prompt engineering, and adversarial attacks. "
            "Use websearch for current events or unrelated topics.",
        ),
        ("human", "{question}"),
    ]
)
question_router = route_prompt | llm.with_structured_output(RouteQuery)


class GradeDocuments(BaseModel):
    """Binary score for document relevance."""

    binary_score: str = Field(description="Documents are relevant, 'yes' or 'no'.")


retrieval_grader = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Grade whether the retrieved document is relevant to the user question. "
            "Return yes or no.",
        ),
        ("human", "Document:\n{document}\n\nQuestion:\n{question}"),
    ]
) | llm.with_structured_output(GradeDocuments)


class GradeHallucinations(BaseModel):
    """Binary score for grounding."""

    binary_score: bool = Field(description="Answer is grounded in the facts.")


hallucination_grader = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Assess whether the generation is grounded in the provided facts. "
            "Return true only if supported.",
        ),
        ("human", "Facts:\n{documents}\n\nGeneration:\n{generation}"),
    ]
) | llm.with_structured_output(GradeHallucinations)


class GradeAnswer(BaseModel):
    """Binary score for answer usefulness."""

    binary_score: bool = Field(description="Answer addresses the question.")


answer_grader = ChatPromptTemplate.from_messages(
    [
        ("system", "Assess whether the answer resolves the user's question."),
        ("human", "Question:\n{question}\n\nGeneration:\n{generation}"),
    ]
) | llm.with_structured_output(GradeAnswer)

generation_chain = (
    ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Answer the question using only the provided context. If context is "
                "insufficient, say what is missing.",
            ),
            ("human", "Question:\n{question}\n\nContext:\n{context}"),
        ]
    )
    | llm
    | StrOutputParser()
)


# ---------------------------------------------------------------------------
# 4. Nodes
# ---------------------------------------------------------------------------
def retrieve(state: GraphState) -> dict:
    question = state["question"]
    return {"documents": _local_retrieve(question), "question": question}


def grade_documents(state: GraphState) -> dict:
    question = state["question"]
    documents = state.get("documents", [])

    filtered_docs = []
    web_search = False
    for doc in documents:
        score = retrieval_grader.invoke(
            {"question": question, "document": doc.page_content}
        )
        if score.binary_score.lower() == "yes":
            filtered_docs.append(doc)
        else:
            web_search = True

    if not filtered_docs:
        web_search = True

    return {"documents": filtered_docs, "question": question, "web_search": web_search}


def web_search(state: GraphState) -> dict:
    question = state["question"]
    documents = list(state.get("documents", []))
    try:
        from langchain_tavily import TavilySearch

        results = TavilySearch(max_results=3).invoke({"query": question})["results"]
        content = "\n".join(result["content"] for result in results)
    except Exception as exc:
        content = f"Web search unavailable for {question!r}: {exc}"

    documents.append(Document(page_content=content))
    return {"documents": documents, "question": question}


def generate(state: GraphState) -> dict:
    question = state["question"]
    documents = state.get("documents", [])
    context = "\n\n".join(doc.page_content for doc in documents)
    generation = generation_chain.invoke({"context": context, "question": question})
    return {"documents": documents, "question": question, "generation": generation}


# ---------------------------------------------------------------------------
# 5. Routing
# ---------------------------------------------------------------------------
def route_question(state: GraphState) -> str:
    question = state["question"]
    source = question_router.invoke({"question": question})
    if source.datasource == WEBSEARCH:
        return WEBSEARCH
    return RETRIEVE


def decide_to_generate(state: GraphState) -> str:
    if state.get("web_search"):
        return WEBSEARCH
    return GENERATE


def grade_generation_grounded_in_documents_and_question(state: GraphState) -> str:
    question = state["question"]
    documents = state.get("documents", [])
    generation = state["generation"]

    score = hallucination_grader.invoke(
        {"documents": documents, "generation": generation}
    )
    if score.binary_score:
        answer_score = answer_grader.invoke(
            {"question": question, "generation": generation}
        )
        if answer_score.binary_score:
            return "useful"
        return "not useful"
    return "not supported"


# ---------------------------------------------------------------------------
# 6. Build graph
# ---------------------------------------------------------------------------
workflow = StateGraph(GraphState)
workflow.add_node(RETRIEVE, retrieve)
workflow.add_node(GRADE_DOCUMENTS, grade_documents)
workflow.add_node(GENERATE, generate)
workflow.add_node(WEBSEARCH, web_search)

workflow.add_conditional_edges(
    START,
    route_question,
    {WEBSEARCH: WEBSEARCH, RETRIEVE: RETRIEVE},
)
workflow.add_edge(RETRIEVE, GRADE_DOCUMENTS)
workflow.add_conditional_edges(
    GRADE_DOCUMENTS,
    decide_to_generate,
    {WEBSEARCH: WEBSEARCH, GENERATE: GENERATE},
)
workflow.add_conditional_edges(
    GENERATE,
    grade_generation_grounded_in_documents_and_question,
    {"not supported": GENERATE, "useful": END, "not useful": WEBSEARCH},
)
workflow.add_edge(WEBSEARCH, GENERATE)

graph = workflow.compile()


if __name__ == "__main__":
    print(graph.invoke({"question": "agent memory?"}))
