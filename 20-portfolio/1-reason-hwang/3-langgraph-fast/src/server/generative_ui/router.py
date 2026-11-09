"""AG-UI events without CopilotKit; commit successful final outputs atomically."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import aclosing
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from domains.generative_ui.actions import allowed_actions
from domains.generative_ui.contracts import ActionError, Mode, UIRequest, validate_action
from graph.provider.ui_model import ModelSettings
from graph.primary_graphs.generative_ui.workflow import build_ui_graph
from server.generative_ui.gate import StreamGate
from server.sec_chat.activity_stream import activity_stream

router = APIRouter(prefix='/api/generative-ui', tags=['OpenUI'])
sessions: dict[str, dict] = {}
gate = StreamGate()
logger = logging.getLogger(__name__)


def event(kind: str, **values) -> str:
    return 'data: ' + json.dumps({'type': kind, **values}, ensure_ascii=False) + '\n\n'


def create_graph(mode):
    return build_ui_graph(mode, ModelSettings.from_env().build())


@router.post('/{mode}')
async def run(mode: Mode, body: UIRequest):
    key = f'{mode}:{body.thread_id}'
    lease = gate.reserve(key)
    await lease.__aenter__()
    try:
        now = time.monotonic()
        for expired in [item for item, value in sessions.items() if now - value['touched'] > 3600 and item not in gate.threads]:
            sessions.pop(expired)
        previous = sessions.get(key, {}).get('state', {})
        if body.action:
            validate_action(body.action, previous.get('revision', 0), allowed_actions(mode, previous.get('data', {})))
        # Include in-flight new sessions: they have not committed state yet.
        if key not in sessions and len(set(sessions) | gate.threads) > 200:
            raise HTTPException(429, 'Session capacity exceeded')
        graph = create_graph(mode)
    except BaseException as error:
        await lease.__aexit__(type(error), error, error.__traceback__)
        if isinstance(error, (ActionError, ValueError)):
            raise HTTPException(422, str(error)) from error
        raise

    async def stream():
        run_id = uuid4().hex
        try:
            yield event('RUN_STARTED', threadId=body.thread_id, runId=run_id)
            async def operation(sink):
                sink({'id': run_id, 'label': '업무 처리 및 OpenUI 생성', 'status': 'running'})
                async with asyncio.timeout(900):
                    result = await graph.ainvoke({**previous, 'question': (previous.get('question', '') if body.action else body.message), 'action': body.action.model_dump() if body.action else None})
                sink({'id': run_id, 'label': '업무 처리 및 OpenUI 생성', 'status': 'completed'})
                return result
            async with aclosing(activity_stream(operation)) as updates:
                async for kind, payload in updates:
                    if kind == 'heartbeat':
                        yield ': heartbeat\n\n'
                    elif kind == 'activity':
                        yield event('CUSTOM', name='ui.activity', value=payload)
                    elif kind == 'result':
                        sessions[key] = {'state': payload, 'touched': time.monotonic()}
                        yield event('CUSTOM', name='ui.output', value={field: payload[field] for field in ('program', 'controls', 'revision')})
            yield event('RUN_FINISHED', threadId=body.thread_id, runId=run_id)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error('Generative UI %s failed (%s)', mode, type(error).__name__)
            yield event('RUN_ERROR', message='화면을 생성하지 못했습니다. 입력과 모델 설정을 확인하고 다시 시도해 주세요.')
        finally:
            await lease.__aexit__(None, None, None)
    return StreamingResponse(stream(), media_type='text/event-stream', headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})
