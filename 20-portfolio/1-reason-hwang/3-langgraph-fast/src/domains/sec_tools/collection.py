"""Execute an explicitly confirmed selected-company collection exactly once."""
from __future__ import annotations

import logging
from uuid import uuid4

from langchain_core.messages import ToolMessage

from domains.sec_tools.tools import SelectedSyncInput, build_sec_tools
from domains.tenk.sec_client import SecReadError

logger = logging.getLogger(__name__)
COUNTERS = ('companiesProcessed', 'filingsSynced', 'downloaded', 'failed')


async def collect_company_filings(cik, years, since, model, client=None, activity=None):
    """The compatibility model argument never controls this confirmed write."""
    try:
        expected = SelectedSyncInput(
            ciks=[cik], years=years, since=since, downloadDocuments=True,
            refreshArchive=False, tickers=[],
        ).model_dump(exclude_none=True)
        tool = next(tool for tool in build_sec_tools(
            client, activity, allowed_ciks={cik}, required_sync_args=expected,
            include_tool_details=True,
        ) if tool.name == 'sync_sec_company_filings')
        message = await tool.ainvoke({
            'name': tool.name, 'id': uuid4().hex, 'type': 'tool_call', 'args': expected,
        })
        if not isinstance(message, ToolMessage) or not isinstance(message.artifact, dict):
            raise SecReadError('선택 기업 공시 수집 도구 완료를 확인하지 못했습니다.')
        artifact = message.artifact
        if artifact.get('tool') != tool.name or artifact.get('args') != expected:
            raise SecReadError('선택 기업 공시 수집 범위를 확인하지 못했습니다.')
        completed = artifact.get('result')
        if not isinstance(completed, dict) or any(
            not isinstance(completed.get(key), int) or isinstance(completed[key], bool) or completed[key] < 0
            for key in COUNTERS
        ) or completed['companiesProcessed'] != 1 or completed['failed'] != 0:
            raise SecReadError('선택 기업 공시 수집 결과가 불완전합니다.')
        if not isinstance(completed.get('checkedAt'), str) or not completed['checkedAt'].strip():
            raise SecReadError('선택 기업 공시 수집 완료 시각을 확인하지 못했습니다.')
        return {
            'cik': cik, 'years': years, 'since': since,
            **{key: completed[key] for key in COUNTERS}, 'checkedAt': completed['checkedAt'],
        }
    except Exception as error:
        logger.warning('SEC collection failure exception=%s', type(error).__name__)
        raise
