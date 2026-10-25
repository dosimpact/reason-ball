import asyncio,json
from pathlib import Path
import agent.settings
from agent.graph import model
from agent.dashboard.execution import plan_request
state=json.loads(Path('output/grounding-e2e/turn-2-state.json').read_text());pid=state['panels'][0]['id'];state['selected_panel_id']=pid
cases=[('explain','선택한 패널에서 FY2026 매출 증가를 설명해줘.',[]),('update','선택한 패널을 FY2024~FY2026 3년치로 다시 늘려줘.',['update']),('pin','현재 선택한 패널을 고정해줘.',['pin']),('layout','선택한 패널을 너비 16으로 늘려줘.',['layout']),('exclude_ambiguous','이 차트에서 1년치는 빼줘.',None)]
async def main():
 out=[]
 for name,q,ops in cases:
  p=await plan_request(model,[{'role':'user','content':'Canvas에 매출 차트를 만들어줘.'},{'role':'assistant','content':'매출 차트를 만들었습니다.'},{'role':'user','content':q}],state)
  ok=bool(p.clarification) and not p.operations if ops is None else set(p.operations)==set(ops) and p.minimum_new_panels==0 and not p.clarification
  if ops:ok=ok and all(t.target_id==pid for t in p.targets)
  out.append({'case':name,'plan':p.model_dump(),'passed':ok});print(name,ok,flush=True)
 Path('output/planner-followups.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));assert all(r['passed'] for r in out)
asyncio.run(main())
