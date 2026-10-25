import json,os,tempfile,time
from pathlib import Path
from starlette.testclient import TestClient
from agent import history
from agent.app import app
from agent.dashboard import store
from agent.sec import client
with tempfile.TemporaryDirectory() as directory:
 os.environ['DOCUMENT_DATA_DIR']=directory
 thread=history.create_thread('검증용 가정 데이터')['id']
 store.execute(thread,{'action':'add','panel_id':'cooldown-demo','operation_id':'seed','base_revision':0,'payload':{'title':'검증용 가정 데이터 · 갱신 실패 보존','kind':'financial','query':{'cik':'1','metric':'revenue','years':3},'data':{'rows':[{'period':'2024-12-31','value':10,'unit':'USD','growth_percent':None},{'period':'2025-12-31','value':12,'unit':'USD','growth_percent':20}]}}})
 before=store.read(thread)
 client._cooldown_until=time.monotonic()+60
 response=TestClient(app).post('/dashboard/state/'+thread,json={'action':'refresh','panel_id':'cooldown-demo','operation_id':'attempt','base_revision':1,'payload':{}})
 assert response.status_code==200
 after=response.json();assert before['panels'][0]['data']==after['panels'][0]['data'];assert 'SEC 요청 대기' in after['panels'][0]['refresh']['error']
 Path('output/refresh-cooldown-ui.json').write_text(json.dumps({'before':before,'after':after},ensure_ascii=False,indent=2))
 print('isolated SQLite HTTP cooldown response prepared; no SEC request sent')
