import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/grounding-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  r=await c.post(BASE+'/threads/create',json={'messages':[{'role':'user','content':'[회귀 검증] 연도 제외와 근거 검사'}]});r.raise_for_status();thread=r.json()['id'];(ROOT/'thread.json').write_text(json.dumps({'thread_id':thread}))
  print('thread',thread,flush=True)
  questions=['로컬 준비 PDF nvidia의 PDF51쪽 원문을 읽고 NVIDIA FY2024~FY2026 매출 차트를 Canvas에 패널 하나로 만들어줘. 제목은 NVIDIA 3년 매출. 회계연도·백만 USD 단위·출처를 명시해줘. SEC 네트워크 요청은 하지 마.', '같은 패널에서 FY2025만 제외해줘.']
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
   if len(state['panels'])!=1:break
  await c.patch(BASE+'/threads/update/'+thread,json={'title':'[회귀 검증] 연도 제외와 근거 검사'})
  (ROOT/'messages.json').write_text(json.dumps((await c.get(BASE+'/threads/get/'+thread)).json(),ensure_ascii=False,indent=2))
asyncio.run(main())
