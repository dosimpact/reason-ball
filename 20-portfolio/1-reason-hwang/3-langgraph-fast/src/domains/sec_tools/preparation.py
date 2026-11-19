"""Deterministic saved-filing preparation through observable SEC tools."""
from __future__ import annotations

import logging
from uuid import uuid4

from langchain_core.messages import ToolMessage

from domains.sec_chat.source import PREDECESSORS, prepare_source
from domains.sec_tools.tools import ContentInput, build_sec_tools
from domains.tenk.sec_client import SecReadError

logger = logging.getLogger(__name__)


def _filings(result, cik):
    if not isinstance(result, dict) or not isinstance(result.get('items'), list):
        raise SecReadError('공시 목록 응답 형식이 올바르지 않습니다.')
    rows = result['items']
    for row in rows:
        if not isinstance(row, dict) or row.get('cik') != cik or row.get('formType') != '10-K':
            raise SecReadError('요청 기업의 10-K 목록 범위를 확인하지 못했습니다.')
        if not isinstance(row.get('filingDate'), str) or not row['filingDate']:
            raise SecReadError('공시 일자를 확인하지 못했습니다.')
        accession = row.get('accessionNo')
        if not isinstance(accession, str):
            raise SecReadError('공시 식별자를 확인하지 못했습니다.')
        try:
            ContentInput(cik=cik, accessionNo=accession)
        except ValueError as error:
            raise SecReadError('공시 식별자를 확인하지 못했습니다.') from error
    return rows


def _checked_at(result):
    counters = ('companiesProcessed', 'filingsSynced', 'downloaded', 'failed')
    if not isinstance(result, dict) or any(
        not isinstance(result.get(key), int) or isinstance(result[key], bool) or result[key] < 0
        for key in counters
    ) or result['companiesProcessed'] != 1 or result['failed'] != 0:
        raise SecReadError('최신 공시 동기화 완료를 확인하지 못했습니다.')
    if not isinstance(result.get('checkedAt'), str) or not result['checkedAt']:
        raise SecReadError('최신 공시 동기화 시각을 확인하지 못했습니다.')
    return result['checkedAt']


async def prepare_filing(cik, refresh, model, client=None, activity=None):
    """Keep the model parameter for callers; preparation has no model decisions."""
    allowed = {cik, PREDECESSORS.get(cik, cik)}
    tools = {tool.name: tool for tool in build_sec_tools(
        client, activity, allowed_ciks=allowed, allow_sync=refresh, include_tool_details=True,
    )}
    records = []

    async def invoke(name, args):
        try:
            message = await tools[name].ainvoke({
                'name': name, 'id': uuid4().hex, 'type': 'tool_call', 'args': args,
            })
            if not isinstance(message, ToolMessage) or not isinstance(message.artifact, dict):
                raise SecReadError('공시 준비 도구 완료를 확인하지 못했습니다.')
            artifact = message.artifact
            if artifact.get('tool') != name or 'result' not in artifact:
                raise SecReadError('공시 준비 도구 결과가 올바르지 않습니다.')
            records.append(artifact)
            return artifact['result']
        except Exception as error:
            logger.warning('SEC preparation stage=%s exception=%s', name, type(error).__name__)
            raise

    async def listing(target):
        checked_at = None
        if refresh:
            checked_at = _checked_at(await invoke('sync_sec_company_filings', {
                'ciks': [target], 'years': 2, 'downloadDocuments': True, 'refreshArchive': False,
            }))
        result = await invoke('list_sec_filings', {
            'cik': target, 'formType': '10-K', 'page': 1, 'pageSize': 10,
            'includeContent': False, 'includeAmendments': False,
            'includeFormerRegistrants': target in PREDECESSORS.values(),
        })
        return _filings(result, target), checked_at

    try:
        target = cik
        rows, checked_at = await listing(target)
        if not rows and cik in PREDECESSORS:
            target = PREDECESSORS[cik]
            rows, checked_at = await listing(target)
        if not rows:
            raise SecReadError('해당 기업의 저장된 10-K가 없습니다.')
        filing = max(rows, key=lambda row: (row['filingDate'], row['accessionNo']))
        if filing.get('status') != 'downloaded':
            raise SecReadError('최신 10-K 원문 다운로드가 완료되지 않았습니다. 공시 수집 후 다시 시도해 주세요.')
        content = await invoke('get_sec_filing_content', {'cik': target, 'accessionNo': filing['accessionNo']})
        if not isinstance(content, str) or not content.strip():
            raise SecReadError('최신 10-K 원문이 비어 있습니다.')
        source = prepare_source(content, filing, checked_at)
    except Exception as error:
        logger.warning('SEC preparation failure exception=%s', type(error).__name__)
        raise
    if target != cik:
        source['requestedCik'] = cik
        source['issuerNote'] = f'법인 재편: 선택 CIK {cik}의 자체 10-K가 없어, 확인된 이전 법인 CIK {target}의 최신 10-K를 사용합니다.'
    source['toolCalls'] = [row['tool'] for row in records]
    return source
