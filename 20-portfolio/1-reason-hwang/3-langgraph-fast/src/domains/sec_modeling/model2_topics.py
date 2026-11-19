"""Validate Toolkit extraction and deterministically regroup it using Decisions."""

import copy
import hashlib
import itertools
import json
import math
import time
from collections import Counter
from pathlib import Path

import httpx
from llama_index.core.schema import TransformComponent

from domains.sec_modeling.decisions_client import (
    decisions_http_client,
    probability,
    request_decisions,
)
from domains.sec_modeling.model2_policy import (
    DECISION_INSTRUCTIONS,
    DECISIONS_MODEL,
    ENTITY_CLASSES,
    TOPICS,
    extraction_policy_hash,
    runtime_policy_hash,
)


def validate_topic_answers(raw, count):
    if not isinstance(raw, dict) or raw.get("model") != DECISIONS_MODEL:
        raise ValueError("Invalid topic Decisions model")
    answers = raw.get("answers")
    if not isinstance(answers, list):
        raise ValueError("Missing topic Decisions answers")  # noqa: TRY004
    result = {}
    for answer in answers:
        name = answer.get("name") if isinstance(answer, dict) else None
        if name not in {f"p{i}" for i in range(count)} or name in result:
            raise ValueError("Unknown or duplicate topic decision")
        if answer.get("type") != "choice" or answer.get("choice") not in TOPICS:
            raise ValueError("Topic decision must be an allowed choice")
        probability(answer.get("confidence"))
        values = answer.get("probabilities")
        if not isinstance(values, list) or len(values) != len(TOPICS):
            raise ValueError("Topic decision requires eight probabilities")
        distribution = {}
        for entry in values:
            if (
                not isinstance(entry, dict)
                or entry.get("value") not in TOPICS
                or entry["value"] in distribution
            ):
                raise ValueError("Invalid topic probability keys")
            distribution[entry["value"]] = probability(entry.get("probability"))
        if not math.isclose(sum(distribution.values()), 1, abs_tol=0.001):
            raise ValueError("Topic probabilities must sum to one")
        result[name] = distribution
    if len(result) != count:
        raise ValueError("Every proposition needs one topic decision")
    return [result[f"p{i}"] for i in range(count)]


def select_topics(distributions):
    candidates = itertools.chain(
        itertools.combinations(TOPICS, 1), itertools.combinations(TOPICS, 2)
    )
    # Iteration order resolves exact ties by fewer topics, then canonical order.
    return max(
        candidates,
        key=lambda topics: sum(max(row[t] for t in topics) for row in distributions),
    )


def validate_extraction(collection, propositions):
    topics = collection.get("topics", [])
    statements = []
    normal = lambda value: value.strip().rstrip(".")
    for topic in topics:
        if topic.get("value") not in TOPICS:
            raise ValueError("Unknown extracted canonical topic")
        for entity in topic.get("entities", []):
            if entity.get("classification") not in ENTITY_CLASSES:
                raise ValueError("Unknown extracted SEC entity class")
        for statement in topic.get("statements", []):
            if not statement.get("value", "").strip():
                details = statement.get("details", [])
                if len(details) != 1 or normal(details[0]) not in {
                    normal(p) for p in propositions
                }:
                    raise ValueError("Invalid fact-free proposition")
                statement["value"] = details[0]
            for fact in statement.get("facts", []):
                for key in ("subject", "object", "complement"):
                    endpoint = fact.get(key)
                    if (
                        isinstance(endpoint, dict)
                        and endpoint.get("classification") not in ENTITY_CLASSES
                        and not (
                            key == "complement"
                            and endpoint.get("classification") == "__Local_Entity__"
                        )
                    ):
                        raise ValueError("Unknown fact endpoint SEC entity class")
            statements.append(statement)
    if Counter(map(normal, propositions)) != Counter(
        normal(st["value"]) for st in statements
    ):
        raise ValueError(
            "Extracted statements must preserve every proposition exactly once"
        )
    return statements


