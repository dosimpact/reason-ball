"""SEC metadata and compatibility entrypoint for the shared output graph."""
from graph.subgraphs.openui_output.workflow import GeneratedUI, build_output_graph, validate_program


async def compose_ui(question: str, answer: dict, model, *, evidence: dict | None = None, validator=None, host_evidence: bool = True) -> str:
    result = await build_output_graph(model, validator=validator or validate_program).ainvoke({
        "question": question, "answer": answer, "evidence": evidence or {},
        "host_evidence": host_evidence,
    })
    return result["program"]


def evidence_metadata(answer: dict, source: dict, evidence: dict) -> dict:
    return {
        "filing": source["filing"], "sourceUrl": source["sourceUrl"], "checkedAt": source["checkedAt"],
        "issuerNote": source.get("issuerNote"), "limitations": answer["limitations"],
        "coverage": {key: {"used": len(text), "total": len(source["sections"][key])} for key, text in evidence.items()},
        "findings": [{key: row[key] for key in ("item", "heading", "quote")} for row in answer["findings"]],
    }
