import asyncio,json
from pathlib import Path
from agent.sec import client,tools,service
async def main():
 calls=[];download=client.download
 async def counted(url):
  calls.append(url);return await download(url)
 client.download=counted
 result={}
 result['company']=json.loads(await tools.find_sec_company.ainvoke({'query':'AAPL'}))
 result['annual']=json.loads(await tools.collect_sec_reports.ainvoke({'cik':'320193','years':3,'form':'10-K'}))
 result['quarterly']=json.loads(await tools.collect_sec_reports.ainvoke({'cik':'320193','years':1,'form':'10-Q'}))
 result['financials']=await service.financials('320193',years=3)
 first_count=len(calls)
 async def forbidden(url):raise AssertionError('Repeated cached tool calls must not access SEC')
 client.download=forbidden
 result['annual_repeat']=json.loads(await tools.collect_sec_reports.ainvoke({'cik':'320193','years':3,'form':'10-K'}))
 result['quarterly_repeat']=json.loads(await tools.collect_sec_reports.ainvoke({'cik':'320193','years':1,'form':'10-Q'}))
 result['network_calls']=calls
 assert result['annual']['failed']==0 and result['annual']['downloaded']>=3,result['annual']
 assert result['quarterly']['failed']==0 and result['quarterly']['downloaded']>=3,result['quarterly']
 assert result['annual_repeat']['reused']==result['annual_repeat']['downloaded']
 assert result['quarterly_repeat']['reused']==result['quarterly_repeat']['downloaded']
 result['repeat_network_calls']=0
 Path('output/native-sec-tools-success.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps({'annual':result['annual']['downloaded'],'quarterly':result['quarterly']['downloaded'],'financial_rows':len(result['financials']['rows']),'initial_network_requests':first_count,'repeat_network_requests':0}))
asyncio.run(main())
