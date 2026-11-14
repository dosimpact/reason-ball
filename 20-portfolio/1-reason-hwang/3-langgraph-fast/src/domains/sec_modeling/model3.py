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


def source_xpath(element):
    """Namespace-independent locator, also valid for Inline XBRL without an id."""
    steps = []
    current = element
    while current is not None:
        ordinal = 1 + sum(
            1
            for sibling in current.itersiblings(preceding=True)
            if isinstance(sibling.tag, str)
        )
        steps.append(f"*[{ordinal}]")
        current = current.getparent()
    return "/" + "/".join(reversed(steps))


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
                        "sourceXPath": source_xpath(fact),
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


def build_xbrl(
    request, generation, store, progress=lambda **_: None, cancelled=lambda: False
):
    from domains.sec_modeling.model3_selection import (
        dropped,
        link_evidence,
        select_facts,
    )

    if request.metadata.get("formType") not in {"10-K", "10-Q"}:
        raise ValueError("Model 3 supports only 10-K and 10-Q")
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
    candidates = [f for f in records if not dropped(f)]
    for fact in candidates:
        fact["candidateId"] = fact["id"]
    link_evidence(request.sourceHtml, candidates)
    selected = select_facts(candidates, request.extractionModel, progress, cancelled)
    if cancelled():
        raise InterruptedError("Execution cancelled")
    store.query(
        "MERGE (co:Company {id:$company}) SET co.cik=$cik,co.name=coalesce($name,co.name),co.ticker=coalesce($ticker,co.ticker) "
        "MERGE (f:Filing {id:$filing}) SET f.accessionNo=$accession,f.formType=$form,"
        "f.reportDate=coalesce($report,f.reportDate),f.filingDate=coalesce($date,f.filingDate),"
        "f.sourceUrl=$url,f.sourceHash=$hash MERGE (co)-[:FILED]->(f)",
        company=f"company:{request.cik}",
        cik=request.cik,
        name=request.metadata.get("companyName") or request.metadata.get("name"),
        ticker=request.metadata.get("ticker"),
        filing=request.filing_id,
        accession=request.accessionNo,
        form=request.metadata["formType"],
        report=request.metadata.get("reportDate"),
        date=request.metadata.get("filingDate"),
        url=request.metadata.get("sourceUrl"),
        hash=request.sourceHash,
    )
    # SecRecord is a second label on the SAME fact, not another physical node.
    store.save_records(generation, request.filing_id, 3, selected)
    for offset in range(0, len(selected), 100):
        if cancelled():
            raise InterruptedError("Execution cancelled")
        rows = []
        for fact in selected[offset : offset + 100]:
            props = {k: v for k, v in fact.items() if not isinstance(v, (list, dict))}
            props.update(fact["context"])
            props.update(
                dimensionsJson=json.dumps(fact["dimensions"]),
                unitJson=json.dumps(fact["unit"]),
                evidenceJson=json.dumps(fact["evidence"], ensure_ascii=False),
                evidenceIds=fact["evidenceIds"],
                categoryProbabilitiesJson=json.dumps(fact.get("categoryProbabilities", [])),
            )
            rows.append(
                {
                    "id": fact["id"],
                    "props": props,
                    "conceptId": f"{generation}:concept:{digest(fact['conceptQName'])}",
                    "concept": {
                        "namespaceUri": fact["namespaceUri"],
                        "localName": fact["localName"],
                        "label": fact["label"],
                        "dataType": fact["dataType"],
                        "periodType": fact["conceptPeriodType"],
                        "balance": fact["balance"],
                        "taxonomyHash": fact["taxonomyHash"],
                        "generationId": generation,
                        "stage": 3,
                    },
                }
            )
        store.query(
            "MERGE (co:Company {id:$company}) SET co.cik=$cik "
            "MERGE (f:Filing {id:$filing}) SET f.accessionNo=$accession,f.formType=$form "
            "MERGE (co)-[:FILED]->(f) WITH f UNWIND $rows AS row "
            "MATCH (x:SecRecord {id:row.id}) SET x:XbrlFact SET x += row.props "
            "MERGE (f)-[:HAS_XBRL_FACT]->(x) "
            "MERGE (c:Concept {id:row.conceptId}) SET c += row.concept "
            "MERGE (x)-[:OF_CONCEPT]->(c)",
            company=f"company:{request.cik}",
            cik=request.cik,
            filing=request.filing_id,
            accession=request.accessionNo,
            form=request.metadata["formType"],
            rows=rows,
        )
    return {
        "parsedFacts": len(records),
        "droppedFacts": len(records) - len(candidates),
        "candidateFacts": len(candidates),
        "facts": len(selected),
        "rejectedFacts": len(candidates) - len(selected),
        "concepts": len({f["conceptQName"] for f in selected}),
        "conflicts": sum(f["conflict"] for f in selected),
    }
