"""GraphRAG Toolkit VectorIndex adapter backed by native Neo4j vectors."""

import hashlib
import json
from typing import Any

from graphrag_toolkit.lexical_graph.storage.vector.vector_index import VectorIndex
from pydantic import PrivateAttr

from domains.sec_modeling.embedding import embed
from domains.sec_modeling.store import GraphStore


class Neo4jVectorIndex(VectorIndex):
    generation_id: str
    filing_id: str
    _store: Any = PrivateAttr(default=None)

    @property
    def store(self):
        if self._store is None:
            self._store = GraphStore()
        return self._store

    def add_embeddings(self, nodes):
        if not nodes:
            return nodes
        texts = [n.get_content() for n in nodes]
        keys = [
            hashlib.sha256(
                ("text-embedding-3-small:1536:sec-input/1:" + text).encode()
            ).hexdigest()
            for text in texts
        ]
        cached = self.store.query(
            "MATCH (v:SecVector) WHERE v.embeddingCacheKey IN $keys AND v.embeddingModel=$model AND size(v.embedding)=1536 RETURN v.embeddingCacheKey AS key,v.embedding AS vector",
            keys=keys,
            model="text-embedding-3-small",
        )
        cache = {row["key"]: row["vector"] for row in cached}
        missing = {key: text for key, text in zip(keys, texts) if key not in cache}
        if missing:
            cache.update(zip(missing, embed(list(missing.values()))))
        vectors = [cache[key] for key in keys]
        rows = []
        for node, text, vector, cache_key in zip(nodes, texts, vectors, keys):
            rows.append(
                {
                    "id": f"{self.generation_id}:{self.index_name}:{node.node_id}",
                    "toolkitId": node.node_id,
                    "generationId": self.generation_id,
                    "filingId": self.filing_id,
                    "kind": self.index_name,
                    "chunkId": node.metadata.get(
                        "chunk", node.metadata.get("statement", {})
                    ).get("chunkId", ""),
                    "text": text,
                    "metadata": json.dumps(node.metadata),
                    "embedding": vector,
                    "embeddingCacheKey": cache_key,
                    "embeddingModel": "text-embedding-3-small",
                    "embeddingDimensions": 1536,
                    "embeddingInputVersion": "sec-input/1",
                }
            )
        self.store.query(
            "UNWIND $rows AS row MERGE (n:SecVector {id:row.id}) SET n += row",
            rows=rows,
        )
        return nodes

    def top_k(self, query_bundle, top_k=5, filter_config=None):
        if filter_config is not None:
            raise ValueError("Use SEC scoped search for metadata filtering")
        vector = query_bundle.embedding or embed([query_bundle.query_str])[0]
        return self.store.query(
            "MATCH (n:SecVector {generationId:$g,kind:$kind}) RETURN n.toolkitId AS id, n.text AS text, vector.similarity.cosine(n.embedding,$v) AS score ORDER BY score DESC LIMIT $k",
            g=self.generation_id,
            kind=self.index_name,
            v=vector,
            k=top_k,
        )

    def get_embeddings(self, ids=None):
        return self.store.query(
            "MATCH (n:SecVector {generationId:$g,kind:$kind}) WHERE n.toolkitId IN $ids RETURN n.toolkitId AS id,n.embedding AS embedding,n.text AS text",
            g=self.generation_id,
            kind=self.index_name,
            ids=ids or [],
        )

    def update_versioning(self, versioning_timestamp, ids=None):
        self.store.query(
            "MATCH (n:SecVector {generationId:$g}) WHERE n.toolkitId IN $ids SET n.versionTimestamp=$t",
            g=self.generation_id,
            ids=ids or [],
            t=versioning_timestamp,
        )
        return ids or []

    def enable_for_versioning(self, ids=None):
        return self.update_versioning(0, ids)

    def delete_embeddings(self, ids=None):
        self.store.query(
            "MATCH (n:SecVector {generationId:$g,kind:$kind}) WHERE n.toolkitId IN $ids DELETE n",
            g=self.generation_id,
            kind=self.index_name,
            ids=ids or [],
        )

    def close(self):
        if self._store:
            self._store.close()
