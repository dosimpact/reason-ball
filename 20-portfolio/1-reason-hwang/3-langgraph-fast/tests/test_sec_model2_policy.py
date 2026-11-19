"""Regression checks for SEC Decisions regrouping and coverage invariants."""

import copy

import pytest

from domains.sec_modeling.model2_policy import (
    DECISIONS_MODEL,
    TOPICS,
    runtime_policy_hash,
)
from domains.sec_modeling.model2_topics import (
    regroup_topics,
    select_topics,
    validate_extraction,
    validate_topic_answers,
)


def distribution(index):
    return {topic: float(i == index) for i, topic in enumerate(TOPICS)}


def collection():
    return {
        "topics": [
            {
                "value": TOPICS[0],
                "entities": [],
                "statements": [
                    {"value": "Statement.", "details": ["Statement."], "facts": []}
                ],
            }
        ]
    }


def test_pair_selection_and_tie_order():
    assert select_topics([distribution(0), distribution(2)]) == (TOPICS[0], TOPICS[2])
    assert select_topics([{topic: 0.125 for topic in TOPICS}]) == (TOPICS[0],)


def test_regroup_keeps_fact_free_statement_without_mutating_input():
    original = collection()
    before = copy.deepcopy(original)
    result = regroup_topics(original, ["Statement."], [distribution(4)])
    assert result["topics"][0]["value"] == TOPICS[4]
    assert result["topics"][0]["statements"] == original["topics"][0]["statements"]
    assert original == before


def test_coverage_and_unknown_classes_fail_closed():
    with pytest.raises(ValueError, match="every proposition"):
        validate_extraction(collection(), ["Lost statement."])
    value = collection()
    value["topics"][0]["entities"] = [{"value": "thing", "classification": "Metric"}]
    with pytest.raises(ValueError, match="entity class"):
        validate_extraction(value, ["Statement."])


def test_fact_free_parser_repair():
    value = collection()
    value["topics"][0]["statements"][0]["value"] = ""
    assert validate_extraction(value, ["Statement."])[0]["value"] == "Statement."


def answer():
    return {
        "model": DECISIONS_MODEL,
        "answers": [
            {
                "name": "p0",
                "type": "choice",
                "choice": TOPICS[0],
                "confidence": 1.0,
                "probabilities": [
                    {"value": topic, "probability": value}
                    for topic, value in distribution(0).items()
                ],
            }
        ],
    }


def test_decisions_answer_requires_exact_coverage_and_probabilities():
    assert validate_topic_answers(answer(), 1) == [distribution(0)]
    value = answer()
    value["answers"].append(copy.deepcopy(value["answers"][0]))
    with pytest.raises(ValueError, match="duplicate"):
        validate_topic_answers(value, 1)
    value = answer()
    value["answers"][0]["probabilities"][0]["probability"] = float("nan")
    with pytest.raises(ValueError, match="probability"):
        validate_topic_answers(value, 1)
    with pytest.raises(ValueError, match="Every proposition"):
        validate_topic_answers({"model": DECISIONS_MODEL, "answers": []}, 1)


def test_policy_hash_is_stable_and_sha256():
    assert runtime_policy_hash() == runtime_policy_hash()
    assert len(runtime_policy_hash()) == 64


def test_decision_cache_includes_policy_and_context(tmp_path, monkeypatch):
    from contextlib import nullcontext

    from domains.sec_modeling import model2_topics

    monkeypatch.chdir(tmp_path)
    calls = []
    monkeypatch.setattr(
        model2_topics, "decisions_http_client", lambda: nullcontext(object())
    )

    def request(client, body):
        calls.append(body)
        return answer()

    monkeypatch.setattr(model2_topics, "request_decisions", request)
    model2_topics.classify_propositions(["Statement."], {"chunk": "first"})
    model2_topics.classify_propositions(["Statement."], {"chunk": "first"})
    assert len(calls) == 1
    model2_topics.classify_propositions(["Statement."], {"chunk": "second"})
    assert len(calls) == 2
    monkeypatch.setattr(model2_topics, "runtime_policy_hash", lambda: "changed-policy")
    model2_topics.classify_propositions(["Statement."], {"chunk": "first"})
    assert len(calls) == 3


