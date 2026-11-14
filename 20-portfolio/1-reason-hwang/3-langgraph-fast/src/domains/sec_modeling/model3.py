"""Arelle resolves Inline XBRL values, contexts, units, and taxonomy concepts."""

import hashlib
import json
import os
import tempfile
from contextlib import closing
from pathlib import Path
from urllib.parse import urljoin, urlparse

from lxml import etree  # type: ignore[attr-defined]


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, default=str).encode()
    ).hexdigest()


def qname(value):
    return f"{{{value.namespaceURI}}}{value.localName}" if value is not None else ""


def parse_xbrl(html, source_url):
    from arelle import Cntlr, ModelManager, XmlValidate

    origin = urlparse(source_url)
    if (
        origin.scheme != "https"
        or origin.hostname not in {"www.sec.gov", "sec.gov"}
        or not origin.path.startswith("/Archives/")
    ):
        raise ValueError("sourceUrl must identify an HTTPS SEC archive document")
    controller = Cntlr.Cntlr(logFileName="logToBuffer")
    controller.webCache.timeout = 30
    controller.webCache.httpUserAgent = os.getenv(
        "SEC_USER_AGENT", "ReasonHwang research contact@example.com"
    )
    original_getfilename = controller.webCache.getfilename

    def taxonomy_file(url, *args, **kwargs):
        parsed = urlparse(str(url))
        if parsed.scheme in ("http", "https") and parsed.hostname not in {
            "www.sec.gov",
            "sec.gov",
            "xbrl.sec.gov",
            "fasb.org",
            "xbrl.fasb.org",
            "www.xbrl.org",
            "xbrl.org",
            "xbrl.ifrs.org",
            "taxonomies.xbrl.org",
            "www.w3.org",
        }:
            raise ValueError("Taxonomy host is not allowed")
        if parsed.scheme not in ("", "file", "http", "https"):
            raise ValueError("Taxonomy scheme is not allowed")
        return original_getfilename(url, *args, **kwargs)

    controller.webCache.getfilename = taxonomy_file
    manager = ModelManager.initialize(controller)
    from infrastructure.edgar_transforms import loadSECtransforms

    manager.customTransforms = {}
    loadSECtransforms(manager.customTransforms)
    manager.validateDisclosureSystem = False
    with (
        closing(controller),
        tempfile.TemporaryDirectory(prefix="sec-xbrl-") as directory,
    ):
        root = etree.fromstring(
            html.encode(),
            parser=etree.XMLParser(
                resolve_entities=False, no_network=True, huge_tree=True
            ),
        )
        for ref in root.xpath('//*[local-name()="schemaRef"]'):
            attr = "{http://www.w3.org/1999/xlink}href"
            schema_url = urljoin(source_url, ref.get(attr, ""))
            if urlparse(schema_url).scheme not in ("http", "https"):
                raise ValueError("Schema references must use HTTP(S) taxonomy URLs")
            ref.set(attr, schema_url)
        path = Path(directory) / "filing.htm"
        path.write_bytes(etree.tostring(root))
        model = manager.load(str(path))
        try:
            if model is None or not model.facts:
                raise ValueError("Arelle could not load Inline XBRL facts")
            if model.errors or any(f.concept is None for f in model.facts):
                raise ValueError(
                    "Unresolved XBRL taxonomy or load errors: "
                    + ",".join(str(e) for e in model.errors[:8])
                )
            taxonomy_hash = digest(
                sorted(
                    (uri, hashlib.sha256(Path(doc.filepath).read_bytes()).hexdigest())
                    for uri, doc in model.urlDocs.items()
                    if doc.filepath
                    and Path(doc.filepath).is_file()
                    and doc is not model.modelDocument
                )
            )
            result = []
            for fact in model.facts:
                if fact.concept is None:
                    raise ValueError("Unresolved fact concept")
                context = fact.context
                if context is None:
                    raise ValueError("Fact missing context")
                dimensions = []
                for axis, value in context.qnameDims.items():
                    dimensions.append(
                        {
                            "dimension": qname(axis),
                            "namespaceUri": axis.namespaceURI,
                            "localName": axis.localName,
                            "label": model.qnameConcepts[axis].label()
                            if axis in model.qnameConcepts
                            else axis.localName,
                            "kind": "explicit" if value.isExplicit else "typed",
                            "member": qname(value.memberQname)
                            if value.isExplicit
                            else None,
                            "memberLabel": model.qnameConcepts[
                                value.memberQname
                            ].label()
                            if value.isExplicit
                            and value.memberQname is not None
                            and value.memberQname in model.qnameConcepts
                            else None,
                            "typedValue": etree.tostring(
                                value.typedMember, method="c14n"
                            ).decode()
                            if value.isTyped
                            else None,
                        }
                    )
                period = {
                    "periodType": "instant"
                    if context.isInstantPeriod
                    else "duration"
                    if context.isStartEndPeriod
                    else "forever"
                }
                # Arelle end/instant datetime adds a day for XBRL exclusive end; retain lexical dates.
                for name in ("startDate", "endDate", "instant"):
                    found = context.find(
                        f"{{http://www.xbrl.org/2003/instance}}period/{{http://www.xbrl.org/2003/instance}}{name}"
                    )
                    if found is not None:
                        period["instantDate" if name == "instant" else name] = (
                            found.text
                        )
                unit = None
                if fact.unit:
                    unit = {
                        "numerator": sorted(qname(m) for m in fact.unit.measures[0]),
                        "denominator": sorted(qname(m) for m in fact.unit.measures[1]),
                    }
                XmlValidate.validate(model, fact)
                if getattr(fact, "xValid", 0) == 1 or (
                    not fact.isNil and not hasattr(fact, "xValue")
                ):
                    raise ValueError("Invalid typed XBRL fact value")
                normalized = None if fact.isNil else str(fact.xValue)
                result.append(
                    {
                        "sourceFactId": fact.id,
                        "conceptQName": qname(fact.qname),
                        "namespaceUri": fact.qname.namespaceURI,
                        "localName": fact.qname.localName,
                        "label": fact.concept.label(),
                        "dataType": qname(fact.concept.typeQname),
                        "balance": fact.concept.balance,
                        "conceptPeriodType": fact.concept.periodType,
                        "rawValue": fact.rawValue,
                        "normalizedValue": normalized,
                        "valueType": "numeric" if fact.isNumeric else "text",
                        "isNil": fact.isNil,
                        "decimals": fact.decimals,
                        "scale": fact.get("scale"),
                        "sign": fact.get("sign"),
                        "format": fact.get("format"),
                        "context": {
                            "sourceContextIds": [context.id],
                            **period,
                            "entityIdentifier": context.entityIdentifier[1],
                            "entityScheme": context.entityIdentifier[0],
                        },
                        "dimensions": sorted(dimensions, key=lambda d: d["dimension"]),
                        "unit": unit,
                        "parserVersion": "arelle-release/2.47.5",
                        "taxonomyHash": taxonomy_hash,
                    }
                )
            if model.errors:
                raise ValueError("XBRL value validation failed")
            return result
        finally:
            if model:
                model.close()


