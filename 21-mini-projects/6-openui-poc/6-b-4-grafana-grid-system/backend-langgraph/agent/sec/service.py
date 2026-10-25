"""수집 서브그래프와 근거 검색을 공유하는 SEC 서비스."""

import asyncio
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from agent.documents import embed, pack, unpack, validate_vectors
from agent.prepare_documents import passages
from agent.sec import client, storage
from agent.sec.parsing import annual_series, extract_report


class CollectionState(TypedDict, total=False):
    cik: str
    years: int
    form: str
    filings: list[dict]
    results: list[dict]


async def discover(state):
    return {
        "filings": await client.list_filings(
            state["cik"], state.get("years", 1), state.get("form", "10-K")
        )
    }


async def collect_one(filing):
    try:
        saved = await asyncio.to_thread(storage.get_filing, filing["id"])
        if saved["status"] in ("downloaded", "indexed"):
            return {**filing, "status": saved["status"], "cached": True}
    except ValueError:
        pass
    try:
        html = await client.fetch(
            filing["url"], max_age=365 * 86400, json_response=False
        )
        text, sections = await asyncio.to_thread(extract_report, html, filing["form"])
        await asyncio.to_thread(
            storage.save_filing, filing, "downloaded", text=text, sections=sections
        )
        return {**filing, "status": "downloaded", "sections": list(sections)}
    except Exception as exc:  # noqa: BLE001 - provider boundary preserves failure status
        error = f"{type(exc).__name__}: SEC original unavailable"
        await asyncio.to_thread(storage.save_filing, filing, "failed", error=error)
        return {**filing, "status": "failed", "error": error}


async def download_reports(state):
    return {"results": [await collect_one(filing) for filing in state["filings"]]}


builder = StateGraph(CollectionState)
builder.add_node("discover_filings", discover)
builder.add_node("download_originals", download_reports)
builder.add_edge(START, "discover_filings")
builder.add_edge("discover_filings", "download_originals")
builder.add_edge("download_originals", END)
collection_graph = builder.compile()


async def collect(cik, years=1, form="10-K"):
    result = await collection_graph.ainvoke(
        {"cik": client.cik_number(cik), "years": years, "form": form}
    )
    rows = result["results"]
    return {
        "filings": rows,
        "downloaded": sum(r["status"] in ("downloaded", "indexed") for r in rows),
        "failed": sum(r["status"] == "failed" for r in rows),
        "reused": sum(bool(r.get("cached")) for r in rows),
    }


async def financials(
    cik, metric="revenue", years=3, exclude_years=None, *, refresh=False
):
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{client.cik_number(cik)}.json"
    facts = await client.fetch(url, max_age=0 if refresh else 3600)
    result = annual_series(facts, metric, years, exclude_years)
    result["queried_at"] = storage.now()
    result["source_fetched_at"] = await asyncio.to_thread(storage.cached_at, url)
    result["latest_filing_date"] = max(
        (row.get("filed") or "" for row in result["rows"]), default=""
    )
    return result


def read_section(filing_id, section="", offset=0, limit=16000):
    if not 0 <= offset or not 100 <= limit <= 24000:
        raise ValueError("Invalid section range")
    filing = storage.get_filing(filing_id)
    if filing["status"] not in ("downloaded", "indexed"):
        raise ValueError("Filing original has not been downloaded")
    available = list(filing["sections"])
    if section:
        matching = [k for k in available if k.lower() == section.strip().lower()]
        if not matching and section.strip().lower().startswith("item "):
            matching = [
                k
                for k in available
                if k.lower().endswith(" " + section.strip().lower())
            ]
        if len(matching) > 1:
            return {
                "error": "Ambiguous section; specify Part and Item",
                "matching_sections": matching,
                "available_sections": available,
                "url": filing["url"],
            }
        section = matching[0] if matching else section
        found = filing["sections"].get(section)
        if found is None:
            return {
                "error": "Section not extracted; inspect full text",
                "available_sections": available,
                "url": filing["url"],
            }
        text = found["text"]
    else:
        text = filing["text"]
    return {
        "filing_id": filing_id,
        "company": filing["company"],
        "report_date": filing["report_date"],
        "section": section or "Full report",
        "text": text[offset : offset + limit],
        "offset": offset,
        "next_offset": offset + limit if offset + limit < len(text) else None,
        "total_characters": len(text),
        "available_sections": available,
        "url": filing["url"],
    }


_index_locks = {}


async def index_filing(filing_id):
    lock = _index_locks.setdefault(filing_id, asyncio.Lock())
    async with lock:
        filing = await asyncio.to_thread(storage.get_filing, filing_id)
        if filing["status"] == "indexed":
            return
        if filing["status"] != "downloaded":
            raise ValueError("Download original before indexing")
        sections = filing["sections"] or {"Full report": {"text": filing["text"]}}
        chunks = [
            (name, chunk)
            for name, section in sections.items()
            for chunk in passages(section["text"])
        ]
        vectors = []
        for start in range(0, len(chunks), 100):
            vectors.extend(
                await embed([text for _, text in chunks[start : start + 100]])
            )
        validate_vectors(vectors, len(chunks))

        def save():
            with storage.connection() as db:
                db.execute("DELETE FROM passages WHERE filing_id=?", (filing_id,))
                db.executemany(
                    "INSERT INTO passages(filing_id,section,text,embedding) VALUES (?,?,?,?)",
                    [
                        (filing_id, section, text, pack(vector))
                        for (section, text), vector in zip(chunks, vectors, strict=True)
                    ],
                )
                db.execute(
                    "UPDATE filings SET status='indexed' WHERE id=?", (filing_id,)
                )

        await asyncio.to_thread(save)


async def search(query, filing_ids, count=4):
    if (
        not 1 <= len(filing_ids) <= 20
        or not 1 <= count <= 8
        or not 3 <= len(query) <= 500
    ):
        raise ValueError("Provide a query, 1–20 filings and 1–8 passages per filing")
    for filing_id in filing_ids:
        await index_filing(filing_id)
    vector = (await embed([query]))[0]

    def retrieve():
        results = []
        with storage.connection() as db:
            for filing_id in filing_ids:
                filing = storage.get_filing(filing_id)
                ranked = []
                for row in db.execute(
                    "SELECT section,text,embedding FROM passages WHERE filing_id=?",
                    (filing_id,),
                ):
                    stored = unpack(row["embedding"])
                    if len(stored) != len(vector):
                        raise ValueError(
                            "Embedding dimensions changed; reindex required"
                        )
                    score = sum(a * b for a, b in zip(vector, stored, strict=True))
                    ranked.append(
                        {
                            "section": row["section"],
                            "text": row["text"],
                            "score": round(score, 4),
                            "url": filing["url"],
                        }
                    )
                ranked.sort(key=lambda r: r["score"], reverse=True)
                results.append(
                    {
                        "filing_id": filing_id,
                        "company": filing["company"],
                        "report_date": filing["report_date"],
                        "passages": ranked[:count],
                        "note": "Similarity is not proof that a fact is absent",
                    }
                )
        return results

    return {"query": query, "results": await asyncio.to_thread(retrieve)}
