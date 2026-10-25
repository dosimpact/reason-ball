import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/quarterly-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  r=await c.post(BASE+'/threads/create',json={'messages':[{'role':'user','content':'[실데이터 검토] 10-Q 분기와 누적 실적'}]});r.raise_for_status();thread=r.json()['id'];(ROOT/'thread.json').write_text(json.dumps({'thread_id':thread}))
  print('thread',thread,flush=True)
  questions=['준비된 실제 PDF nvidia-2027-q2의 3쪽 원문을 읽고 NVIDIA FY2027 Q2와 전년 동기 매출을 차트로 비교해줘. 3개월 분기 실적과 6개월 누적 실적은 구분해서 각각 표로 보여줘. 회계기간·백만 USD 단위·원문 페이지를 명시하고 SEC에서 새로 수집한 것이 아니라 공식 IR PDF임을 밝혀줘. 추가 네트워크 수집은 하지 마.', '분기 매출 비교 차트와 6개월 누적 실적 표를 같은 Canvas 패널 하나에 담아줘. 제목은 NVIDIA 분기·누적 매출로 해줘.', '같은 보고서의 34쪽에서 Part II Item 1 법적 절차와 Item 1A 위험 요인 도입부를 확인해 각각 짧게 요약해줘. 재무제표 Item 1과 구분하고 이번에 읽은 페이지 범위만 명시해줘. Canvas는 변경하지 마.']
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
  await c.patch(BASE+'/threads/update/'+thread,json={'title':'[실데이터 검토] 10-Q 분기와 누적 실적'})
  (ROOT/'messages.json').write_text(json.dumps((await c.get(BASE+'/threads/get/'+thread)).json(),ensure_ascii=False,indent=2))
asyncio.run(main())
