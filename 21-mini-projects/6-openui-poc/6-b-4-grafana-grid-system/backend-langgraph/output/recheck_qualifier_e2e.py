import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/qualifier-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  r=await c.post(BASE+'/threads/create',json={'messages':[{'role':'user','content':'[회귀 검증] 분기 기간과 위험 요인'}]});r.raise_for_status();thread=r.json()['id'];(ROOT/'thread.json').write_text(json.dumps({'thread_id':thread}))
  print('thread',thread,flush=True)
  questions=['준비된 nvidia-2027-q2 PDF34쪽 원문을 읽고 Part II Item 1 법적 절차와 Item 1A 위험 요인 도입부를 한국어로 짧게 요약해줘. 실제 확인한 페이지와 공식 IR PDF 출처를 표시해줘. 추가 SEC 수집은 하지 마.', '같은 PDF3쪽을 읽고 FY2026 Q2와 FY2027 Q2의 3개월 매출 비교 차트를 Canvas 패널 정확히 1개로 만들어줘. 회계연도와 실제 분기 종료일, 백만 USD 단위와 원문 출처를 명시해줘. 6개월 누적값은 이 분기 차트에 넣지 마. 제목은 NVIDIA 분기 매출로 해줘.', '앞서 읽은 위험 요인 도입부를 바탕으로 이전 공시 대비 변화 여부를 한 문장으로 다시 설명해줘. Canvas는 그대로 유지해줘.']
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
  await c.patch(BASE+'/threads/update/'+thread,json={'title':'[회귀 검증] 분기 기간과 위험 요인'})
  (ROOT/'messages.json').write_text(json.dumps((await c.get(BASE+'/threads/get/'+thread)).json(),ensure_ascii=False,indent=2))
asyncio.run(main())
