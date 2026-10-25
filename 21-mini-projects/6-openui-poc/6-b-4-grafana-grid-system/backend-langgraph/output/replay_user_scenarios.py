"""Populate review histories by real HTTP agent runs; never synthesize assistant messages."""
import asyncio, json
from pathlib import Path
import httpx
from agent.dashboard import diagnostics

ROOT = Path('output/us-review')
ROOT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3049/api'
LOCAL='준비된 실제 PDF nvidia(FY2026), nvidia-2025(FY2025), amd, intel만 사용하고 SEC 네트워크 호출은 하지 마. 출처와 회계기간·단위를 명시하고 근거 없는 수치는 만들지 마. '
CHART='NVIDIA FY2025와 FY2026의 매출을 원문으로 확인하고 Canvas에 매출 차트 패널 하나를 만들어줘. 제목은 NVIDIA 매출로 해줘. '
THREE='NVIDIA의 FY2024~FY2026 3년 매출을 nvidia-2025의 실적 요약 원문과 nvidia의 실적 요약 원문에서 확인해 차트와 표로 보여줘. FY2025 문서의 실적 요약은 PDF130쪽, FY2026은 PDF37쪽을 확인해. '
CASES=[
('US-01','보고서 찾기와 수집 상태',['NVIDIA CIK 1045810의 최근 10-K 보고서 수집을 한 번 요청해줘. SEC가 거절하면 반복 요청하지 말고 실제 HTTP 상태와 확보 여부를 알려줘. 이미 준비된 로컬 PDF는 신규 SEC 수집과 구분해서 목록을 알려줘.']),
('US-02','전체 요약',[LOCAL+'nvidia FY2026 보고서의 사업·위험 요인·경영진 설명·재무 핵심을 실제 원문 영역별로 확인해 한국어로 요약해줘. 확인한 페이지 범위를 명시하고 전체 완독했다고 하지 마.']),
('US-03','위험 요인 섹션',[LOCAL+'nvidia FY2026 보고서의 위험 요인 섹션에서 수출 규제와 관련한 부분만 찾아 짧게 발췌하고 쉽게 설명해줘. 실제 읽은 페이지와 전체 섹션 중 일부라는 범위를 표시해줘.']),
('US-04','연속 질문',[LOCAL+'nvidia FY2026 매출 증가 원인을 보고서 원문을 읽고 설명해줘.','그중 데이터센터 사업에 집중해서 앞서 답변을 더 자세히 설명해줘. 관련 원문을 읽고 확인된 사실과 해석을 구분해줘. Canvas는 변경하지 마.']),
('US-05','기업 비교',[LOCAL+'NVIDIA, AMD, Intel 최근 보고서의 매출·주요 사업·위험 요인을 비교해줘. 원문에서 확인한 값만 표에 넣고 회계기간과 출처를 명시해줘. 각 기업의 원문을 확인해줘.']),
('US-06','3년 추이',[LOCAL+THREE+'표시된 연속 연도 사이 전년 대비 증가율도 보여줘.']),
('US-07','대화 속 차트와 입력',[LOCAL+THREE+'차트는 대화 안에 보여줘. 별도로 FY2025/FY2026 실제 매출을 초기값으로 한 성장률 계산기를 제공해줘. 사용자가 값을 바꾸면 가정 계산임을 구분하고 @YearOverYear 함수로 결과가 변해야 해. Canvas에는 추가하지 마.']),
('US-08','채팅 차트를 Canvas로',[LOCAL+THREE+'먼저 대화에 Canvas에 추가 가능한 차트 결과로 게시해줘. 지금은 Canvas에는 추가하지 마.','방금 대화에 게시한 매출 차트를 Canvas에 추가해줘.']),
('US-09','선택 패널 후속 질문',[LOCAL+THREE+'Canvas에 NVIDIA 매출이라는 제목의 차트 패널 하나로 만들어줘.','현재 NVIDIA 매출 패널에서 전년 대비 성장률이 가장 높았던 해와 이유를 원문 근거로 설명해줘. 패널 내용과 배치는 변경하지 마.']),
('US-10','기간 확대와 제외',[LOCAL+CHART,'같은 패널을 FY2024~FY2026 3년치로 확대해줘. nvidia-2025 PDF130쪽에 있는 FY2024 비교 수치를 직접 확인해줘. 패널 ID와 배치는 유지해줘.','같은 패널에서 FY2025만 제외해줘. FY2024와 FY2026의 비연속 구간을 전년 대비 성장률로 표시하지 마. 기존 ID와 배치를 유지해줘.']),
('US-11','패널 배치',[LOCAL+CHART+'그리고 같은 보고서의 주요 사업을 요약한 별도 패널 하나를 추가해줘. 요약 패널 제목은 사업 요약으로 해줘.','NVIDIA 매출 패널은 왼쪽 위에 너비 14, 높이 12로, 사업 요약은 오른쪽에 너비 10, 높이 12로 배치해줘. 기존 내용과 출처는 유지해줘.']),
('US-12','고정과 포커스',[LOCAL+CHART,'NVIDIA 매출 패널을 현재 위치에 고정해줘. 그리고 이 패널로 이동하는 버튼을 대화에 제공해줘.']),
('US-13','패널 삭제',[LOCAL+CHART+'그리고 보고서에 근거한 위험 요인 요약 패널을 별도로 만들어줘. 제목은 위험 요인으로 해줘.','위험 요인 패널만 삭제해줘. 삭제를 승인한다. NVIDIA 매출 패널과 원본 보고서, 대화 이력은 유지해줘.']),
('US-14','전체 다운로드',[LOCAL+CHART,'Canvas 전체를 JSON, CSV, PDF로 내려받고 싶어. 다운로드 컨트롤을 제공하고 각 형식에 포함되는 범위를 설명해줘. 실제 파일 저장 전에는 완료했다고 말하지 마.']),
('US-15','이전 분석 이어가기',[LOCAL+CHART,'이전 분석을 이어갈게. Canvas의 NVIDIA 매출 패널은 그대로 두고, FY2026 매출 증가 이유를 원문에서 확인해 설명해줘.']),
('US-16','자료 부족과 회복',[LOCAL+'현재 준비된 PDF만으로 NVIDIA FY2010 매출을 확인할 수 있는지 점검해줘. 확보하지 못한 연도는 자료 부족으로 안내하고 추정값을 만들지 마. 추가 다운로드는 하지 마.','그럼 확보된 FY2025와 FY2026으로 범위를 바꿔서 실제 매출 비교 표를 보여줘. 원문을 읽고 출처를 표시해줘.'])]

