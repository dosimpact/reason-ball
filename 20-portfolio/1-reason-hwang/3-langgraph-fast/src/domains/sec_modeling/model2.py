"""Pinned toolkit extraction/build with SEC structural chunks and isolated tenants."""

import hashlib
import os
import time
from pathlib import Path

from domains.sec_modeling.chunking import chunk_html
from domains.sec_modeling.embedding import embedding_credentials


def build_lexical(request, generation, store, progress, cancelled):
    from graphrag_toolkit.lexical_graph import GraphRAGConfig, TenantId
    from graphrag_toolkit.lexical_graph.lexical_graph_index import (
        ExtractionConfig,
        IndexingConfig,
        LexicalGraphIndex,
    )
    from graphrag_toolkit.lexical_graph.storage.graph.neo4j_graph_store import (
        Neo4jDatabaseClient,
    )
    from graphrag_toolkit.lexical_graph.storage.vector.vector_store import VectorStore
    from llama_index.core.schema import (
        Document,
        NodeRelationship,
        RelatedNodeInfo,
        TextNode,
    )
    from llama_index.embeddings.openai import OpenAIEmbedding

    from domains.sec_modeling.llm import OAuthExtractionLLM, extraction_api_key
    from domains.sec_modeling.vector import Neo4jVectorIndex
    from settings import get_settings

    active = store.active(request.filing_id, 1)
    if not active or active["id"] != request.inputGenerationId:
        raise ValueError("inputGenerationId must identify active model 1")
    if request.sourceHash and request.sourceHash != active.get("sourceHash"):
        raise ValueError("Input generation sourceHash mismatch")
    request.sourceHash = active.get("sourceHash")
    key, base = embedding_credentials()
    GraphRAGConfig.extraction_llm = OAuthExtractionLLM(
        model=request.extractionModel,
        api_base=os.getenv(
            "SEC_EXTRACTION_BASE_URL",
            os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:2890/v1"),
        ),
        api_key=extraction_api_key(),
        is_chat_model=True,
        is_function_calling_model=False,
        context_window=128000,
        max_tokens=12000,
        max_retries=1,
        timeout=180,
    )
    GraphRAGConfig.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small", api_key=key, api_base=base, dimensions=1536
    )
    GraphRAGConfig.enable_cache = True
    GraphRAGConfig.extraction_num_workers = 1
    GraphRAGConfig.extraction_batch_size = 32
    GraphRAGConfig.extraction_num_threads_per_worker = 8
    GraphRAGConfig.build_num_workers = 1
    GraphRAGConfig.build_batch_size = 16
    GraphRAGConfig.build_batch_write_size = 128
    from graphrag_toolkit.lexical_graph.indexing.prompts import (
        EXTRACT_PROPOSITIONS_PROMPT,
        EXTRACT_TOPICS_PROMPT,
    )

    limits = "\nSEC extraction priority: Preserve negation, uncertainty, dates, units, and exact numbers. Select at most 20 material, independently understandable statements per chunk; do not split each modifier into another statement or repeat entity classification statements. All original chunk text is separately retained. Do not invent facts.\n"
    extraction = ExtractionConfig(
        extract_propositions_prompt_template=EXTRACT_PROPOSITIONS_PROMPT + limits,
        extract_topics_prompt_template=EXTRACT_TOPICS_PROMPT + limits,
    )
    tenant = TenantId(hashlib.sha256(generation.encode()).hexdigest()[:24])
    s = get_settings()
    graph = Neo4jDatabaseClient(
        endpoint_url=s.neo4j_uri,
        database=s.neo4j_database,
        username=s.neo4j_user,
        password=s.neo4j_password,
    )
    indexes = {
        name: Neo4jVectorIndex(
            index_name=name, generation_id=generation, filing_id=request.filing_id
        )
        for name in ("chunk", "statement")
    }
    index = LexicalGraphIndex(
        graph_store=graph,
        vector_store=VectorStore(
            indexes={name: adapter for name, adapter in indexes.items()}
        ),
        tenant_id=tenant,
        indexing_config=IndexingConfig(chunking=None, extraction=extraction),
        extraction_dir=str(Path(".tmp/sec-modeling") / generation),
    )
    counts = {}
    items = store.records(request.inputGenerationId, "Item")
    expected_chunks = sum(len(chunk_html(item["displayHtml"])) for item in items)
    try:
        for item in items:
            if cancelled():
                raise InterruptedError("Execution cancelled")
            metadata = {
                "itemId": item["id"],
                "filingId": request.filing_id,
                "itemCode": item["itemCode"],
                "inputGenerationId": request.inputGenerationId,
                "contentHash": item["contentHash"],
            }
            doc = Document(text=item["text"], metadata=metadata, id_=item["id"])
            nodes = [
                TextNode(
                    text=text,
                    metadata={
                        **metadata,
                        "chunkOrder": ordinal,
                        "chunkContentHash": hashlib.sha256(text.encode()).hexdigest(),
                    },
                    relationships={
                        NodeRelationship.SOURCE: RelatedNodeInfo(
                            node_id=doc.id_, metadata=metadata
                        )
                    },
                )
                for ordinal, text in enumerate(chunk_html(item["displayHtml"]))
            ]
            started = time.monotonic()
            for ordinal, node in enumerate(nodes):
                progress(workUnitId=f"{item['id']}:chunk:{ordinal}", status="RUNNING")
            index.extract_and_build(list(nodes), show_progress=False)
            for ordinal, node in enumerate(nodes):
                progress(workUnitId=f"{item['id']}:chunk:{ordinal}", status="SUCCEEDED")
            progress(
                workUnitId=item["id"],
                status="SUCCEEDED",
                message=f"Item {item['itemCode']} extracted in {time.monotonic() - started:.1f}s",
            )
        source_label = tenant.format_label("__Source__")
        store.query(
            f"MATCH (s:{source_label}) MATCH (i:Item {{id:s.itemId}}) MERGE (i)-[:HAS_SOURCE]->(s)"
        )
        records = []
        for kind in ("Source", "Chunk", "Topic", "Statement", "Fact", "Entity"):
            label = tenant.format_label(f"__{kind}__")
            rows = store.query(f"MATCH (n:{label}) RETURN properties(n) AS props")
            counts[kind] = len(rows)
            for row in rows:
                props = row["props"]
                rid = (
                    props.get(kind.lower() + "Id")
                    or hashlib.sha256(str(sorted(props.items())).encode()).hexdigest()
                )
                records.append(
                    {
                        "id": f"{generation}:{kind}:{rid}",
                        "type": kind,
                        **props,
                        "filingId": request.filing_id,
                        "generationId": generation,
                    }
                )
        if any(counts[k] == 0 for k in counts):
            raise ValueError(f"Lexical graph incomplete: {counts}")
        if counts["Source"] != len(items) or counts["Chunk"] != expected_chunks:
            raise ValueError(
                f"Incomplete lexical coverage: expected {len(items)} Sources/{expected_chunks} Chunks, got {counts}"
            )
        bindings = store.query(
            f"MATCH (i:Item)-[:HAS_SOURCE]->(s:{source_label}) RETURN count(DISTINCT s) AS n"
        )[0]["n"]
        if bindings != len(items):
            raise ValueError("Missing Item to Source binding")
        statement_label = tenant.format_label("__Statement__")
        chunk_label = tenant.format_label("__Chunk__")
        missing = store.query(
            f"MATCH (s:{statement_label}) WHERE NOT (s)-[:__MENTIONED_IN__]->(:{chunk_label}) RETURN count(s) AS n"
        )[0]["n"]
        if missing:
            raise ValueError("Statements without supporting chunks")
        embedded = {
            row["kind"]: row["n"]
            for row in store.query(
                "MATCH (v:SecVector {generationId:$g}) RETURN v.kind AS kind,count(v) AS n",
                g=generation,
            )
        }
        if (
            embedded.get("chunk", 0) != counts["Chunk"]
            or embedded.get("statement", 0) != counts["Statement"]
        ):
            raise ValueError("Missing Chunk/Statement embeddings")
        store.save_records(generation, request.filing_id, 2, records)
        return counts
    finally:
        graph.client.close()
        for adapter in indexes.values():
            adapter.close()
