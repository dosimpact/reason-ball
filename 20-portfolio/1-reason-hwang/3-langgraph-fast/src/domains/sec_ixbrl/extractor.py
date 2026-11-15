"""Extract semantics and render anchors from the same local document tree."""

import copy
import hashlib
import re
from decimal import Decimal, InvalidOperation, localcontext

from arelle.FunctionIxt import ixtNamespaceFunctions
from lxml import etree

from infrastructure.edgar_transforms import loadSECtransforms

VERSION = "sec-ixbrl-local/1;arelle-transforms/2.47.5"
MAX_SOURCE = 32 * 1024 * 1024
MAX_ELEMENTS = 250000
MAX_FACTS = 50000
IX = {"http://www.xbrl.org/2013/inlineXBRL", "http://www.xbrl.org/2008/inlineXBRL"}
XBRLI = "http://www.xbrl.org/2003/instance"
XSI = "http://www.w3.org/2001/XMLSchema-instance"
XBRLDI = "http://xbrl.org/2006/xbrldi"
CUSTOM = {}
loadSECtransforms(CUSTOM)
TRANSFORMS = {(namespace, name): fn for namespace, entries in ixtNamespaceFunctions.items() for name, fn in entries.items()}
TRANSFORMS.update({(qn.namespaceURI, qn.localName): fn for qn, fn in CUSTOM.items()})


def tag(node):
    if not isinstance(node.tag, str):
        return None
    try:
        return etree.QName(node.tag)
    except ValueError:
        return etree.QName(node.tag.rsplit(":", 1)[-1])


def expanded(node, value):
    if not value:
        return None
    if ":" in value:
        prefix, local = value.split(":", 1)
        namespace = node.nsmap.get(prefix)
        if not namespace:
            raise ValueError("Unresolved QName prefix")
    else:
        local, namespace = value, node.nsmap.get(None)
    return f"{{{namespace}}}{local}" if namespace else local


def drop(node):
    parent = node.getparent()
    if parent is None:
        return
    tail = node.tail or ""
    previous = node.getprevious()
    if previous is None:
        parent.text = (parent.text or "") + tail
    else:
        previous.tail = (previous.tail or "") + tail
    parent.remove(node)


def lexical(node, escaped=False):
    clone = copy.deepcopy(node)
    for child in list(clone.iterdescendants()):
        qn = tag(child)
        if qn and qn.namespace in IX and qn.localname == "exclude":
            drop(child)
    if not escaped:
        return "".join(clone.itertext())
    for namespace in IX:
        etree.strip_tags(clone, f"{{{namespace}}}*")
    return (clone.text or "") + "".join(etree.tostring(child, encoding="unicode", with_tail=True) for child in clone)


def context_data(node):
    period = {}
    for child in node.iter():
        qn = tag(child)
        if qn and qn.namespace == XBRLI and qn.localname in {"instant", "startDate", "endDate", "forever"}:
            period[{"instant": "instantDate"}.get(qn.localname, qn.localname)] = child.text or ""
    period["periodType"] = "instant" if "instantDate" in period else "forever" if "forever" in period else "duration"
    identifiers = node.findall(f".//{{{XBRLI}}}identifier")
    entity = {"identifier": identifiers[0].text or "", "scheme": identifiers[0].get("scheme")} if identifiers else None
    dimensions = []
    for child in node.iter():
        qn = tag(child)
        if not qn or qn.namespace != XBRLDI or qn.localname not in {"explicitMember", "typedMember"}:
            continue
        dimensions.append({"dimension": expanded(child, child.get("dimension")), "kind": "explicit" if qn.localname == "explicitMember" else "typed",
                           "member": expanded(child, (child.text or "").strip()) if qn.localname == "explicitMember" else None,
                           "typedValue": etree.tostring(child, encoding="unicode", with_tail=False) if qn.localname == "typedMember" else None})
    return period, entity, dimensions


def unit_data(node):
    divide = node.find(f"{{{XBRLI}}}divide")
    if divide is None:
        return {"numerator": [expanded(m, (m.text or "").strip()) for m in node.findall(f"{{{XBRLI}}}measure")], "denominator": []}
    return {side: [expanded(m, (m.text or "").strip()) for m in divide.findall(f"{{{XBRLI}}}{element}/{{{XBRLI}}}measure")]
            for side, element in [("numerator", "unitNumerator"), ("denominator", "unitDenominator")]}


