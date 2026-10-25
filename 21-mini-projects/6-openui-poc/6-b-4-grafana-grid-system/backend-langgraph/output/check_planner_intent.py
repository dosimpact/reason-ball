import asyncio,json,sys
from pathlib import Path
import agent.settings
from agent.graph import model
from agent.dashboard.execution import plan_request
from agent.dashboard.store import initial
cases=[('overview','nvidia FY2026 보고서의 사업·위험 요인·경영진 설명·재무 핵심을 실제 원문 영역별로 확인해 한국어로 요약해줘.',[],0),('chart','엔비디아의 최근 3년 매출과 성장률을 차트로 보여줘.',[],0),('chat_only','매출은 차트로 보여줘. Canvas에는 추가하지 마.',[],0),('reusable','차트를 대화 안에 Canvas에 추가 가능한 결과로 게시해줘. 지금은 Canvas에는 추가하지 마.',['artifact_publish'],0),('canvas','매출 그래프를 Canvas에 추가해줘.',['add'],1),('two_panels','Canvas에 연구 메모와 확인 체크리스트를 각각 하나씩 만들어줘.',['add'],2)]
async def main():
 out=[]
 for name,q,ops,count in cases:
  p=await plan_request(model,[{'role':'user','content':q}],initial())
  out.append({'case':name,'request':q,'plan':p.model_dump(),'passed':set(p.operations)==set(ops) and p.minimum_new_panels==count and not p.clarification})
  print(name,out[-1]['passed'],p.operations,p.minimum_new_panels,flush=True)
 Path('output/planner-intent-'+sys.argv[1]+'.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
asyncio.run(main())
