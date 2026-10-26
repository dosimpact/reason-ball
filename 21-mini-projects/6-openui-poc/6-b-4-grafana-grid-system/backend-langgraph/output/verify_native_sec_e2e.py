import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/native-sec-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  r=await c.post(BASE+'/threads/create',json={'messages':[{'role':'user','content':'[실데이터 검증] 자체 SEC 수집과 캐시'}]});r.raise_for_status();thread=r.json()['id'];(ROOT/'thread.json').write_text(json.dumps({'thread_id':thread}))
  print('thread',thread,flush=True)
  questions=['애플 AAPL의 최근 3년 10-K와 최근 1년 10-Q를 SEC 수집 도구로 준비하고 보고서별 종류, 기간, 원문 링크와 수집 상태를 채팅에 보여줘. 이미 저장한 원문은 재사용해줘. Canvas는 변경하지 마.', 'SEC Company Facts를 이용해 애플의 최근 3년 매출과 YoY를 financial 패널 하나로 Canvas에 추가해줘. 공식 SEC 출처와 기간, USD 단위를 표시하고 새로고침 가능한 패널로 만들어줘. 준비 PDF 수치로 대신하지 마.', '같은 애플 매출 패널에서 FY2024만 제외해줘. 패널 ID와 배치는 유지하고 새 패널은 만들지 마.']
  for i,q in enumerate(questions,1):
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
  await c.patch(BASE+'/threads/update/'+thread,json={'title':'[실데이터 검증] 자체 SEC 수집과 캐시'})
  (ROOT/'messages.json').write_text(json.dumps((await c.get(BASE+'/threads/get/'+thread)).json(),ensure_ascii=False,indent=2))
asyncio.run(main())
