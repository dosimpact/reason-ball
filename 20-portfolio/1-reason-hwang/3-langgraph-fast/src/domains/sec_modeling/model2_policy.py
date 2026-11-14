"""Versioned SEC extraction policy, promoted from validated v3 experiment assets."""

import hashlib
import json

TOPICS = (
    "Business Model and Products",
    "Competition and Growth",
    "Supply Chain and Operations",
    "Product Quality and Security",
    "Regulation and Legal",
    "Workforce and Intellectual Property",
    "Financial Performance and Metrics",
    "Macroeconomic Exposure",
)
ENTITY_CLASSES = (
    "Company",
    "Business Segment",
    "Product",
    "Service",
    "Program",
    "Regulator",
    "Location",
    "Resource",
    "Risk Factor",
)
DECISIONS_MODEL = "gpt-6-luna"
DECISION_INSTRUCTIONS = "Classify the supplied SEC proposition by its primary business meaning into exactly one of the eight canonical topics. Retain uncertainty and conditions when interpreting the statement."
PROPOSITIONS_PROMPT = "Extract SEC filing analysis statements. Group a coherent business explanation, risk mechanism, or performance driver into one independently understandable statement (usually 1-3 sentences). Keep cause, consequence, uncertainty, scope, dates, numbers and units together. Keep lists of related offerings together unless individual entries have materially different claims. Separate unrelated subjects, periods and risks. Preserve all material claims; do not summarize away qualifications or numbers. Do not add entity-classification statements, headings, or generic background. Resolve pronouns using only supplied source information. Do not invent causal relationships. No hard count target. Output one complete statement per line, no title, numbering, bullets or commentary.\nSource: {source_info}\nText:\n{text}"
TOPICS_PROMPT = "Extract a compact SEC navigational graph. Preserve EVERY supplied statement EXACTLY ONCE, without splitting or shortening it. Preserve dates, numbers, uncertainty and conditions.\nTOPICS: reuse only these canonical topics: Business Model and Products; Competition and Growth; Supply Chain and Operations; Product Quality and Security; Regulation and Legal; Workforce and Intellectual Property; Financial Performance and Metrics; Macroeconomic Exposure. Choose the one or two dominant topics covering this chunk; group related subthemes under them. Assign every statement to the closest selected topic without changing the statement. Do not invent more specific topics or a topic for each consequence or metric.\nENTITIES: named companies, business segments, products/services/programs, regulators and locations are eligible. Additionally allow a concrete input/resource or clearly described risk mechanism ONLY when it is a material dependency or exposure in an explicit relationship. Use short stable names and merge synonyms. Do not promote every noun into an entity. Generic customers, suppliers, competitors, users, generic products/services, channels, metrics, ordinary descriptions, every item of a list, and secondary consequences should stay in statement text. For example, memory components may be a material dependency, while rising costs should normally remain a qualification. Risk mechanisms may be entities when indispensable to a meaningful risk link, not simply because a sentence describes a risk. No artificial node minimum or count target. Entity classes: Company, Business Segment, Product, Service, Program, Regulator, Location, Resource, Risk Factor.\nFACTS: select the primary meaningful business/dependency/risk links, rather than all possible triples. Keep causal context in statements. Named-entity relationships and concrete dependencies are both permitted. Usually one or two primary links suffice; do not force a link when none is useful. Do not add entity-classification facts, duplicate inverse relations, or every member of an enumeration. Preserve modality (MAY_*, EXPECTS_*, etc.) and negation when extracting a conditional or negative link. For an important business metric or operating characteristic with no suitable object entity, a single concise entity-attribute fact is allowed instead of inventing Metric/Asset/Channel entities; retain all details in its statement. Never infer a relation absent from the text. A statement with no appropriate fact must still be retained.\nOUTPUT: exact Toolkit text format, no fences or commentary:\ntopic: chosen canonical topic\nentities:\nactual entity|allowed class\nproposition: EXACT supplied statement on the SAME LINE\nentity-entity relationships:\nactual entity|RELATION|actual entity\nentity-attributes:\nactual entity|ATTRIBUTE|concise value\nRepeat proposition blocks, and topic blocks only when needed. Omit empty relationship/attribute sections. For EVERY fact-free statement, repeat the exact statement on one plain detail line immediately below its proposition line, so the Toolkit parser preserves it. Never emit an empty proposition value.\nStatements:\n{text}"


def extraction_policy_hash():
    return hashlib.sha256(
        json.dumps(
            {
                "version": 1,
                "propositions": PROPOSITIONS_PROMPT,
                "topicsPrompt": TOPICS_PROMPT,
                "topics": TOPICS,
                "classes": ENTITY_CLASSES,
                "model": DECISIONS_MODEL,
                "instructions": DECISION_INSTRUCTIONS,
                "batchSize": 100,
                "topicSelection": "max-sum-max-singleton-pair;tie-fewer-then-list-order",
                "coverage": "exact-multiset;restore-parser-colons;merge-exact-fragments-full-character-coverage",
                "invalidExtractionRetries": 1,
                "chunkMetadata": ["itemId"],
                "transientAttempts": 3,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()


def runtime_policy_hash():
    return hashlib.sha256(
        json.dumps(
            {
                "extractionPolicy": extraction_policy_hash(),
                "validationVersion": "exact-coverage/2;drop-only-fact-free-own-legacy-marker;retry-instructions-prefix",
                "cacheMarkerPlacement": "instruction-prefix;validated-legacy-output-reuse",
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
