"""Immutable generations; publication is the only mutable visibility pointer."""

import json
import uuid

from neo4j import GraphDatabase

from settings import AppSettings, get_settings


class RunAlreadyExecuting(RuntimeError):
    pass


class GraphStore:
    def __init__(
        self, settings: AppSettings | None = None, database: str | None = None
    ):
        s = settings or get_settings()
        self.profile = s.env_profile
        self.driver = GraphDatabase.driver(
            s.neo4j_uri, auth=(s.neo4j_user, s.neo4j_password)
        )
        self.database = database or s.neo4j_database

    def close(self):
        self.driver.close()

    def query(self, cypher, **params):
        with self.driver.session(database=self.database) as session:
            return session.run(cypher, **params).data()

    def initialize(self, *, allow_migration: bool = False):
        if not allow_migration and self.profile not in (None, "local"):
            names = {
                r["name"] for r in self.query("SHOW CONSTRAINTS YIELD name RETURN name")
            }
            required = {
                f"{label.lower()}_id"
                for label in (
                    "SecGeneration",
                    "SecRecord",
                    "SecPublication",
                    "SecRun",
                    "SecVector",
                )
            }
            if not required.issubset(names):
                raise ValueError(
                    "SEC modeling schema migration required; DDL is local-only"
                )
            self.validate_indexes()
            return
        for label in (
            "SecGeneration",
            "SecRecord",
            "SecPublication",
            "SecRun",
            "SecVector",
        ):
            self.query(
                f"CREATE CONSTRAINT {label.lower()}_id IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS UNIQUE"
            )
        self.query(
            "CREATE INDEX sec_record_generation IF NOT EXISTS FOR (n:SecRecord) ON (n.generationId)"
        )
        self.query(
            "CREATE INDEX sec_embedding_cache IF NOT EXISTS FOR (n:SecVector) ON (n.embeddingCacheKey)"
        )
        self.query(
            "CREATE VECTOR INDEX sec_evidence_embedding IF NOT EXISTS FOR (n:SecVector) ON n.embedding OPTIONS {indexConfig: {`vector.dimensions`: 1536, `vector.similarity_function`: 'cosine'}}"
        )

        for name in ("sec_evidence_embedding", "sec_embedding_cache", "sec_record_generation"):
            self.query("CALL db.awaitIndex($name, 30)", name=name)
        self.validate_indexes()

    def validate_indexes(self):
        rows = self.query(
            "SHOW INDEXES YIELD name,type,state,options WHERE name IN $names RETURN name,type,state,options",
            names=["sec_evidence_embedding", "sec_embedding_cache"],
        )
        indexes = {row["name"]: row for row in rows}
        vector = indexes.get("sec_evidence_embedding", {})
        config = vector.get("options", {}).get("indexConfig", {})
        if (
            vector.get("type") != "VECTOR"
            or vector.get("state") != "ONLINE"
            or config.get("vector.dimensions") != 1536
            or str(config.get("vector.similarity_function", "")).lower() != "cosine"
        ):
            raise ValueError(
                "SEC vector index must be ONLINE with 1536 dimensions and cosine; explicit schema migration required"
            )
        if indexes.get("sec_embedding_cache", {}).get("state") != "ONLINE":
            raise ValueError("SEC embedding cache index is missing or offline")

    def run_state(self, run_id):
        rows = self.query("MATCH (r:SecRun {id:$id}) RETURN r", id=run_id)
        if not rows:
            return {"status": "UNKNOWN"}
        state = dict(rows[0]["r"])
        if "counts" in state:
            state["counts"] = json.loads(state["counts"])
        return state

    def set_run(self, run_id, **props):
        props = {
            k: json.dumps(v) if isinstance(v, dict) else v for k, v in props.items()
        }
        self.query("MERGE (r:SecRun {id:$id}) SET r += $props", id=run_id, props=props)

    def claim(self, run_id, token):
        nonce = uuid.uuid4().hex
        rows = self.query(
            "MERGE (r:SecRun {id:$id}) ON CREATE SET r.executionToken=$token,r.status='RUNNING',r.claimNonce=$nonce SET r.lock=coalesce(r.lock,0)+1 RETURN r.executionToken AS token,r.status AS status,r.claimNonce AS nonce",
            id=run_id,
            token=token,
            nonce=nonce,
        )
        state = rows[0]
        if state["token"] != token or state["status"] not in ("RUNNING", "SUCCEEDED"):
            raise InterruptedError("Execution token is fenced or cancelled")
        if state["status"] == "RUNNING" and state["nonce"] != nonce:
            raise RunAlreadyExecuting(
                "Run is already executing; reconcile or cancel before retry"
            )
        return state["status"]

    def cancel(self, run_id, token):
        rows = self.query(
            "MERGE (r:SecRun {id:$id}) ON CREATE SET r.executionToken=$token,r.status='CANCELLED' SET r.lock=coalesce(r.lock,0)+1 WITH r WHERE r.executionToken=$token AND r.status='RUNNING' SET r.status='CANCELLED' RETURN r.status AS status",
            id=run_id,
            token=token,
        )
        return rows

    def finish_failed(self, run_id, token, status, code):
        self.query(
            "MATCH (r:SecRun {id:$id}) WHERE r.executionToken=$token AND r.status='RUNNING' SET r.status=$status,r.errorCode=$code",
            id=run_id,
            token=token,
            status=status,
            code=code,
        )

    def active(self, filing_id, stage):
        rows = self.query(
            "MATCH (p:SecPublication {id:$id})-[:ACTIVE]->(g:SecGeneration) RETURN g",
            id=f"{filing_id}:{stage}",
        )
        return dict(rows[0]["g"]) if rows else None

    def active_many(self, filings):
        """Read page publications in one indexed query; never scan all generations."""
        identities = [f"filing:{f['cik']}:{f['accessionNo']}" for f in filings]
        publications = [f"{identity}:{stage}" for identity in identities for stage in (1, 2, 3)]
        rows = self.query(
            "MATCH (p:SecPublication)-[:ACTIVE]->(g:SecGeneration) WHERE p.id IN $ids RETURN p.id AS publicationId,g",
            ids=publications,
        )
        result = {identity: {} for identity in identities}
        for row in rows:
            identity, stage = row["publicationId"].rsplit(":", 1)
            generation = dict(row["g"])
            result[identity][stage] = {**generation, "generationId": generation["id"]}
        return [{**filing, "stages": result[identity]} for filing, identity in zip(filings, identities, strict=True)]

    def save_records(self, generation, filing_id, stage, records):
        for offset in range(0, len(records), 100):
            batch = []
            for record in records[offset : offset + 100]:
                batch.append(
                    {
                        "id": record["id"],
                        "type": record["type"],
                        "generationId": generation,
                        "filingId": filing_id,
                        "stage": stage,
                        "data": json.dumps(
                            {
                                **record,
                                "generationId": generation,
                                "filingId": filing_id,
                            },
                            ensure_ascii=False,
                        ),
                    }
                )
            self.query(
                "UNWIND $rows AS row MERGE (n:SecRecord {id:row.id}) SET n += row",
                rows=batch,
            )

    def records(self, generation, kind=None):
        rows = self.query(
            "MATCH (r:SecRecord {generationId:$g}) WHERE $kind IS NULL OR r.type=$kind RETURN r.data AS data ORDER BY r.id",
            g=generation,
            kind=kind,
        )
        return [json.loads(r["data"]) for r in rows]

    def publish(self, request, stage, generation, counts, config_hash):
        # Serializes publication; verifies model-2 still references the active model-1.
        with self.driver.session(database=self.database) as session:

            def commit(tx):
                pid = f"{request.filing_id}:{stage}"
                run = tx.run(
                    "MATCH (r:SecRun {id:$id}) SET r.lock=coalesce(r.lock,0)+1 RETURN r.status AS status,r.executionToken AS token",
                    id=request.runId,
                ).single()
                if (
                    not run
                    or run["status"] != "RUNNING"
                    or run["token"] != request.executionToken
                ):
                    raise InterruptedError(
                        "Publication fenced by cancellation or newer execution"
                    )
                tx.run(
                    "MERGE (dependency:SecPublication {id:$id}) SET dependency.lock=coalesce(dependency.lock,0)+1",
                    id=f"{request.filing_id}:1",
                ).consume()
                tx.run(
                    "MERGE (p:SecPublication {id:$pid}) SET p.lock=coalesce(p.lock,0)+1",
                    pid=pid,
                ).consume()
                if stage == 2:
                    row = tx.run(
                        "MATCH (p:SecPublication {id:$id})-[:ACTIVE]->(g) RETURN g.id AS id",
                        id=f"{request.filing_id}:1",
                    ).single()
                    if not row or row["id"] != request.inputGenerationId:
                        raise ValueError(
                            "Model 1 changed during extraction; model 2 cannot publish"
                        )
                tx.run(
                    "MERGE (g:SecGeneration {id:$id}) SET g += $props",
                    id=generation,
                    props={
                        "filingId": request.filing_id,
                        "stage": stage,
                        "sourceHash": request.sourceHash or "",
                        "inputGenerationId": request.inputGenerationId or "",
                        "configHash": config_hash,
                        "runId": request.runId,
                        "counts": json.dumps(counts),
                    },
                ).consume()
                tx.run(
                    "MATCH (p:SecPublication {id:$pid}) OPTIONAL MATCH (p)-[old:ACTIVE]->() DELETE old WITH p MATCH (g:SecGeneration {id:$id}) MERGE (p)-[:ACTIVE]->(g)",
                    pid=pid,
                    id=generation,
                ).consume()
                tx.run(
                    'MERGE (r:SecRun {id:$id}) SET r.status="SUCCEEDED", r.generationId=$g, r.counts=$counts',
                    id=request.runId,
                    g=generation,
                    counts=json.dumps(counts),
                ).consume()

            session.execute_write(commit)
