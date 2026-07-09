from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import httpx

SEC_DATA_BASE = "https://data.sec.gov"
SEC_WWW_BASE = "https://www.sec.gov"


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch one SEC filing report for parser smoke tests.")
    parser.add_argument("--ticker", required=True)
    parser.add_argument("--form", default="10-K")
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata-output", required=True)
    parser.add_argument("--timeout-sec", type=float, default=30.0)
    args = parser.parse_args()

    user_agent = os.getenv("SEC_USER_AGENT", "").strip()
    if not user_agent:
        raise SystemExit("SEC_USER_AGENT is required, e.g. SEC_USER_AGENT='name email@example.com'")

    headers = {"User-Agent": user_agent, "Accept-Encoding": "gzip, deflate"}
    with httpx.Client(headers=headers, timeout=args.timeout_sec, follow_redirects=True) as client:
        company = _find_company(client, args.ticker)
        filing = _find_recent_filing(client, company["cik_str"], args.form)
        accession_no = filing["accessionNumber"]
        accession_path = accession_no.replace("-", "")
        primary_doc = filing["primaryDocument"]
        report_url = f"{SEC_WWW_BASE}/Archives/edgar/data/{int(company['cik_str'])}/{accession_path}/{primary_doc}"
        response = client.get(report_url)
        response.raise_for_status()

    output = Path(args.output)
    metadata_output = Path(args.metadata_output)
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(response.text, encoding="utf-8")
    metadata = {
        "report_id": accession_no,
        "company_name": company["title"],
        "ticker": args.ticker.upper(),
        "report_type": filing["form"],
        "source_url": report_url,
        "filing_date": filing.get("filingDate"),
        "accession_no": accession_no,
        "cik": str(company["cik_str"]).zfill(10),
        "primary_doc": primary_doc,
    }
    metadata_output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "ok", "report": str(output), "metadata": str(metadata_output), **metadata}, indent=2))
    return 0


def _find_company(client: httpx.Client, ticker: str) -> dict[str, Any]:
    response = client.get(f"{SEC_WWW_BASE}/files/company_tickers.json")
    response.raise_for_status()
    companies = response.json()
    target = ticker.upper()
    for row in companies.values():
        if str(row.get("ticker", "")).upper() == target:
            return row
    raise RuntimeError(f"ticker not found in SEC company_tickers.json: {ticker}")


def _find_recent_filing(client: httpx.Client, cik: int | str, form: str) -> dict[str, Any]:
    padded_cik = str(cik).zfill(10)
    response = client.get(f"{SEC_DATA_BASE}/submissions/CIK{padded_cik}.json")
    response.raise_for_status()
    recent = response.json()["filings"]["recent"]
    forms = recent.get("form") or []
    for idx, form_type in enumerate(forms):
        if form_type == form:
            return {key: values[idx] for key, values in recent.items() if isinstance(values, list) and idx < len(values)}
    raise RuntimeError(f"no recent {form} filing found for CIK {padded_cik}")


if __name__ == "__main__":
    raise SystemExit(main())
