LOCATION_PARSE_SYSTEM_PROMPT = """You extract location lookup arguments.
Return only JSON. Do not include markdown, prose, or extra keys."""

LOCATION_PARSE_USER_PROMPT = """User location request:
{normalized_query}

Extract:
- address: the most precise address or place string to use for exact lookup.
- city: the broader city, neighborhood, or area to use if exact lookup fails.

Return this JSON shape:
{{
  "address": "precise address or place, or null",
  "city": "broader city or area, or null"
}}"""
