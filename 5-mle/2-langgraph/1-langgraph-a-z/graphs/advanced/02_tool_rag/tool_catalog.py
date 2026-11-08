"""
Tool 50+ 개 — 동적으로 mock tool 들을 생성하는 카탈로그.

카테고리 (각 카테고리당 5~10개) → 총 약 60개:
- weather_<city>      : 도시별 날씨 (10개)
- calc_<op>           : 사칙연산 etc (8개)
- db_query_<table>    : DB 조회 mock (8개)
- translate_<lang>    : 번역 mock (8개)
- news_<category>     : 뉴스 토픽 (8개)
- stock_<symbol>      : 주가 mock (8개)
- search_<engine>     : 검색 mock (5개)
- image_<op>          : 이미지 처리 mock (5개)

각 tool 은 동일한 시그니처: `(query: str | None = None) -> str`.
실제 외부 호출 없이 deterministic 한 더미 문자열 반환.

또한 각 tool 의 (name, description, examples) 를 모아둔 카탈로그 메타데이터를 노출합니다.
"""
from __future__ import annotations

from typing import Callable

from langchain_core.tools import BaseTool, tool


def _make_simple(name: str, desc: str, response_template: str) -> BaseTool:
    """이름·설명·응답 포맷만 다른 단순 mock tool 생성."""

    @tool(name, description=desc)
    def _t(query: str = "") -> str:
        return response_template.format(query=query or "(no input)")

    return _t


# ---------------------------------------------------------------------------
# 카탈로그 정의 (name, description, examples)
# ---------------------------------------------------------------------------
_WEATHER_CITIES = [
    ("seoul", "서울"), ("tokyo", "도쿄"), ("busan", "부산"), ("osaka", "오사카"),
    ("newyork", "뉴욕"), ("london", "런던"), ("paris", "파리"), ("beijing", "베이징"),
    ("singapore", "싱가포르"), ("sydney", "시드니"),
]
_CALC_OPS = [
    ("add", "두 숫자를 더합니다"),
    ("sub", "두 숫자를 뺍니다"),
    ("mul", "두 숫자를 곱합니다"),
    ("div", "두 숫자를 나눕니다"),
    ("pow", "거듭제곱을 계산합니다"),
    ("mod", "나머지를 계산합니다"),
    ("sqrt", "제곱근을 계산합니다"),
    ("abs", "절댓값을 계산합니다"),
]
_DB_TABLES = [
    "users", "orders", "products", "payments",
    "shipments", "reviews", "inventory", "campaigns",
]
_TRANSLATE_LANGS = [
    ("en", "영어"), ("ko", "한국어"), ("ja", "일본어"), ("zh", "중국어"),
    ("es", "스페인어"), ("fr", "프랑스어"), ("de", "독일어"), ("vi", "베트남어"),
]
_NEWS_CATEGORIES = [
    "tech", "sports", "politics", "economy",
    "entertainment", "science", "health", "world",
]
_STOCK_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN",
    "NVDA", "TSLA", "005930", "035420",
]
_SEARCH_ENGINES = ["google", "naver", "bing", "duckduckgo", "kagi"]
_IMAGE_OPS = ["resize", "crop", "rotate", "blur", "ocr"]


def _build_catalog() -> tuple[list[BaseTool], list[dict[str, str]]]:
    tools: list[BaseTool] = []
    meta: list[dict[str, str]] = []

    for code, name_ko in _WEATHER_CITIES:
        n = f"weather_{code}"
        d = f"{name_ko}({code})의 현재 날씨와 기온을 조회합니다. 도시 단위 날씨 정보."
        ex = f"{name_ko} 날씨 알려줘 / weather in {code} / 내일 {name_ko} 비 와?"
        tools.append(_make_simple(n, d, f"[mock] {name_ko} 현재 날씨: 맑음, 22도"))
        meta.append({"name": n, "description": d, "examples": ex})

    for op, desc in _CALC_OPS:
        n = f"calc_{op}"
        ex = f"{op} 두 숫자 / calculator {op}"
        tools.append(_make_simple(n, desc, f"[mock] calc_{op} 결과: 42"))
        meta.append({"name": n, "description": desc, "examples": ex})

    for tbl in _DB_TABLES:
        n = f"db_query_{tbl}"
        d = f"내부 DB 의 {tbl} 테이블을 조회합니다. 비즈니스 데이터 SELECT 용."
        ex = f"{tbl} 테이블에서 최근 데이터 보여줘 / list {tbl}"
        tools.append(_make_simple(n, d, f"[mock] {tbl} rows: [...]"))
        meta.append({"name": n, "description": d, "examples": ex})

    for code, lang in _TRANSLATE_LANGS:
        n = f"translate_{code}"
        d = f"입력 텍스트를 {lang}({code})로 번역합니다."
        ex = f"이거 {lang}로 번역해줘 / translate to {code}"
        tools.append(_make_simple(n, d, f"[mock] {lang} 번역: ..."))
        meta.append({"name": n, "description": d, "examples": ex})

    for cat in _NEWS_CATEGORIES:
        n = f"news_{cat}"
        d = f"{cat} 카테고리의 최신 뉴스 헤드라인을 가져옵니다."
        ex = f"{cat} 뉴스 / latest {cat} news"
        tools.append(_make_simple(n, d, f"[mock] {cat} headlines: [...]"))
        meta.append({"name": n, "description": d, "examples": ex})

    for sym in _STOCK_SYMBOLS:
        n = f"stock_{sym.lower()}"
        d = f"{sym} 종목의 현재가와 변동률을 조회합니다."
        ex = f"{sym} 주가 / {sym} stock price"
        tools.append(_make_simple(n, d, f"[mock] {sym} price: $123.45 (+1.2%)"))
        meta.append({"name": n, "description": d, "examples": ex})

    for eng in _SEARCH_ENGINES:
        n = f"search_{eng}"
        d = f"{eng} 검색 엔진에서 웹 검색 결과를 가져옵니다."
        ex = f"{eng}에서 검색해줘 / search with {eng}"
        tools.append(_make_simple(n, d, f"[mock] {eng} results: [...]"))
        meta.append({"name": n, "description": d, "examples": ex})

    for op in _IMAGE_OPS:
        n = f"image_{op}"
        d = f"이미지에 대해 {op} 작업을 수행합니다."
        ex = f"이미지 {op} 해줘 / image {op}"
        tools.append(_make_simple(n, d, f"[mock] image {op} done"))
        meta.append({"name": n, "description": d, "examples": ex})

    return tools, meta


ALL_TOOLS, CATALOG = _build_catalog()
TOOLS_BY_NAME: dict[str, BaseTool] = {t.name: t for t in ALL_TOOLS}

__all__ = ["ALL_TOOLS", "CATALOG", "TOOLS_BY_NAME"]
