"""Authoritative company lookup without model-selected query changes."""
from __future__ import annotations

import logging
import re
from uuid import uuid4

from langchain_core.messages import ToolMessage

from domains.sec_tools.tools import build_sec_tools
from domains.tenk.sec_client import SecReadError

logger = logging.getLogger(__name__)


def _words(value):
    return re.findall(r'[^\W_]+', value.casefold())


def _leading_match(name, query):
    prefix = _words(query)
    return bool(prefix) and _words(name)[:len(prefix)] == prefix


def _listing(value):
    if not isinstance(value, dict) or not isinstance(value.get('items'), list):
        raise SecReadError('기업 검색 응답 형식이 올바르지 않습니다.')
    for row in value['items']:
        if (not isinstance(row, dict) or not isinstance(row.get('cik'), str)
                or not re.fullmatch(r'\d{10}', row['cik'])
                or not isinstance(row.get('name'), str) or not row['name'].strip()
                or 'ticker' not in row
                or not (row.get('ticker') is None or isinstance(row.get('ticker'), str))):
            raise SecReadError('기업 검색 식별자를 확인하지 못했습니다.')
    pagination = value.get('pagination', {})
    if not isinstance(pagination, dict) or not isinstance(pagination.get('hasNextPage', False), bool):
        raise SecReadError('기업 검색 페이지 정보를 확인하지 못했습니다.')
    return value['items'], pagination.get('hasNextPage', False)


async def search_companies(query, model, client=None, activity=None):
    """Keep the model parameter for compatibility; use the confirmed query only."""
    try:
        if not isinstance(query, str) or not query.strip() or len(query.strip()) > 150:
            raise SecReadError('기업명이나 티커를 150자 이내로 입력해 주세요.')
        query = query.strip()
        tool = next(tool for tool in build_sec_tools(client, activity, include_tool_details=True)
                    if tool.name == 'search_sec_companies')

        async def invoke(args):
            message = await tool.ainvoke({'name': tool.name, 'id': uuid4().hex,
                                         'type': 'tool_call', 'args': args})
            if not isinstance(message, ToolMessage) or not isinstance(message.artifact, dict):
                raise SecReadError('기업 검색 도구 완료를 확인하지 못했습니다.')
            artifact = message.artifact
            if artifact.get('tool') != tool.name:
                raise SecReadError('기업 검색 도구 결과가 올바르지 않습니다.')
            result = artifact.get('result')
            if not isinstance(result, dict):
                raise SecReadError('기업 검색 응답 형식이 올바르지 않습니다.')
            rows, more = _listing(result)
            return result, rows, more

        if re.fullmatch(r'[A-Za-z][A-Za-z0-9.-]{0,9}', query):
            result, rows, _ = await invoke({'ticker': query.upper(), 'page': 1, 'pageSize': 100})
            if rows:
                if any((row.get('ticker') or '').casefold() != query.casefold() for row in rows):
                    raise SecReadError('정확한 티커 검색 범위를 확인하지 못했습니다.')
                return result
        accumulated = {}
        result = {}
        more = False
        for page in range(1, 6):
            result, rows, more = await invoke({'q': query, 'page': page, 'pageSize': 100})
            for row in rows:
                accumulated[row['cik']] = row
            matches = [row for row in accumulated.values() if _leading_match(row['name'], query)]
            if matches:
                return {**result, 'items': matches}
            if not more:
                break
        # Retain pagination evidence when the bounded search leaves further pages.
        if more and not accumulated:
            raise SecReadError('기업 검색 페이지 한도에 도달했습니다. 기업명을 더 구체적으로 입력해 주세요.')
        return {**result, 'items': list(accumulated.values())}
    except Exception as error:
        logger.warning('SEC company lookup failure exception=%s', type(error).__name__)
        raise