def normalize(node, raw, kind, is_nil):
    if is_nil:
        return None, "nil", []
    if kind == "fraction":
        return None, "unsupported", ["Fraction normalization is outside this viewer's supported SEC scope."]
    value = raw
    fmt = node.get("format")
    if fmt:
        try:
            name = expanded(node, fmt)
        except ValueError:
            return None, "unsupported", ["Transformation QName cannot be resolved."]
        match = re.fullmatch(r"\{([^}]+)\}(.+)", name or "")
        fn = TRANSFORMS.get((match[1], match[2])) if match else None
        if fn is None:
            return None, "unsupported", ["Transformation namespace/name is unsupported."]
        try:
            value = str(fn(raw.strip()))
        except Exception:
            return None, "invalid", ["Transformation failed; original value is preserved."]
    if kind == "nonNumeric":
        return value, "ok", []
    try:
        if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", value.strip()):
            raise ValueError("Not a decimal lexical value")
        scale = int(node.get("scale", "0"))
        if abs(scale) > 1000 or len(value) > 10000 or node.get("sign") not in (None, "-"):
            raise ValueError("Numeric attributes exceed supported limits")
        with localcontext() as ctx:
            ctx.prec = max(64, len(value) + abs(scale) + 8)
            number = Decimal(value.strip()) * (Decimal(10) ** scale)
            if node.get("sign") == "-":
                if number < 0:
                    raise ValueError("Ambiguous duplicate negative sign")
                number = -number
            if not number.is_finite():
                raise ValueError("Non-finite value")
            return format(number, "f"), "ok", []
    except (ValueError, InvalidOperation, OverflowError):
        return None, "invalid", ["Numeric normalization failed; no numeric value was guessed."]


SAFE_TAGS = set("html head body title div span p br hr table thead tbody tfoot tr td th colgroup col caption a b strong i em u s strike sub sup small big pre code blockquote ul ol li dl dt dd h1 h2 h3 h4 h5 h6 center font img".split())
SAFE_ATTRIBUTES = {"class", "title", "colspan", "rowspan", "span", "align", "valign", "width", "height", "border", "cellpadding", "cellspacing", "color", "face", "size", "dir", "lang"}
SAFE_STYLE = re.compile(r"^(?:color|background-color|font(?:-size|-family|-style|-weight)?|text-align|text-decoration|text-indent|white-space|vertical-align|border(?:-(?:top|bottom|left|right|width|color|style|collapse|spacing))?|padding(?:-(?:top|bottom|left|right))?|margin(?:-(?:top|bottom|left|right))?|width|max-width|min-width|height|line-height|display)$", re.I)


def sanitize(root, annotations):
    for node in list(root.iter()):
        qn = tag(node)
        if qn is None:
            drop(node)
            continue
        local = qn.localname.lower()
        if local in {"script", "style", "base", "meta", "link", "iframe", "frame", "frameset", "object", "embed", "applet", "svg", "math", "form", "input", "button", "textarea", "select", "option"} or (qn.namespace in IX and local in {"header", "hidden", "resources", "references"}):
            drop(node)
            continue
        if node.getparent() is None and node is not root:
            continue
        attributes = {key.lower(): value for key, value in node.attrib.items() if key.lower() in SAFE_ATTRIBUTES and len(value) <= 4096}
        declarations = []
        for declaration in node.get("style", "").split(";"):
            prop, sep, value = declaration.partition(":")
            if sep and SAFE_STYLE.fullmatch(prop.strip()) and re.fullmatch(r"[\w\s#.,%()'\"+\-]*", value) and not re.search(r"url|expression|import|javascript|behavior|binding|var\s*\(|attr\s*\(", value, re.I):
                declarations.append(f"{prop.strip()}:{value.strip()}")
        if declarations:
            attributes["style"] = ";".join(declarations)
        if local == "a":
            href = node.get("href", "")
            if re.fullmatch(r"#[A-Za-z0-9_.:-]{1,128}", href):
                attributes["href"] = href
        node.attrib.clear()
        node.attrib.update(attributes)
        node.tag = local if qn.namespace not in IX and local in SAFE_TAGS else "span"
        if node in annotations:
            anchor, fact_id = annotations[node]
            node.set("id", anchor)
            node.set("data-fact-id", fact_id)
    html = etree.tostring(root, method="html", encoding="unicode", doctype="<!doctype html>")
    return html


