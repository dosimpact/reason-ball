ROUTE_SYSTEM_PROMPT = """You route customer inquiries to one destination.
Return only JSON. Do not include markdown, prose, or extra keys."""

ROUTE_USER_PROMPT = """Customer request:
{normalized_input}

Choose exactly one route:
- order_status: order tracking, delivery, shipment, account/order lookup.
- product_info: product catalog, features, pricing, compatibility, availability.
- technical_support: troubleshooting, device/app failures, setup, connectivity.
- clarify: unclear, unsupported, low-information, or multi-intent requests.

Return this JSON shape:
{{
  "route": "order_status | product_info | technical_support | clarify",
  "reason": "short reason",
  "confidence": 0.0
}}"""
