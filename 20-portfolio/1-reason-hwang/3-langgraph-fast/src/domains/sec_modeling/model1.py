from domains.tenk.document_structure import ITEM_CODES, FilingMetadata, parse_document
from infrastructure.neo4j.writer import Neo4jWriter


def build_document(request, generation, store):
    meta = request.metadata
    payload = parse_document(
        request.sourceHtml.encode(),
        FilingMetadata(
            cik=request.cik,
            name=meta.get("name", meta.get("companyName", request.cik)),
            ticker=meta.get("ticker", ""),
            accession_no=request.accessionNo,
            filing_date=meta["filingDate"],
            report_date=meta["reportDate"],
            source_url=meta.get("sourceUrl", ""),
            form_type=meta.get("formType", "10-K"),
        ),
        expected_codes=ITEM_CODES,
    )
    mapping = {}
    records = []
    for node in payload["nodes"]:
        old = node["key"]["id"]
        label = node["labels"][0]
        new = f"{generation}:{old}" if label == "Item" else old
        mapping[old] = new
        node["key"]["id"] = new
        node["properties"]["id"] = new
        if label == "Item":
            node["properties"].update(
                generationId=generation, filingId=request.filing_id
            )
            records.append({"type": "Item", **node["properties"]})
    for rel in payload["relationships"]:
        for end in ("start", "end"):
            rel[end]["key"]["id"] = mapping.get(
                rel[end]["key"]["id"], rel[end]["key"]["id"]
            )
    writer = Neo4jWriter()
    try:
        writer.write_graph(payload)
    finally:
        writer.close()
    store.save_records(generation, request.filing_id, 1, records)
    return {
        "items": len(records),
        "excludedBeforeFirstItemCharacters": payload["summary"][
            "excludedBeforeFirstItemCharacters"
        ],
        "excludedTrailingCharacters": payload["summary"]["excludedTrailingCharacters"],
    }
