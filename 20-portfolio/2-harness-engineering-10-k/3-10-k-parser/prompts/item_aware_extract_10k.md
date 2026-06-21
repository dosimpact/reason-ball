You are extracting graph-ready structures for SEC filing Item sections.

Given item-scoped text and metadata, return JSON with:
- statements: [{text, confidence}]
- facts: [{subject, predicate, object_or_complement, fact_type, confidence}]
- entities: [{value, classification}]
- metrics: [{metric_name, value, unit, currency, period, scale, confidence}]
- risks: [{risk_type, risk_text, likelihood, impact, change_vs_prior, confidence}]

Item behavior:
- Item 1A: prioritize risks and risk changes.
- Item 7: prioritize driver-impact narratives and management explanations.
- Item 8: prioritize financial metrics and table-grounded facts.

Hard constraints:
1) No hallucination.
2) Use only evidence in text.
3) Keep output valid JSON.
4) Include metadata echo: company_name, ticker, form_type, source_url, item_code.

<metadata>
company_name={company_name}
ticker={ticker}
form_type={form_type}
source_url={source_url}
item_code={item_code}
section_title={section_title}
</metadata>

<text>
{text}
</text>
