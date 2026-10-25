import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/publication-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  r=await c.post(BASE+'/threads/create',json={'messages':[{'role':'user','content':'[회귀 검증] 단일 분기 패널 게시'}]});r.raise_for_status();thread=r.json()['id'];(ROOT/'thread.json').write_text(json.dumps({'thread_id':thread}))
  print('thread',thread,flush=True)
  questions=['준비된 nvidia-2027-q2 PDF3쪽 원문에서 FY2026 Q2와 FY2027 Q2의 3개월 매출을 비교해줘. 분기 차트는 두 분기의 두 점만 표시하고, 6개월 누적 매출은 별도 표로 보여줘. 단위는 백만 USD, 회계연도와 실제 종료일 및 공식 IR PDF 출처를 명시해줘. 추가 네트워크 수집은 하지 마.', '방금 분기 차트와 누적 표를 같은 Canvas 패널 정확히 1개에 담아줘. 제목은 NVIDIA 분기 매출 검토로 해줘.', '같은 패널의 제목을 NVIDIA 분기·누적 매출 검토로 바꿔줘. 다른 내용과 배치는 유지해줘.']
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
  await c.patch(BASE+'/threads/update/'+thread,json={'title':'[회귀 검증] 단일 분기 패널 게시'})
  (ROOT/'messages.json').write_text(json.dumps((await c.get(BASE+'/threads/get/'+thread)).json(),ensure_ascii=False,indent=2))
asyncio.run(main())
