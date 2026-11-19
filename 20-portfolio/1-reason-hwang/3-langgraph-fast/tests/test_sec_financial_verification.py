"""Financial basis regression independent of company, model and network."""

from copy import deepcopy

import pytest

from domains.sec_tools.financial_verification import (
    FinancialEvidence,
    financial_scope,
    safe_report,
    verify_financials,
)

SOURCE_ID = "0000000042:0000000042-26-000001"
SOURCE = """As of September 26, 2026. Amounts in millions of USD.
Term debt principal 78,678.
Term debt carrying amount 78,114.
Commercial paper principal 1,997.
Financial assets fair value 136,935."""


def payload():
    rows = [
        (
            "term",
            "Term debt",
            "78678",
            "78,678",
            "principal",
            "Term debt principal 78,678.",
        ),
        (
            "book",
            "Term debt",
            "78114",
            "78,114",
            "carrying",
            "Term debt carrying amount 78,114.",
        ),
        (
            "cp",
            "Commercial paper",
            "1997",
            "1,997",
            "principal",
            "Commercial paper principal 1,997.",
        ),
        (
            "assets",
            "Financial assets",
            "136935",
            "136,935",
            "fair_value",
            "Financial assets fair value 136,935.",
        ),
    ]
    return {
        "facts": [
            {
                "id": id_,
                "label": metric,
                "metric": metric,
                "value": value,
                "valueToken": token,
                "currency": "USD",
                "scale": "millions",
                "basis": basis,
                "asOf": "2026-09-26",
                "sourceId": SOURCE_ID,
                "quote": quote,
                "unitQuote": "Amounts in millions of USD.",
                "dateQuote": "As of September 26, 2026.",
            }
            for id_, metric, value, token, basis, quote in rows
        ],
        "calculations": [
            {
                "id": "debt",
                "label": "Debt principal total",
                "operation": "sum",
                "inputs": ["term", "cp"],
                "basis": "principal",
                "claimedValue": "80111000000",
                "decimals": 0,
            },
            {
                "id": "coverage",
                "label": "Assets/debt",
                "operation": "ratio",
                "inputs": ["assets", "debt"],
                "basis": "fair_value/principal",
                "claimedValue": "1.71",
                "decimals": 2,
            },
        ],
    }


def verify(data):
    return verify_financials(
        FinancialEvidence.model_validate(data), {SOURCE_ID: SOURCE}
    )


def test_principal_total_and_ratio_corrected_not_book_amount():
    result = verify(payload())
    assert [c["value"] for c in result["calculations"]] == ["80675000000", "1.70"]
    assert all(c["status"] == "corrected" for c in result["calculations"])
    rendered = safe_report(
        "회사 개요입니다.\n\n원금 부채는 USD 80111000000, 비율 1.71입니다.", result, []
    )
    assert "회사 개요입니다." in rendered and "80111000000" not in rendered
    assert "80675000000" in rendered and "기존 제시값을 검산값으로 정정" in rendered


@pytest.mark.parametrize(
    ("change", "error"),
    [
        ({"basis": "carrying"}, "ambiguous_basis_quote"),
        (
            {"quote": "Term debt principal 78,678.\nTerm debt carrying amount 78,114."},
            "ambiguous_basis_quote",
        ),
        ({"value": "78114"}, "value_token_mismatch"),
        ({"valueToken": "8,678"}, "value_not_in_quote"),
        ({"currency": "EUR"}, "currency_not_in_quote"),
        ({"scale": "billions"}, "unit_not_in_quote"),
        ({"asOf": "2025-09-26"}, "date_not_in_quote"),
        ({"sourceId": "invented"}, "source_quote_not_found"),
    ],
)
def test_source_value_basis_unit_date_fail_closed(change, error):
    data = payload()
    data["facts"][0].update(change)
    result = verify(data)
    assert result["facts"][0]["error"] == error
    assert result["calculations"][0]["value"] is None
    assert result["calculations"][1]["error"] == "unverified_or_forward_input"


def test_mixed_basis_rejected_not_relabelled():
    data = payload()
    data["calculations"][0]["inputs"] = ["book", "cp"]
    assert verify(data)["calculations"][0]["error"] == "basis_mismatch"


def test_cross_date_zero_duplicate_and_currency_rejected():
    data = payload()
    data["calculations"][0]["inputs"] = ["term", "term"]
    assert verify(data)["calculations"][0]["error"] == "duplicate_input"
    data = payload()
    data["calculations"][1]["basis"] = "fair_value/carrying"
    assert verify(data)["calculations"][1]["error"] == "ratio_basis_mismatch"


def test_years_and_share_counts_do_not_trigger_monetary_guard():
    assert not financial_scope("Founded in 1976. There are 100 shares.")
    assert not financial_scope("Debt refinancing began in 2026.")
    assert financial_scope("Debt is USD 100 million.")
    assert financial_scope("안전자산 대비 1.71배")


def test_different_company_values_and_unit_conversion():
    data = deepcopy(payload())
    data["calculations"] = [
        {
            "id": "total",
            "label": "Total",
            "operation": "sum",
            "inputs": ["term", "cp"],
            "basis": "principal",
            "decimals": 0,
        }
    ]
    data["facts"][0].update(
        value="10",
        valueToken="10",
        quote="Term debt principal 10.",
        scale="billions",
        unitQuote="USD billions",
    )
    evidence = FinancialEvidence.model_validate(data)
    result = verify_financials(
        evidence, {SOURCE_ID: SOURCE + "\nTerm debt principal 10. USD billions"}
    )
    assert result["calculations"][0]["value"] == "11997000000"
