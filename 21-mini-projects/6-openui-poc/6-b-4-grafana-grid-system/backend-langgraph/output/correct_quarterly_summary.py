import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/quarterly-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  thread=json.loads((ROOT/'thread.json').read_text())['thread_id']
  print('thread',thread,flush=True)
  questions=['위험 요인 요약의 예외 조건을 다시 확인해줘. 34쪽 도입부는 아래에 제시한 위험 요인을 제외하면 이전 공시 대비 중요한 변경이 없다는 뜻인지 원문을 다시 읽어줘. 전체 위험 요인에 변경이 전혀 없다는 표현은 바로잡고, 법적 절차는 Note 10 참조 안내와 원문에서 직접 확인한 내용만 말해줘. 모니터링 중이라는 추정은 빼줘. Canvas는 유지해줘.']
  for i,q in enumerate(questions,6):
   events=[]
   async with c.stream('POST',BASE+'/dashboard/chat',json={'threadId':thread,'messages':[{'role':'user','content':q}]}) as r:
    r.raise_for_status()
    async for line in r.aiter_lines():
     if line.startswith('data: '):events.append(json.loads(line[6:]))
   state=(await c.get(BASE+'/dashboard/state/'+thread)).json()
   (ROOT/f'turn-{i}-events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2));(ROOT/f'turn-{i}-state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
   diag=diagnostics.latest(thread);(ROOT/f'turn-{i}-diagnostics.json').write_text(json.dumps(diag,ensure_ascii=False,indent=2))
   print('turn',i,'panels',len(state['panels']),'errors',[e for e in events if e['type']=='RUN_ERROR'],'missing',diag.get('missing') if diag else None,flush=True)
   if i==1 and state['panels']:raise AssertionError('Unrequested Canvas mutation')
   if i>1 and len(state['panels'])!=1:raise AssertionError('Missing requested panel')
  await c.patch(BASE+'/threads/update/'+thread,json={'title':'[실데이터 검토] 10-Q 분기와 누적 실적'})
  (ROOT/'messages.json').write_text(json.dumps((await c.get(BASE+'/threads/get/'+thread)).json(),ensure_ascii=False,indent=2))
asyncio.run(main())