def extract(source, source_hash):
    encoded = source.encode("utf-8")
    if len(encoded) > MAX_SOURCE:
        raise ValueError("Source exceeds 32 MiB")
    if hashlib.sha256(encoded).hexdigest() != source_hash:
        raise LookupError("Source hash does not match stored document")
    warnings = []
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=False, remove_comments=True)
    try:
        root = etree.fromstring(encoded, parser)
    except etree.XMLSyntaxError:
        # HTML recovery is display-only: it cannot safely preserve QName semantics.
        root = etree.fromstring(encoded, etree.HTMLParser(no_network=True, remove_comments=True))
        if root is None:
            raise ValueError("Document cannot be parsed")
        if sum(1 for _ in root.iter()) > MAX_ELEMENTS:
            raise ValueError("Document element limit exceeded")
        return {"sourceHash": source_hash, "extractorVersion": VERSION, "status": "degraded", "available": False, "isInline": False, "totalFacts": 0, "visibleFacts": 0, "hiddenFacts": 0,
                "warnings": ["XML parsing failed. Display-only recovery; XBRL semantics are unavailable."], "facts": [], "html": sanitize(root, {})}
    nodes = list(root.iter())
    if len(nodes) > MAX_ELEMENTS:
        raise ValueError("Document element limit exceeded")
    ids = {}
    duplicate_ids = set()
    for node in nodes:
        if node.get("id"):
            identity = node.get("id")
            if identity in ids:
                duplicate_ids.add(identity)
            ids[identity] = node
    fact_nodes = [node for node in nodes if tag(node) and tag(node).namespace in IX and tag(node).localname in {"nonFraction", "nonNumeric", "fraction"}]
    if len(fact_nodes) > MAX_FACTS:
        raise ValueError("Document fact limit exceeded")
    facts, annotations = [], {}
    for index, node in enumerate(fact_nodes, 1):
        qn = tag(node)
        fact_id = f"ix-fact-{index}"
        problems = []
        chain = [node]
        seen = {node.get("id")} if node.get("id") else set()
        current = node
        for _ in range(128):
            continued = current.get("continuedAt")
            if not continued:
                break
            candidate = ids.get(continued)
            if continued in seen or continued in duplicate_ids or candidate is None or not tag(candidate) or tag(candidate).namespace not in IX or tag(candidate).localname != "continuation":
                problems.append("Continuation is missing, duplicated or cyclic; value is incomplete.")
                break
            seen.add(continued)
            chain.append(candidate)
            current = candidate
        else:
            problems.append("Continuation chain exceeds supported depth.")
        raw = "".join(lexical(segment, node.get("escape") in {"true", "1"}) for segment in chain)
        display = "".join(lexical(segment) for segment in chain)
        nil = node.get(f"{{{XSI}}}nil") in {"true", "1"}
        normalized, normal_status, value_warnings = normalize(node, raw, qn.localname, nil)
        problems.extend(value_warnings)
        context = ids.get(node.get("contextRef"))
        period, entity, dimensions, unit = None, None, [], None
        try:
            if context is None or node.get("contextRef") in duplicate_ids or tag(context).namespace != XBRLI or tag(context).localname != "context":
                problems.append("Context is missing or invalid.")
            else:
                period, entity, dimensions = context_data(context)
                if entity is None or not any(key in period for key in ("instantDate", "startDate", "forever")):
                    problems.append("Context period or entity is missing.")
            if qn.localname != "nonNumeric" and not nil:
                unit_node = ids.get(node.get("unitRef"))
                if unit_node is None or node.get("unitRef") in duplicate_ids or tag(unit_node).namespace != XBRLI or tag(unit_node).localname != "unit":
                    problems.append("Unit is missing or invalid.")
                else:
                    unit = unit_data(unit_node)
            concept = expanded(node, node.get("name"))
            if not concept:
                problems.append("Concept QName is missing.")
        except ValueError:
            concept = None
            problems.append("A namespace reference cannot be resolved.")
        if any("Continuation" in problem or "Context" in problem or "Unit" in problem or "QName" in problem or "namespace" in problem for problem in problems):
            normalized, normal_status = None, "invalid"
        hidden = any(tag(parent) and tag(parent).namespace in IX and tag(parent).localname in {"hidden", "header", "resources"} for parent in node.iterancestors())
        segments = []
        if not hidden:
            for segment_index, segment in enumerate(chain, 1):
                if any(tag(parent) and tag(parent).namespace in IX and tag(parent).localname in {"hidden", "header", "resources"} for parent in segment.iterancestors()):
                    continue
                if segment in annotations:
                    problems.append("Source segment is shared with another fact; focus uses the first owner.")
                    normalized, normal_status = None, "invalid"
                    continue
                anchor = f"ix-segment-{index}-{segment_index}"
                annotations[segment] = (anchor, fact_id)
                segments.append(anchor)
        facts.append({"factId": fact_id, "sourceElementId": node.get("id"), "segments": segments, "conceptQName": concept,
                      "localName": (node.get("name") or "").split(":")[-1], "kind": qn.localname,
                      "displayText": display, "rawValue": raw, "normalizedValue": normalized, "normalizationStatus": normal_status,
                      "contextRef": node.get("contextRef"), "unitRef": node.get("unitRef"), "period": period, "entity": entity,
                      "unit": unit, "dimensions": dimensions, "decimals": node.get("decimals"), "scale": node.get("scale"), "sign": node.get("sign"),
                      "format": node.get("format"), "isNil": nil, "isHidden": hidden, "warnings": problems})
    if not facts:
        warnings.append("No supported Inline XBRL fact elements were found.")
    hidden_count = sum(fact["isHidden"] for fact in facts)
    return {"sourceHash": source_hash, "extractorVersion": VERSION, "status": "ready" if facts else "unsupported", "available": bool(facts), "isInline": bool(facts),
            "totalFacts": len(facts), "visibleFacts": len(facts) - hidden_count, "hiddenFacts": hidden_count, "warnings": warnings, "facts": facts, "html": sanitize(root, annotations)}
