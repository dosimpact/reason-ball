import json

from neo4j.exceptions import Neo4jError

from domains.sec_modeling.embedding import embed


def search(request, store):
    generations = []
    for filing in request.filingIds:
        first = store.active(filing, 1)
        second = store.active(filing, 2)
        if second and first and second["inputGenerationId"] == first["id"]:
            generations.append(second["id"])
    if not generations:
        return {"items": [], "total": 0}
    vector = embed([request.query])[0]
    rows = scoped_candidates(request, store, generations, vector)
    ranked = {"chunk": [], "statement": []}
    for row in rows:
        node = row["node"]
        if (
            node["generationId"] not in generations
            or node["filingId"] not in request.filingIds
            or node["kind"] not in ranked
        ):
            continue
        metadata = json.loads(node.get("metadata", "{}"))
        source = metadata.get("source", {}).get("metadata", {})
        item_id = source.get("itemId") or metadata.get("itemId")
        if (
            request.itemCodes
            and (source.get("itemCode") or metadata.get("itemCode"))
            not in request.itemCodes
        ):
            continue
        ranked[node["kind"]].append(
            {
                "id": node["id"],
                "evidenceId": node["id"],
                "type": node["kind"].title(),
                "text": node["text"],
                "filingId": node["filingId"],
                "generationId": node["generationId"],
                "itemId": item_id,
                "itemCode": source.get("itemCode") or metadata.get("itemCode"),
                "similarity": row["score"],
            }
        )
    fused = []
    for entries in ranked.values():
        for rank, row in enumerate(entries):
            row["score"] = 1 / (61 + rank)
            fused.append(row)
    unique = {}
    for row in sorted(fused, key=lambda x: x["score"], reverse=True):
        unique.setdefault((row["filingId"], row["text"]), row)
    return {
        "items": list(unique.values())[: request.topK],
        "total": min(len(unique), request.topK),
    }


def canonical_unit(value):
    """Compare unit JSON structurally; malformed filters explicitly match nothing.

    Measure order and JSON formatting are immaterial. Multiplicity and the
    numerator/denominator distinction remain significant for compound units.
    """
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    if not isinstance(value, dict) or set(value) != {"numerator", "denominator"}:
        return None
    for side in ("numerator", "denominator"):
        if not isinstance(value[side], list) or any(not isinstance(measure, str) or not measure for measure in value[side]):
            return None
    if not value["numerator"]:
        return None
    return tuple(sorted(value["numerator"])), tuple(sorted(value["denominator"]))


def facts(request, store):
    requested_unit = canonical_unit(request.unit) if request.unit is not None else None
    rows = []
    for filing in request.filingIds:
        active = store.active(filing, 3)
        if active:
            rows.extend(store.records(active["id"], "XbrlFact"))

    def matches(f):
        if request.analysisCategory and f.get("analysisCategory") != request.analysisCategory:
            return False
        if request.conceptQName and f["conceptQName"] != request.conceptQName:
            return False
        if request.period and any(
            f["context"].get(k) != v for k, v in request.period.items()
        ):
            return False
        if request.unit is not None and (requested_unit is None or requested_unit != canonical_unit(f["unit"])):
            return False
        dims = {d["dimension"]: d["member"] or d["typedValue"] for d in f["dimensions"]}
        return not request.dimensions or all(
            dims.get(k) == v for k, v in request.dimensions.items()
        )

    rows = [r for r in rows if matches(r)]
    return {
        "items": rows[request.offset : request.offset + request.limit],
        "total": len(rows),
        "offset": request.offset,
        "limit": request.limit,
    }


