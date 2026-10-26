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
  questions=['방금 요청은 Canvas에 저장되지 않았어. 분기와 누적을 섞지 말고, 3개월 매출 차트는 FY2026 Q2와 FY2027 Q2 두 점만 표시해줘. 6개월 누적 매출은 별도 표로 같은 Canvas 패널 안에 넣어줘. 회계연도와 실제 종료일을 구분하고 공식 PDF3쪽 출처를 유지해줘. 채팅에 결과를 게시하는 것으로 끝내지 말고 Canvas에 패널1개를 추가해줘.', '같은 보고서 nvidia-2027-q2의 34쪽에서 Part II Item 1 법적 절차와 Item 1A 위험 요인 도입부를 확인해 각각 짧게 요약해줘. 재무제표 Item 1과 구분하고 이번에 읽은 페이지 범위만 명시해줘. Canvas는 변경하지 마.']
  for i,q in enumerate(questions,3):
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
