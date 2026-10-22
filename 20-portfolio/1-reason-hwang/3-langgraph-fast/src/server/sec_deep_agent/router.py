"""Independent graph endpoint; standard LangGraph entry is also in langgraph.json."""
from __future__ import annotations

import asyncio
import json
from contextlib import aclosing
from typing import Literal, cast
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain.agents.middleware.types import InputAgentState
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, Field

from domains.sec_chat.conversation import ConversationMessage, ConversationRequest
from domains.sec_chat.presentation import compose_ui
from domains.sec_tools.agent import artifacts
from graph.primary_graphs.sec_deep_agent.workflow import build_sec_deep_agent
from graph.primary_graphs.sec_intelligent_ui.workflow import chat_model
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


class ChatMessage(BaseModel):
    role: Literal['user', 'assistant', 'tool', 'system']
    content: str | None = Field(default=None, max_length=60000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    threadId: str = Field(max_length=200)
    runId: str = Field(max_length=200)


@router.post('/chat')
async def chat(body: ChatRequest):
    """OpenUI's native AG-UI transport, sharing the independent research graph."""
    conversation = [m for m in body.messages if m.role in ('user', 'assistant') and m.content]
    if (not conversation or conversation[-1].role != 'user'
            or not conversation[-1].content.strip() or len(conversation[-1].content) > 4000):
        raise HTTPException(422, 'The last conversational message must be a user message.')
    request = ConversationRequest(message=cast(str, conversation[-1].content),
        history=[ConversationMessage(role=cast(Literal['user', 'assistant'], m.role),
                                     text=cast(str, m.content)[:4000]) for m in conversation[-13:-1]])

    async def execute(sink):
        report = await research(request, sink)
        return await compose_ui(request.message, report, chat_model(), host_evidence=False)

    async def stream():
        yield event('RUN_STARTED', threadId=body.threadId, runId=body.runId)
        try:
            async with aclosing(activity_stream(execute)) as updates:
                async for kind, payload in updates:
                    if kind == 'heartbeat':
                        yield ': heartbeat\n\n'
                    elif kind == 'activity':
                        identity = payload['id']
                        if payload['status'] == 'running':
                            yield event('TOOL_CALL_START', toolCallId=identity, toolCallName=payload['label'].split(' · ')[-1])
                            yield event('TOOL_CALL_ARGS', toolCallId=identity, delta=json.dumps(payload.get('arguments', {}), ensure_ascii=False))
                            yield event('TOOL_CALL_END', toolCallId=identity)
                        else:
                            yield event('TOOL_CALL_RESULT', messageId=uuid4().hex, toolCallId=identity, role='tool', isError=payload['status'] != 'completed',
                                content=json.dumps({'status': payload['status'], 'error': payload['status'] != 'completed'}))
                    elif kind == 'result':
                        identity = uuid4().hex
                        yield event('TEXT_MESSAGE_START', messageId=identity, role='assistant')
                        yield event('TEXT_MESSAGE_CONTENT', messageId=identity, delta=payload)
                        yield event('TEXT_MESSAGE_END', messageId=identity)
            yield event('RUN_FINISHED', threadId=body.threadId, runId=body.runId)
        except asyncio.CancelledError:
            raise
        except Exception:
            yield event('RUN_ERROR', code='SEC_ADMIN_FAILED', message='SEC 도구 실행 또는 응답 구성을 완료하지 못했습니다. 다시 시도해 주세요.')
    return StreamingResponse(stream(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache'})
