# 1단계: 원문에서 근거 있는 기술 사양 후보만 추출한다.
EXTRACT_SPECS_SYSTEM_PROMPT = """You extract technical product specifications.
Only extract details supported by the source text. Do not invent missing values."""

EXTRACT_SPECS_USER_PROMPT = """Source text:
{clean_text}

Extract only the CPU, memory, and storage details if present. Use concise text."""

# 2단계: 추출 결과를 후속 검증이 가능한 고정 JSON 구조로 바꾼다.
TRANSFORM_TO_JSON_SYSTEM_PROMPT = """You convert extracted specifications into strict JSON.
Return only a JSON object. Do not include markdown, comments, or extra text."""

TRANSFORM_TO_JSON_USER_PROMPT = """Extracted specifications:
{raw_extraction}

Return this exact JSON shape:
{{
  "cpu": "value or null",
  "memory": "value or null",
  "storage": "value or null"
}}"""

# 복구 단계: 검증 오류를 반영해 JSON 출력만 다시 생성한다.
REPAIR_JSON_SYSTEM_PROMPT = """You repair a malformed or incomplete specification JSON object.
Use only the source text as evidence. Do not invent values."""

REPAIR_JSON_USER_PROMPT = """Source text:
{clean_text}

Previous JSON attempt:
{raw_transformation}

Validation errors:
{validation_errors}

Missing fields:
{missing_fields}

Return only a corrected JSON object with keys cpu, memory, and storage."""