def build_xbrl(request, generation, store):
    facts = parse_xbrl(request.sourceHtml, request.metadata.get("sourceUrl", ""))
    if any(
        str(fact["context"]["entityIdentifier"]).zfill(10) != request.cik
        for fact in facts
    ):
        raise ValueError("XBRL context entity does not match requested CIK")
    for concept, expected in [
        ("DocumentType", request.metadata.get("formType", "10-K")),
        ("DocumentPeriodEndDate", request.metadata.get("reportDate")),
    ]:
        values = {
            fact["normalizedValue"]
            for fact in facts
            if fact["localName"] == concept
            and "xbrl.sec.gov/dei/" in fact["namespaceUri"]
        }
        if expected and values != {expected}:
            raise ValueError(f"XBRL {concept} does not match filing metadata")
    records = []
    groups = {}
    for ordinal, fact in enumerate(facts):
        group = digest(
            [
                fact["conceptQName"],
                {k: v for k, v in fact["context"].items() if k != "sourceContextIds"},
                fact["dimensions"],
                fact["unit"],
            ]
        )
        groups.setdefault(group, set()).add(fact["normalizedValue"])
        fact.update(
            id=f"{generation}:fact:{ordinal}",
            type="XbrlFact",
            filingId=request.filing_id,
            generationId=generation,
            duplicateGroup=group,
        )
        records.append(fact)
    for fact in records:
        fact["conflict"] = len(groups[fact["duplicateGroup"]]) > 1
    store.save_records(generation, request.filing_id, 3, records)
    for fact in records:
        props = {k: v for k, v in fact.items() if not isinstance(v, (list, dict))}
        cid = f"{generation}:context:{digest([{k: v for k, v in fact['context'].items() if k != 'sourceContextIds'}, fact['dimensions']])}"
        uid = f"{generation}:unit:{digest(fact['unit'])}"
        concept = f"{generation}:concept:{digest(fact['conceptQName'])}"
        store.query(
            "MERGE (co:Company {id:$company}) SET co.cik=$cik MERGE (f:Filing {id:$filing}) SET f.accessionNo=$accession MERGE (co)-[:FILED]->(f) MERGE (x:XbrlFact {id:$id}) SET x += $props MERGE (f)-[:HAS_XBRL_FACT]->(x) MERGE (c:Concept {id:$concept}) SET c.namespaceUri=$ns,c.localName=$local,c.label=$label,c.dataType=$datatype,c.periodType=$periodtype,c.balance=$balance,c.taxonomyHash=$taxonomy MERGE (x)-[:OF_CONCEPT]->(c) MERGE (ctx:Context {id:$context}) SET ctx += $ctx SET ctx.sourceContextIds=reduce(ids=coalesce(ctx.sourceContextIds,[]), value IN $sourceids | CASE WHEN value IN ids THEN ids ELSE ids+value END) MERGE (x)-[:IN_CONTEXT]->(ctx) MERGE (ctx)-[:FOR_ENTITY]->(co) FOREACH (_ IN CASE WHEN $hasunit THEN [1] ELSE [] END | MERGE (u:Unit {id:$unit}) SET u.canonicalExpression=$expression MERGE (x)-[:IN_UNIT]->(u))",
            filing=request.filing_id,
            company=f"company:{request.cik}",
            cik=request.cik,
            accession=request.accessionNo,
            datatype=fact["dataType"],
            periodtype=fact["conceptPeriodType"],
            balance=fact["balance"],
            hasunit=fact["unit"] is not None,
            id=fact["id"],
            props=props,
            concept=concept,
            ns=fact["namespaceUri"],
            local=fact["localName"],
            label=fact["label"],
            context=cid,
            ctx={k: v for k, v in fact["context"].items() if k != "sourceContextIds"},
            sourceids=fact["context"]["sourceContextIds"],
            taxonomy=fact["taxonomyHash"],
            unit=uid,
            expression=json.dumps(fact["unit"]),
        )
        for dim in fact["dimensions"]:
            store.query(
                "MATCH (c:Context {id:$c}) MERGE (v:DimensionValue {id:$v}) SET v.kind=$kind,v.typedValue=$typed MERGE (c)-[:HAS_DIMENSION_VALUE]->(v) MERGE (d:Dimension {id:$d}) SET d.qname=$axis,d.namespaceUri=$ns,d.localName=$local,d.label=$label,d.kind=$kind MERGE (v)-[:OF_DIMENSION]->(d) FOREACH (_ IN CASE WHEN $member IS NULL THEN [] ELSE [1] END | MERGE (m:Member {id:$m}) SET m.qname=$member,m.namespaceUri=$memberns,m.localName=$memberlocal,m.label=$memberlabel MERGE (v)-[:HAS_MEMBER]->(m))",
                c=cid,
                v=f"{generation}:dv:{digest(dim)}",
                d=f"{generation}:dim:{digest(dim['dimension'])}",
                m=f"{generation}:member:{digest(dim['member'])}",
                axis=dim["dimension"],
                ns=dim["namespaceUri"],
                local=dim["localName"],
                label=dim["label"],
                memberns=(dim["member"].split("}")[0][1:] if dim["member"] else None),
                memberlocal=(dim["member"].split("}")[-1] if dim["member"] else None),
                kind=dim["kind"],
                typed=dim["typedValue"],
                member=dim["member"],
                memberlabel=dim["memberLabel"],
            )
    return {"facts": len(records), "conflicts": sum(f["conflict"] for f in records)}
