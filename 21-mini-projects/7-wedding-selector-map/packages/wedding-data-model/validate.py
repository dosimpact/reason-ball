"""Validate a collected disclosure envelope and its local source references."""
from __future__ import annotations

import argparse
from decimal import Decimal
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[1]
COLLECTIONS = (
    "entities", "sources", "disclosures", "evidence", "conditions", "facts",
    "priceTerms", "relations", "policies", "derivations",
)


def validate(data, check_sources=False):
    schema = json.loads((BASE / "schema/wedding-disclosure.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(data)
    records = {}
    groups = {}
    for collection in COLLECTIONS:
        groups[collection] = {record["id"] for record in data[collection]}
        for record in data[collection]:
            if record["id"] in records:
                raise ValueError(f"Duplicate ID: {record['id']}")
            records[record["id"]] = record

    def check(identifier, group=None):
        allowed = groups[group] if group else records
        if identifier not in allowed:
            raise ValueError(f"Unresolved {group or 'record'} reference: {identifier}")

    for collection in COLLECTIONS:
        for record in data[collection]:
            for key, group in (
                ("subjectId", "entities"), ("itemId", "entities"),
                ("audienceId", "entities"), ("venueId", "entities"),
                ("disclosureId", "disclosures"), ("sourceId", "sources"),
                ("parentSourceId", "sources"), ("parentEvidenceId", "evidence"),
                ("fromId", None), ("toId", None), ("outputRef", None),
                ("supersedesId", "disclosures"),
            ):
                if key in record:
                    check(record[key], group)
            for key, group in (
                ("evidenceIds", "evidence"), ("sourceIds", "sources"),
                ("conditionIds", "conditions"), ("supersedesFactIds", "facts"),
                ("inputRefs", None),
            ):
                for identifier in record.get(key, []):
                    check(identifier, group)

    def expression_refs(node):
        if node["op"] == "price_ref":
            check(node["priceId"], "priceTerms")
        for arg in node.get("args", []):
            expression_refs(arg)

    for term in data["priceTerms"]:
        if Decimal(term["basis"]["quantity"]) <= 0:
            raise ValueError(f"Nonpositive pricing basis: {term['id']}")
        amount = term.get("amount", {})
        for key in ("value", "lower", "upper"):
            if key in amount and Decimal(amount[key]) < 0:
                raise ValueError(f"Negative amount; express effect through role: {term['id']}")
        if "lower" in amount and "upper" in amount:
            if Decimal(amount["lower"]) > Decimal(amount["upper"]):
                raise ValueError(f"Reversed range: {term['id']}")
        if term["state"] == "free" and amount:
            if amount.get("kind") != "exact" or Decimal(amount["value"]) != 0:
                raise ValueError(f"Free price must be zero: {term['id']}")
        if amount.get("kind") == "percentage":
            check(amount["basisRef"])
        if amount.get("kind") == "formula":
            expression_refs(amount["expression"])
    for policy in data["policies"]:
        for rule in policy["rules"]:
            for identifier in rule["conditionIds"]:
                check(identifier, "conditions")
            if "actorId" in rule:
                check(rule["actorId"], "entities")
            for effect in rule["effects"]:
                if "priceTermId" in effect:
                    check(effect["priceTermId"], "priceTerms")
    if check_sources:
        for source in data["sources"]:
            path = (ROOT / source["localPath"]).resolve()
            if not path.is_relative_to(ROOT):
                raise ValueError(f"Source outside project: {path}")
            if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
                raise ValueError(f"Source hash mismatch: {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument("--check-sources", action="store_true")
    args = parser.parse_args()
    paths = args.files or sorted((BASE / "examples").glob("*.json"))
    if not paths:
        parser.error("No input files")
    for path in paths:
        validate(json.loads(path.read_text()), args.check_sources)
        print(f"PASS {path.name}")


if __name__ == "__main__":
    main()
