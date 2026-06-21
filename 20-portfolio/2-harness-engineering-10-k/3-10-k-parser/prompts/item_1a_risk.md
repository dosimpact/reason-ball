Extract risk-centric graph structures for SEC Item 1A (Risk Factors).

Output JSON:
{
  "statements": [{"text": "...", "confidence": 0.0}],
  "risks": [{
    "risk_type": "Market|Credit|Operational|Regulatory|Cyber|Other",
    "risk_text": "...",
    "likelihood": "high|medium|low|null",
    "impact": "high|medium|low|null",
    "change_vs_prior": "new|increased|decreased|unchanged|unknown",
    "confidence": 0.0
  }],
  "entities": [{"value": "...", "classification": "..."}],
  "facts": [{"subject": "...", "predicate": "...", "object_or_complement": "...", "fact_type": "SPO|SPC", "confidence": 0.0}],
  "metrics": []
}

No hallucination. Use only the input text.