def evidence(evidence_id, store):
    rows = store.query(
        "MATCH (r:SecRecord {id:$id}) MATCH (g:SecGeneration {id:r.generationId}) RETURN r.data AS data, EXISTS { MATCH (:SecPublication)-[:ACTIVE]->(g) } AS isActive",
        id=evidence_id,
    )
    if rows:
        return {**json.loads(rows[0]["data"]), "isActive": rows[0]["isActive"]}
    if evidence_id.endswith(":evidence"):
        rows = store.query(
            "MATCH (r:SecRecord {id:$id}) MATCH (g:SecGeneration {id:r.generationId}) RETURN r.data AS data, EXISTS { MATCH (:SecPublication)-[:ACTIVE]->(g) } AS isActive",
            id=evidence_id.removesuffix(":evidence"),
        )
        if rows:
            fact = json.loads(rows[0]["data"])
            for source in fact.get("evidence", []):
                if source.get("id") == evidence_id and evidence_id in fact.get("evidenceIds", []):
                    return {
                        **source,
                        "factId": fact["id"],
                        "filingId": fact["filingId"],
                        "generationId": fact["generationId"],
                        "isActive": rows[0]["isActive"],
                    }
    rows = store.query(
        "MATCH (v:SecVector {id:$id}) MATCH (g:SecGeneration {id:v.generationId}) RETURN v{.id,.kind,.text,.filingId,.generationId,.metadata,.toolkitId,.chunkId} AS v, EXISTS { MATCH (:SecPublication)-[:ACTIVE]->(g) } AS isActive",
        id=evidence_id,
    )
    if not rows:
        return None
    node = rows[0]["v"]
    metadata = json.loads(node.get("metadata", "{}"))
    item_id = metadata.get("source", {}).get("metadata", {}).get(
        "itemId"
    ) or metadata.get("itemId")
    item = evidence(item_id, store) if item_id else {}
    chunks = supporting_chunks(node, metadata, store)
    return {
        "id": evidence_id,
        "filingId": node["filingId"],
        "generationId": node["generationId"],
        "itemId": item_id,
        "text": node["text"],
        "displayHtml": (item or {}).get("displayHtml", ""),
        "supportingChunks": chunks,
        "isActive": rows[0]["isActive"],
    }


def supporting_chunks(node, metadata, store):
    """Follow the toolkit statement.chunkId within its immutable generation.

    Never use the entire source Item as the statement's supporting quotation.
    Metadata fallback also supports vectors created before chunkId was indexed.
    """
    if node["kind"] == "chunk":
        return [
            {
                "id": node["id"],
                "filingId": node["filingId"],
                "generationId": node["generationId"],
                "text": node["text"],
            }
        ]
    chunk_id = metadata.get("statement", {}).get("chunkId")
    if not chunk_id:
        return []
    rows = store.query(
        "MATCH (v:SecVector {generationId:$generation,filingId:$filing,kind:'chunk'}) WHERE v.chunkId=$chunk OR v.chunkId IS NULL RETURN v{.id,.kind,.text,.filingId,.generationId,.metadata,.toolkitId,.chunkId} AS v",
        generation=node["generationId"],
        filing=node["filingId"],
        chunk=chunk_id,
    )
    result = []
    for row in rows:
        chunk = row["v"]
        if (
            chunk["generationId"] != node["generationId"]
            or chunk["filingId"] != node["filingId"]
        ):
            continue
        actual_id = chunk.get("chunkId") or json.loads(chunk.get("metadata", "{}")).get(
            "chunk", {}
        ).get("chunkId")
        if actual_id == chunk_id:
            result.append(
                {
                    "id": chunk["id"],
                    "filingId": chunk["filingId"],
                    "generationId": chunk["generationId"],
                    "text": chunk["text"],
                }
            )
    return result


def scoped_candidates(request, store, generations, vector):
    """Expand native ANN candidates; exact scoped fallback avoids starvation.

    Neo4j 5.26 applies the scope after ANN retrieval. Small corpora and narrow
    scopes therefore need an exact fallback rather than silently dropping hits.
    """
    for multiplier in (4, 16, 64):
        try:
            rows = store.query(
                "CALL db.index.vector.queryNodes('sec_evidence_embedding',$candidates,$vector) YIELD node,score WITH node AS n,score WHERE n.generationId IN $gens AND n.filingId IN $filings RETURN n{.id,.kind,.text,.filingId,.generationId,.metadata,.toolkitId,.chunkId} AS node,score ORDER BY score DESC",
                candidates=min(request.topK * multiplier, 3200),
                vector=vector,
                gens=generations,
                filings=request.filingIds,
            )
        except Neo4jError:
            break  # Index unavailable/offline: authoritative scoped query below.
        valid = []
        counts = {"chunk": 0, "statement": 0}
        for row in rows:
            node = row["node"]
            if (
                node.get("generationId") not in generations
                or node.get("filingId") not in request.filingIds
                or node.get("kind") not in counts
            ):
                continue
            metadata = json.loads(node.get("metadata", "{}"))
            item = metadata.get("source", {}).get("metadata", {}).get(
                "itemCode"
            ) or metadata.get("itemCode")
            if request.itemCodes and item not in request.itemCodes:
                continue
            valid.append(row)
            counts[node["kind"]] += 1
        if all(count >= request.topK for count in counts.values()):
            return valid
    return store.query(
        "MATCH (n:SecVector) WHERE n.generationId IN $gens AND n.filingId IN $filings RETURN n{.id,.kind,.text,.filingId,.generationId,.metadata,.toolkitId,.chunkId} AS node, vector.similarity.cosine(n.embedding,$vector) AS score ORDER BY score DESC",
        gens=generations,
        filings=request.filingIds,
        vector=vector,
    )