def test_component_records_selected_topic_confidence(tmp_path, monkeypatch):
    from graphrag_toolkit.lexical_graph.indexing.constants import (
        PROPOSITIONS_KEY,
        TOPICS_KEY,
    )
    from llama_index.core.schema import TextNode

    from domains.sec_modeling import model2_topics

    monkeypatch.setattr(
        model2_topics,
        "classify_propositions",
        lambda propositions, context: [distribution(2)],
    )
    node = TextNode(
        text="Source",
        metadata={PROPOSITIONS_KEY: ["Statement."], TOPICS_KEY: collection()},
    )
    model2_topics.DecisionsTopicReclassifier(evidence_dir=str(tmp_path))([node])
    evidence = node.metadata["secTopicDecisions"]
    assert evidence["selectedTopics"] == [TOPICS[2]]
    assert evidence["assignments"] == [
        {"proposition": "Statement.", "topic": TOPICS[2], "confidence": 1.0}
    ]
    assert evidence["policyHash"] == runtime_policy_hash()
    assert len(list(tmp_path.glob("*.json"))) == 1


def test_reconstruction_merges_exact_fragments_and_preserves_facts():
    from domains.sec_modeling.model2_topics import reconstruct_statements

    value = collection()
    value["topics"][0]["statements"] = [
        {"value": "First part.", "facts": [], "details": ["First part."]},
        {"value": "Second part.", "facts": [], "details": ["Second part."]},
    ]
    fixed = reconstruct_statements(value, ["First part. Second part."])
    assert fixed["topics"][0]["statements"][0]["value"] == "First part. Second part."
    with pytest.raises(ValueError, match="missing"):
        reconstruct_statements(
            value, ["First part. Missing qualification. Second part."]
        )


def test_reconstruction_restores_only_parser_colon_loss():
    from domains.sec_modeling.model2_topics import reconstruct_statements

    value = collection()
    value["topics"][0]["statements"][0]["value"] = "See https//example.com."
    fixed = reconstruct_statements(value, ["See https://example.com."])
    assert fixed["topics"][0]["statements"][0]["value"] == "See https://example.com."


def test_legacy_application_marker_removed_only_when_fact_free_and_not_input():
    from domains.sec_modeling.model2_policy import extraction_policy_hash
    from domains.sec_modeling.model2_topics import validated_collection

    marker = "Policy " + extraction_policy_hash()
    value = collection()
    value["topics"][0]["statements"].append(
        {"value": marker, "facts": [], "details": [marker]}
    )
    fixed = validated_collection(value, ["Statement."])
    assert len(fixed["topics"][0]["statements"]) == 1
    # An actual supplied statement is never discarded as application metadata.
    fixed = validated_collection(value, ["Statement.", marker])
    assert len(fixed["topics"][0]["statements"]) == 2
    value["topics"][0]["statements"][-1]["value"] = "Policy changed by issuer"
    with pytest.raises(ValueError):
        validated_collection(value, ["Statement."])


def test_legacy_cache_reuses_only_identical_semantic_prompt(tmp_path, monkeypatch):
    import hashlib

    from llama_index.core import PromptTemplate
    from llama_index.core.llms import MockLLM

    from domains.sec_modeling.model2_cache import LegacyValidatedPromptCache
    from domains.sec_modeling.model2_policy import TOPICS_PROMPT, extraction_policy_hash

    monkeypatch.chdir(tmp_path)
    llm = MockLLM()
    marker = "Policy: " + extraction_policy_hash()
    args = {"text": "Source statement."}
    legacy = PromptTemplate(TOPICS_PROMPT + "\n" + marker)
    key = hashlib.sha256(
        f"{llm.to_json()},{legacy.format(**args)}".encode()
    ).hexdigest()
    path = tmp_path / "cache" / "llm" / (key + ".txt")
    path.parent.mkdir(parents=True)
    path.write_text(
        "topic: "
        + TOPICS[0]
        + "\nentities:\nproposition: Source statement.\nSource statement."
    )
    cache = LegacyValidatedPromptCache(llm=llm, enable_cache=True)
    assert (
        cache.predict(PromptTemplate(marker + "\n" + TOPICS_PROMPT), **args)
        == path.read_text()
    )
    assert (
        cache.predict(
            PromptTemplate(marker + "\n" + TOPICS_PROMPT + "\nChanged instructions"),
            **args,
        )
        != path.read_text()
    )


