import importlib.util
from pathlib import Path

import httpx

spec = importlib.util.spec_from_file_location("retrieval_validation", Path(__file__).parents[1] / "scripts/validate_sec_retrieval.py")
assert spec is not None and spec.loader is not None
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
QUESTION = {"id": "1", "language": "en", "ticker": "AAPL", "cik": "0000320193", "accessionNo": "0000320193-26-000026", "query": "risk", "evidenceContains": "expected quotation"}
FILING = "filing:0000320193:0000320193-26-000026"


def test_full_item_html_cannot_inflate_recall():
    def handle(request):
        if request.method == "POST":
            assert b"itemCodes" not in request.content
            return httpx.Response(200, json={"items": [{"id": "chunk1", "filingId": FILING, "text": "unrelated"}]})
        return httpx.Response(200, json={"id": "chunk1", "filingId": FILING, "text": "unrelated", "displayHtml": "expected quotation"})
    with httpx.Client(base_url="http://test", transport=httpx.MockTransport(handle)) as client:
        report = validator.validate_question(client, QUESTION, 10, {})
    assert not report["matched"]
    assert report["unresolvedEvidenceCount"] == 0


def test_cross_filing_is_failure_even_when_quotation_matches():
    def handle(request):
        evidence = {"id": "chunk1", "filingId": "wrong", "text": "expected quotation"}
        return httpx.Response(200, json={"items": [evidence]} if request.method == "POST" else evidence)
    with httpx.Client(base_url="http://test", transport=httpx.MockTransport(handle)) as client:
        report = validator.validate_question(client, QUESTION, 10, {})
    assert not report["matched"]
    assert report["wrongFilingCount"] == 1


def test_exact_source_and_all_resolvable_evidence_pass_thirty_questions():
    def handle(request):
        evidence = {"id": "chunk1", "filingId": FILING, "text": "expected quotation"}
        return httpx.Response(200, json={"items": [evidence]} if request.method == "POST" else evidence)
    with httpx.Client(base_url="http://test", transport=httpx.MockTransport(handle)) as client:
        report = validator.run(client, {"questions": [{**QUESTION, "id": str(i)} for i in range(30)], "topK": 10, "minimumRecall": .9})
    assert report["status"] == "PASS"
    assert report["summary"]["uniqueEvidenceIds"] == 1
