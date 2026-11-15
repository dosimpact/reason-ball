"""Reproducible model-1 experiment over the three user-supplied local reports."""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from domains.tenk.document_structure import ITEM_CODES, FilingMetadata, parse_document
from infrastructure.neo4j.writer import Neo4jWriter
from settings import get_settings

PACKAGE = Path(__file__).resolve().parents[1]
SAMPLES = (
    (
        "aapl-20260926-10k.htm",
        FilingMetadata(
            "0000320193",
            "Apple Inc.",
            "AAPL",
            "0000320193-26-000026",
            "2026-11-03",
            "2026-09-26",
            "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
        ),
    ),
    (
        "cpng-20251231-10k.htm",
        FilingMetadata(
            "0001834584",
            "Coupang, Inc.",
            "CPNG",
            "0001834584-26-000024",
            "2026-02-26",
            "2025-12-31",
            "https://www.sec.gov/Archives/edgar/data/1834584/000183458426000024/cpng-20251231.htm",
        ),
    ),
    (
        "nvda-20260125-10k.htm",
        FilingMetadata(
            "0001045810",
            "NVIDIA CORP",
            "NVDA",
            "0001045810-26-000021",
            "2026-02-25",
            "2026-01-25",
            "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm",
        ),
    ),
)
STYLE = "body{font:16px system-ui;margin:0;color:#17212b;background:#f6f7f9}header,nav,main{padding:1rem 2rem}nav{display:flex;gap:.7rem;flex-wrap:wrap;background:#e9edf3}main{max-width:1100px;margin:auto;background:white;overflow-wrap:anywhere}section{padding:1rem 0;border-bottom:2px solid #aaa;overflow-x:auto}table{max-width:100%;border-collapse:collapse}a{color:#164a9b}h1{font-size:1.5rem}"


def page(title: str, body: str) -> str:
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>{html.escape(title)}</title><style>{STYLE}</style></head><body>{body}</body></html>'


def _preview_body(source: str, retained_ids: set[str], *, standalone: bool) -> str:
    """Resolve preview navigation without mutating the stored Item payload."""
    soup = BeautifulSoup(source, "html.parser")
    local_ids = {str(tag["id"]) for tag in soup.find_all(id=True)}
    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        if not href.startswith("#"):
            continue
        target = href[1:]
        if target not in retained_ids:
            anchor.unwrap()
        elif standalone and target not in local_ids:
            anchor["href"] = "preview.html" + href
    return str(soup)


def export_previews(output: Path, result: dict, meta: FilingMetadata) -> None:
    folder = output / meta.ticker.lower()
    folder.mkdir(parents=True, exist_ok=True)
    items = [
        node["properties"] for node in result["nodes"] if node["labels"] == ["Item"]
    ]
    nav = (
        '<nav aria-label="Items">'
        + "".join(
            f'<a href="#item-{item["itemCode"]}">Item {item["itemCode"]}</a>'
            for item in items
        )
        + "</nav>"
    )
    title = f"{meta.ticker} — {meta.report_date} 10-K — Model 1"
    header = f'<header><a href="../index.html">All reports</a><h1>{html.escape(title)}</h1><p>Sanitized Item content · XML metadata removed · no external assets</p></header>'
    retained_ids = {f"item-{item['itemCode']}" for item in items}
    for item in items:
        fragment = BeautifulSoup(item["displayHtml"], "html.parser")
        retained_ids.update(str(tag["id"]) for tag in fragment.find_all(id=True))
    sections = []
    for item in items:
        label = f"Item {item['itemCode']} — {item['title']}"
        body = f'<section id="item-{item["itemCode"]}"><h2>{html.escape(label)}</h2>{item["displayHtml"]}</section>'
        sections.append(_preview_body(body, retained_ids, standalone=False))
        standalone_body = _preview_body(body, retained_ids, standalone=True)
        (folder / f"item-{item['itemCode'].lower()}.html").write_text(
            page(label, header + "<main>" + standalone_body + "</main>"),
            encoding="utf-8",
        )
    (folder / "preview.html").write_text(
        page(title, header + nav + "<main>" + "".join(sections) + "</main>"),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir", type=Path, default=PACKAGE.parent / "docs/human-docs/1-sec-분석"
    )
    parser.add_argument(
        "--output", type=Path, default=PACKAGE / ".tmp/model1-three-filings"
    )
    parser.add_argument(
        "--write-neo4j",
        action="store_true",
        help="Opt-in idempotent MERGE of these three model-1 payloads; no deletion",
    )
    args = parser.parse_args()
    # Parse all inputs successfully before exporting or writing anything.
    results = [
        (
            meta,
            parse_document(
                (args.source_dir / filename).read_bytes(),
                meta,
                expected_codes=ITEM_CODES,
            ),
        )
        for filename, meta in SAMPLES
    ]
    args.output.mkdir(parents=True, exist_ok=True)
    graph = {
        "nodes": [node for _, result in results for node in result["nodes"]],
        "relationships": [
            rel for _, result in results for rel in result["relationships"]
        ],
    }
    summary = {
        "reports": [result["summary"] for _, result in results],
        "nodes": len(graph["nodes"]),
        "relationships": len(graph["relationships"]),
        "neo4jWritten": False,
    }
    if args.write_neo4j:
        with Neo4jWriter(settings=get_settings()) as writer:
            summary["writeResult"] = writer.write_graph(graph)
        summary["neo4jWritten"] = True
    for meta, result in results:
        export_previews(args.output, result, meta)
    links = "".join(
        f'<li><a href="{meta.ticker.lower()}/preview.html">{meta.ticker}: {meta.report_date} — {result["summary"]["itemCount"]} Items</a></li>'
        for meta, result in results
    )
    (args.output / "index.html").write_text(
        page(
            "SEC Model 1 — Three reports",
            "<main><h1>SEC Model 1 — Three reports</h1><p>Company → Filing → Item · sanitized HTML and text</p><ul>"
            + links
            + "</ul></main>",
        ),
        encoding="utf-8",
    )
    (args.output / "graph.json").write_text(
        json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output.resolve()),
                "reports": [
                    {"ticker": meta.ticker, "items": result["summary"]["itemCount"]}
                    for meta, result in results
                ],
                "nodes": len(graph["nodes"]),
                "relationships": len(graph["relationships"]),
                "neo4jWritten": summary["neo4jWritten"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
