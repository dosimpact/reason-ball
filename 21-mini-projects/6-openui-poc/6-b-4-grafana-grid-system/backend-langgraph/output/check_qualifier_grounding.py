import asyncio,json,sys
from pathlib import Path
from langchain_core.messages import convert_to_messages
import agent.settings
from agent.graph import model
from agent.documents import list_documents
from agent.dashboard.grounding import GroundingGuard,retrieved_evidence
async def main():
 messages=convert_to_messages(json.loads(Path('output/quarterly-e2e/messages.json').read_text()))
 evidence=retrieved_evidence(messages,include_history=True)
 selected={}
 for e in evidence:
  a=e['arguments']
  if e['tool']=='read_document_page' and a.get('document_id')=='nvidia-2027-q2' and a.get('page') in (3,34):selected[a['page']]=e
 assert set(selected)=={3,34}
 original=json.loads(Path('output/publication-e2e/turn-2-state.json').read_text())['panels'][0]['program']
 cases=[('exception_lost','root=Card([TextContent("이번 분기 위험 요인에는 이전 공시 대비 중대한 변경 사항이 전혀 없습니다.")])',[selected[34]],True),('exception_kept','root=Card([TextContent("아래에 열거된 위험 요인을 제외하면 이전 10-K 및 10-Q에서 공시한 위험 요인에 중대한 변경이 없다는 뜻입니다. 전체 위험 요인에 변경이 전혀 없다는 뜻은 아닙니다.")])',[selected[34]],False),('quarter_as_year',original,[selected[3]],True),('quarter_labeled_correctly',original.replace('Fiscal Year Ended','Quarter Ended'),[selected[3]],False),('invented_monitoring','root=Card([TextContent("법적 절차 항목에서는 NVIDIA가 모든 소송의 진행을 지속 모니터링 중이라고 명시합니다.")])',[selected[34]],True),('note_reference','root=Card([TextContent("Part II Item 1은 법적 절차에 대해 Part I Item 1의 Note 10을 참조하도록 안내합니다.")])',[selected[34]],False)]
 actual=json.loads(Path('output/qualifier-e2e/messages.json').read_text())[-1]['content']
 cases.append(('actual_unqualified_followup',actual,[selected[34]],True))
 guard=GroundingGuard(model,list_documents());results=[]
 for name,candidate,ev,blocked in cases:
  r=await guard.review(candidate,ev,'원문에 근거하여 정확히 요약해줘.')
  results.append({'case':name,'candidate':candidate,'review':r.model_dump(),'passed':bool(r.issues)==blocked});print(name,results[-1]['passed'],flush=True)
 Path('output/qualifier-grounding-'+sys.argv[1]+'.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
asyncio.run(main())