def reconstruct_statements(collection, propositions):
    """Restore parser-stripped colons and exact split fragments, never missing prose."""
    result = copy.deepcopy(collection)
    canonical = [value.strip().rstrip(".").replace(":", "") for value in propositions]
    matches = {i: [] for i in range(len(propositions))}
    for topic in result.get("topics", []):
        for statement in topic.get("statements", []):
            value = statement.get("value", "")
            if not value and len(statement.get("details", [])) == 1:
                value = statement["details"][0]
            fragment = value.strip().rstrip(".").replace(":", "")
            candidates = [
                i
                for i, original in enumerate(canonical)
                if fragment and fragment in original
            ]
            if len(candidates) != 1:
                raise ValueError("Cannot reconstruct proposition unambiguously")
            i = candidates[0]
            start = canonical[i].find(fragment)
            matches[i].append((start, start + len(fragment), topic, statement))
    for i, fragments in matches.items():
        cursor = 0
        for start, end, _, _ in sorted(fragments, key=lambda entry: entry[0]):
            if start < cursor or canonical[i][cursor:start].strip(" .\t\n"):
                raise ValueError(
                    "Cannot reconstruct missing or duplicate proposition content"
                )
            cursor = end
        if not fragments or canonical[i][cursor:].strip(" .\t\n"):
            raise ValueError("Cannot reconstruct missing proposition content")
    for topic in result.get("topics", []):
        topic["statements"] = []
    for i, fragments in matches.items():
        ordered = sorted(fragments, key=lambda entry: entry[0])
        statement = copy.deepcopy(ordered[0][3])
        statement["value"] = propositions[i]
        statement["facts"] = [
            fact for _, _, _, fragment in ordered for fact in fragment.get("facts", [])
        ]
        statement["details"] = [
            detail
            for _, _, _, fragment in ordered
            for detail in fragment.get("details", [])
        ]
        ordered[0][2]["statements"].append(statement)
    validate_extraction(result, propositions)
    return result


def validated_collection(collection, propositions):
    # Legacy prompts placed this exact application-owned marker below Statements.
    # Remove only a fact-free marker absent from the actual proposition inputs.
    marker = "Policy " + extraction_policy_hash()
    collection = copy.deepcopy(collection)
    for topic in collection.get("topics", []):
        retained = []
        for statement in topic.get("statements", []):
            value = statement.get("value", "").replace(":", "").strip()
            details = statement.get("details", [])
            own_marker = (
                value == marker
                and statement.get("value") not in propositions
                and not statement.get("facts")
                and all(detail.replace(":", "").strip() == marker for detail in details)
            )
            if not own_marker:
                retained.append(statement)
        topic["statements"] = retained
    try:
        validate_extraction(collection, propositions)
        return collection
    except ValueError:
        return reconstruct_statements(collection, propositions)


def retry_topic_extraction(propositions):
    """One uncached repair extraction, then strict validation must succeed."""
    from graphrag_toolkit.lexical_graph import GraphRAGConfig
    from graphrag_toolkit.lexical_graph.indexing.extract.topic_extractor import (
        parse_extracted_topics,
    )
    from llama_index.core import PromptTemplate

    from domains.sec_modeling.model2_policy import TOPICS_PROMPT

    prompt = (
        "Strict repair: output each input proposition EXACTLY ONCE, preserving all its sentences together. Never split, paraphrase, or omit text.\n"
        + TOPICS_PROMPT
    )
    raw = GraphRAGConfig.extraction_llm.predict(
        PromptTemplate(prompt), text="\n".join(propositions)
    )
    parsed, _ = parse_extracted_topics(raw)
    return validated_collection(parsed.model_dump(), propositions)


def classify_propositions(propositions, context=None):
    context = context or {}
    cache_key = hashlib.sha256(
        json.dumps(
            [runtime_policy_hash(), context, propositions], sort_keys=True
        ).encode()
    ).hexdigest()
    cache_path = Path(".tmp/sec-modeling/topic-decision-cache") / (cache_key + ".json")
    if cache_path.is_file():
        cached = json.loads(cache_path.read_text())
        return validate_topic_answers(cached, len(propositions))
    distributions = []
    with decisions_http_client() as client:
        for offset in range(0, len(propositions), 100):
            batch = propositions[offset : offset + 100]
            body = {
                "model": DECISIONS_MODEL,
                "input": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_json",
                                "data": {
                                    "context": context,
                                    "propositions": {
                                        f"p{i}": value for i, value in enumerate(batch)
                                    },
                                },
                            }
                        ],
                    }
                ],
                "questions": [
                    {
                        "type": "choice",
                        "name": f"p{i}",
                        "instructions": DECISION_INSTRUCTIONS
                        + f"\nClassify input p{i}.",
                        "choices": [
                            {"value": topic, "description": topic} for topic in TOPICS
                        ],
                    }
                    for i in range(len(batch))
                ],
            }
            for attempt in range(3):
                try:
                    raw = request_decisions(client, body)
                    break
                except (httpx.TransportError, ValueError) as error:
                    transient = isinstance(error, httpx.TransportError) or str(
                        error
                    ).rsplit(" ", 1)[-1] in {"408", "429", "500", "502", "503", "504"}
                    if not transient or attempt == 2:
                        raise
                    time.sleep(0.5 * (2**attempt))
            distributions.extend(validate_topic_answers(raw, len(batch)))
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cached = {
        "model": DECISIONS_MODEL,
        "answers": [
            {
                "name": f"p{i}",
                "type": "choice",
                "choice": max(row, key=row.get),
                "confidence": max(row.values()),
                "probabilities": [
                    {"value": topic, "probability": row[topic]} for topic in TOPICS
                ],
            }
            for i, row in enumerate(distributions)
        ],
    }
    cache_path.write_text(json.dumps(cached))
    return distributions


