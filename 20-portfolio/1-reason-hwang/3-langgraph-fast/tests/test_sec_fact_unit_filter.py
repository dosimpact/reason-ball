import json

import pytest

from domains.sec_modeling.contracts import FactsRequest
from domains.sec_modeling.search import facts

USD = "{http://www.xbrl.org/2003/iso4217}USD"
SHARES = "{http://www.xbrl.org/2003/instance}shares"


class Store:
    def active(self, filing, stage):
        assert stage == 3
        return {"id": "published"}

    def records(self, generation, kind):
        assert generation == "published" and kind == "XbrlFact"
        return [
            {"id": "usd", "unit": {"numerator": [USD], "denominator": []}, "dimensions": []},
            {"id": "per-share", "unit": {"numerator": [USD], "denominator": [SHARES]}, "dimensions": []},
        ]


@pytest.mark.parametrize("unit", [
    json.dumps({"numerator": [USD], "denominator": []}),
    json.dumps({"denominator": [], "numerator": [USD]}, indent=3),
    json.dumps({"numerator": [USD], "denominator": []}, separators=(",", ":")),
])
def test_returned_unit_json_matches_independent_of_key_order_and_whitespace(unit):
    result = facts(FactsRequest(filingIds=["filing"], unit=unit), Store())
    assert [row["id"] for row in result["items"]] == ["usd"]


@pytest.mark.parametrize("unit", ["USD", "{broken", "null", "[]", '{"numerator":"USD","denominator":[]}', ""])
def test_invalid_unit_filters_explicitly_match_nothing(unit):
    assert facts(FactsRequest(filingIds=["filing"], unit=unit), Store())["total"] == 0


def test_unit_measure_order_is_irrelevant_but_multiplicity_and_division_are_preserved():
    from domains.sec_modeling.search import canonical_unit
    assert canonical_unit({"numerator": [USD, SHARES], "denominator": []}) == canonical_unit({"denominator": [], "numerator": [SHARES, USD]})
    assert canonical_unit({"numerator": [USD, USD], "denominator": []}) != canonical_unit({"numerator": [USD], "denominator": []})
    assert canonical_unit({"numerator": [USD], "denominator": [SHARES]}) != canonical_unit({"numerator": [SHARES], "denominator": [USD]})
