"""Independent graph endpoint; standard LangGraph entry is also in langgraph.json."""
from __future__ import annotations

import asyncio
from contextlib import aclosing
from typing import cast

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain.agents.middleware.types import InputAgentState
from langchain_core.messages import AIMessage, HumanMessage

from domains.sec_chat.conversation import ConversationRequest
from domains.sec_tools.agent import artifacts
from graph.primary_graphs.sec_deep_agent.workflow import build_sec_deep_agent
from server.sec_chat.activity_stream import activity_stream
from server.sec_chat.router import event

router = APIRouter(prefix='/api/sec-deep-agent', tags=['SEC Deep Agent'])


async def research(body, sink=None):
    messages = [HumanMessage(content=item.text) if item.role == 'user' else AIMessage(content=item.text) for item in body.history]
    messages.append(HumanMessage(content=body.message))
    result = await asyncio.wait_for(build_sec_deep_agent(activity=sink).ainvoke(cast(InputAgentState, {'messages': messages}), {'recursion_limit': 80}), timeout=900)
    final = result['messages'][-1]
    if not isinstance(final, AIMessage) or final.tool_calls:
        raise ValueError('Agent did not finish its report')
    calls = artifacts(result)
    sources = {}
    for record in calls:
        if record['tool'] == 'list_sec_filings':
            for row in record['result']['items']:
                sources[(row['cik'], row['accessionNo'])] = {key: row.get(key) for key in ('cik', 'accessionNo', 'formType', 'filingDate', 'filingUrl')}
    read = {(row['args']['cik'], row['args']['accessionNo']) for row in calls if row['tool'] == 'get_sec_filing_content'}
    return {'report': final.text, 'toolCalls': [{'name': row['tool'], 'args': row['args']} for row in calls],
            'sources': [value for key, value in sources.items() if key in read]}


@router.post('/research')
async def run_research(body: ConversationRequest, request: Request):
    if not body.message.strip() or body.threadId:
        raise HTTPException(422, 'Provide a message and optional history; this endpoint does not use SEC Chat threadId.')
    if 'text/event-stream' in request.headers.get('accept', ''):
        async def stream():
            yield event('RUN_STARTED')
            try:
                async with aclosing(activity_stream(lambda sink: research(body, sink))) as updates:
                    async for kind, payload in updates:
                        if kind == 'activity':
                            yield event('CUSTOM', name='sec.activity', value=payload)
                        elif kind == 'heartbeat':
                            yield ': heartbeat\n\n'
                        elif kind == 'result':
                            yield event('CUSTOM', name='sec.report', value=payload)
                yield event('RUN_FINISHED')
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - sanitized SSE boundary
                yield event('RUN_ERROR', code='SEC_DEEP_AGENT_FAILED', message='SEC 리서치를 완료하지 못했습니다.')
        return StreamingResponse(stream(), media_type='text/event-stream')
    try:
        return await research(body)
    except Exception as error:
        raise HTTPException(502, 'SEC 리서치를 완료하지 못했습니다.') from error
