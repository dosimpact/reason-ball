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
  questions=['같은 제목과 내용의 패널이 두 개 생겼어. 중복 패널 8895c0ea-c5ff-4451-bc2e-899612eafc17만 삭제해줘. 패널 6ef02a5c-767d-4bca-9798-9789d2b2fa31은 그대로 유지해줘. 새 패널은 추가하지 마.', '같은 보고서 nvidia-2027-q2의 34쪽에서 Part II Item 1 법적 절차와 Item 1A 위험 요인 도입부를 확인해 각각 짧게 요약해줘. 재무제표 Item 1과 구분하고 이번에 읽은 페이지 범위만 명시해줘. Canvas는 변경하지 마.']
  for i,q in enumerate(questions,4):
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