def test_identical_source_text_same_item_has_unique_chunk_evidence(
    tmp_path, monkeypatch
):
    import json

    from graphrag_toolkit.lexical_graph.indexing.constants import (
        PROPOSITIONS_KEY,
        TOPICS_KEY,
    )
    from llama_index.core.schema import TextNode

    from domains.sec_modeling import model2_topics

    monkeypatch.setattr(
        model2_topics,
        "classify_propositions",
        lambda propositions, context: [distribution(2)],
    )
    nodes = [
        TextNode(
            id_=f"chunk-{order}",
            text="Identical source",
            metadata={
                "itemId": "same-item",
                "chunkOrder": order,
                PROPOSITIONS_KEY: ["Statement."],
                TOPICS_KEY: collection(),
            },
        )
        for order in (0, 1)
    ]
    model2_topics.DecisionsTopicReclassifier(evidence_dir=str(tmp_path))(nodes)
    files = list(tmp_path.glob("*.json"))
    assert len(files) == 2
    assert {json.loads(path.read_text())["chunkId"] for path in files} == {
        "chunk-0",
        "chunk-1",
    }


def test_evidence_key_matches_real_toolkit_extraction_and_build_rewrite(
    tmp_path, monkeypatch
):
    import hashlib
    import json

    from graphrag_toolkit.lexical_graph import TenantId
    from graphrag_toolkit.lexical_graph.indexing import IdGenerator
    from graphrag_toolkit.lexical_graph.indexing.build.node_builders import NodeBuilders
    from graphrag_toolkit.lexical_graph.indexing.constants import (
        PROPOSITIONS_KEY,
        TOPICS_KEY,
    )
    from graphrag_toolkit.lexical_graph.indexing.extract.id_rewriter import IdRewriter
    from llama_index.core.schema import NodeRelationship, RelatedNodeInfo, TextNode

    from domains.sec_modeling import model2_topics

    monkeypatch.setattr(
        model2_topics,
        "classify_propositions",
        lambda propositions, context: [distribution(2)],
    )
    nodes = [
        TextNode(
            text="Identical source",
            metadata={"itemId": "item", "chunkOrder": order},
            relationships={
                NodeRelationship.SOURCE: RelatedNodeInfo(
                    node_id="source::filing:item", metadata={"itemId": "item"}
                )
            },
        )
        for order in (0, 1)
    ]
    nodes = IdRewriter(id_generator=IdGenerator())._parse_nodes(nodes)
    assert nodes[0].node_id != nodes[1].node_id
    for node in nodes:
        node.metadata.update(
            {PROPOSITIONS_KEY: ["Statement."], TOPICS_KEY: collection()}
        )
    tenant = TenantId("generationtenant")
    model2_topics.DecisionsTopicReclassifier(
        evidence_dir=str(tmp_path), tenant_id_value=tenant.value
    )(nodes)
    NodeBuilders(id_generator=IdGenerator(tenant_id=tenant)).get_nodes_from_metadata(
        nodes
    )
    for node in nodes:
        path = tmp_path / (hashlib.sha256(node.node_id.encode()).hexdigest() + ".json")
        assert json.loads(path.read_text())["chunkId"] == node.node_id
    assert len(list(tmp_path.glob("*.json"))) == 2
