import asyncio,json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics
ROOT=Path('output/native-sec-e2e');ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
async def main():
 async with httpx.AsyncClient(timeout=900) as c:
  thread=json.loads((ROOT/'thread.json').read_text())['thread_id']
  print('thread',thread,flush=True)
  questions=['이미 수집한 Apple FY2025 10-K 0000320193-25-000079에서 search_sec_reports로 제품과 서비스 사업을 검색하고 Item 1 원문을 읽어 핵심 사업을 짧게 요약해줘. SEC 원문 링크와 Item을 표시하고 기존 Canvas는 유지해줘. IR PDF는 사용하지 마.', 'Apple FY2024 10-K 0000320193-24-000123와 FY2025 10-K 0000320193-25-000079의 Item 7을 직접 읽고, 각 보고서가 설명하는 매출 변화 원인을 표로 비교해줘. 읽은 원문과 추가 해석을 구분하고 출처를 붙여줘. Canvas는 유지해줘.', '수집한 Apple 10-Q 0000320193-26-000020의 Part I Item 1과 Part I Item 2를 읽고 해당 분기의 매출과 누적 매출을 기간을 분리한 표로 보여줘. 보고서의 실제 종료일·기간 길이·단위·SEC 원문 출처를 표시해줘. Canvas는 유지해줘.']
  for i,q in enumerate(questions,5):
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