def regroup_topics(collection, propositions, distributions):
    result = copy.deepcopy(collection)
    statements = validate_extraction(result, propositions)
    if len(distributions) != len(propositions):
        raise ValueError("Topic distribution coverage mismatch")
    by_text = {
        value.strip().rstrip("."): row
        for value, row in zip(propositions, distributions)
    }
    if not propositions:
        result["topics"] = []
        return result
    selected = select_topics(distributions)
    # Reuse exact entity definitions for facts reassigned across original topics.
    entities = {
        (entity["value"], entity.get("classification")): entity
        for topic in result["topics"]
        for entity in topic.get("entities", [])
    }
    grouped = {topic: [] for topic in selected}
    for statement in statements:
        row = by_text[statement["value"].strip().rstrip(".")]
        topic = max(selected, key=lambda candidate: row[candidate])
        grouped[topic].append(statement)

    def connected_entities(values):
        names = {
            endpoint["value"]
            for statement in values
            for fact in statement.get("facts", [])
            for key in ("subject", "object", "complement")
            if isinstance((endpoint := fact.get(key)), dict)
        }
        return [entity for entity in entities.values() if entity["value"] in names]

    result["topics"] = [
        {"value": topic, "entities": connected_entities(values), "statements": values}
        for topic, values in grouped.items()
        if values
    ]
    validate_extraction(result, propositions)
    return result


class DecisionsTopicReclassifier(TransformComponent):
    """Runs after Toolkit extractors and before its build pipeline."""

    evidence_dir: str = ""
    tenant_id_value: str = ""

    def __call__(self, nodes, **kwargs):
        from graphrag_toolkit.lexical_graph import TenantId
        from graphrag_toolkit.lexical_graph.indexing import IdGenerator
        from graphrag_toolkit.lexical_graph.indexing.constants import (
            PROPOSITIONS_KEY,
            TOPICS_KEY,
        )

        id_generator = IdGenerator(tenant_id=TenantId(self.tenant_id_value or None))
        for node in nodes:
            final_chunk_id = (
                id_generator.rewrite_id_for_tenant(node.node_id)
                if self.tenant_id_value
                else node.node_id
            )
            propositions = node.metadata.get(PROPOSITIONS_KEY, [])
            collection = node.metadata.get(TOPICS_KEY, {})
            try:
                collection = validated_collection(collection, propositions)
            except ValueError:
                collection = retry_topic_extraction(propositions)
            context = {
                "chunk": node.text,
                "source": {
                    key: node.metadata.get(key)
                    for key in ("itemId", "filingId", "itemCode", "contentHash")
                },
            }
            distributions = classify_propositions(propositions, context)
            node.metadata[TOPICS_KEY] = regroup_topics(
                collection, propositions, distributions
            )
            node.metadata["secTopicDecisionPolicyHash"] = runtime_policy_hash()
            selected_topics = tuple(
                topic["value"] for topic in node.metadata[TOPICS_KEY]["topics"]
            )
            assignments = []
            for proposition, row in zip(propositions, distributions):
                chosen = max(selected_topics, key=lambda topic: row[topic])
                assignments.append(
                    {
                        "proposition": proposition,
                        "topic": chosen,
                        "confidence": row[chosen],
                    }
                )
            node.metadata["secTopicDecisions"] = {
                "model": DECISIONS_MODEL,
                "policyHash": runtime_policy_hash(),
                "chunkId": final_chunk_id,
                "selectedTopics": list(selected_topics),
                "assignments": assignments,
                "propositions": propositions,
                "probabilities": distributions,
            }
            if self.evidence_dir:
                directory = Path(self.evidence_dir)
                directory.mkdir(parents=True, exist_ok=True)
                content_hash = hashlib.sha256(final_chunk_id.encode()).hexdigest()
                (directory / (content_hash + ".json")).write_text(
                    json.dumps(node.metadata["secTopicDecisions"])
                )
            for key in ("secTopicDecisions", "secTopicDecisionPolicyHash"):
                if key not in node.excluded_embed_metadata_keys:
                    node.excluded_embed_metadata_keys.append(key)
                if key not in node.excluded_llm_metadata_keys:
                    node.excluded_llm_metadata_keys.append(key)
        return nodes

    async def acall(self, nodes, **kwargs):
        import asyncio

        return await asyncio.to_thread(self.__call__, nodes, **kwargs)
