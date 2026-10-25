import asyncio,json,os,re
from pathlib import Path
from datetime import datetime,UTC
import httpx
import agent.settings
async def main():
 contact=re.search(r'[\w.+-]+@[\w.-]+',os.environ['SEC_USER_AGENT']).group()
 headers={'User-Agent':f'Reason Ball SEC Research {contact}','Accept':'application/json, text/plain, */*','Accept-Encoding':'gzip, deflate','From':contact}
 async with httpx.AsyncClient(timeout=30,headers=headers,follow_redirects=True) as c:
  r=await c.get('https://data.sec.gov/submissions/CIK0001045810.json')
  title=re.search(r'<title>(.*?)</title>',r.text,re.S|re.I)
  result={'checked_at':datetime.now(UTC).isoformat(),'identity':'Reason Ball SEC Research <configured contact>','from_contact':True,'status':r.status_code,'title':title.group(1) if title else None,'headers':{k:v for k,v in r.headers.items() if k.lower() in ['date','server','via','age','x-cache','content-type','retry-after','x-webcache-source','x-webcache-request-guid']},'bytes':len(r.content)}
  if r.status_code==200:result['company']=r.json().get('name')
 Path('output/sec-declared-request-probe.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
asyncio.run(main())
