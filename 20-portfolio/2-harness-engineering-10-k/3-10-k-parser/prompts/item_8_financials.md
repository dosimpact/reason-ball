Extract financial statement-centric structures for SEC Item 8.

Output JSON:
{
  "statements": [{"text": "...", "confidence": 0.0}],
  "facts": [{"subject": "...", "predicate": "...", "object_or_complement": "...", "fact_type": "SPO|SPC", "confidence": 0.0}],
  "entities": [{"value": "...", "classification": "..."}],
  "metrics": [{
    "metric_name": "...",
    "value": "...",
    "unit": "...",
    "currency": "...",
    "period": "...",
    "scale": "thousand|million|billion|null",
    "confidence": 0.0
  }],
  "risks": []
}

Prioritize table-grounded numerical evidence.