async def main():
 async with httpx.AsyncClient(timeout=httpx.Timeout(900,connect=20)) as c:
  for code,title,questions in CASES:
   target=ROOT/f'{code}.json'
   if target.exists():
    entry=json.loads(target.read_text())
   else:
    r=await c.post(BASE+'/threads/create',json={'messages':[{'role':'user','content':f'[실데이터 재검토] {code} · {title}'}]});r.raise_for_status()
    entry={'scenario':code,'title':title,'thread_id':r.json()['id'],'turns':[]}
    target.write_text(json.dumps(entry,ensure_ascii=False,indent=2))
   thread=entry['thread_id']
   for number,question in enumerate(questions):
    if number<len(entry['turns']):continue
    print(f'{code} turn {number+1} starting {thread}',flush=True)
    before=(await c.get(BASE+'/dashboard/state/'+thread)).json()
    if code=='US-09' and number==1 and before['panels']:
     import uuid
     r=await c.post(BASE+'/dashboard/state/'+thread,json={'operation_id':str(uuid.uuid4()),'base_revision':before['revision'],'action':'select','panel_id':before['panels'][0]['id'],'payload':{}});r.raise_for_status()
    events=[]
    async with c.stream('POST',BASE+'/dashboard/chat',json={'threadId':thread,'messages':[{'role':'user','content':question}]}) as r:
     r.raise_for_status()
     async for line in r.aiter_lines():
      if line.startswith('data: '):events.append(json.loads(line[6:]))
    (ROOT/f'{code}-{number+1}-events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2))
    after=(await c.get(BASE+'/dashboard/state/'+thread)).json()
    (ROOT/f'{code}-{number+1}-state.json').write_text(json.dumps(after,ensure_ascii=False,indent=2))
    messages=(await c.get(BASE+'/threads/get/'+thread)).json()
    (ROOT/f'{code}-messages.json').write_text(json.dumps(messages,ensure_ascii=False,indent=2))
    result={'number':number+1,'question':question,'finished':any(e['type']=='RUN_FINISHED' for e in events),'errors':[e for e in events if e['type']=='RUN_ERROR'],'panels':len(after['panels']),'diagnostics':diagnostics.latest(thread)}
    entry['turns'].append(result)
    target.write_text(json.dumps(entry,ensure_ascii=False,indent=2))
    print(f'{code} turn {number+1} saved finished={result["finished"]} panels={len(after["panels"])} missing={(result["diagnostics"] or {}).get("missing")}',flush=True)
   await c.patch(BASE+'/threads/update/'+thread,json={'title':f'[실데이터 재검토] {code} · {title}'})
 print('ALL SCENARIOS EXECUTED',flush=True)

asyncio.run(main())
