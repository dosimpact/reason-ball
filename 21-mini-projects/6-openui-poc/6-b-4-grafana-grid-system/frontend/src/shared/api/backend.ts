// 백엔드 주소와 비밀은 서버에만 존재합니다. 전달 경로를 허용 목록으로 제한합니다.
export async function relayDashboard(request:Request,path:string[]){
 if(!((path.length===1&&path[0]==='chat')||(path.length===2&&path[0]==='state'&&/^[0-9a-f-]{36}$/.test(path[1]))))return Response.json({error:'Unknown route'},{status:404});
 const origin=request.headers.get('origin');const url=new URL(request.url);url.host=request.headers.get('host')??url.host;
 if(origin&&origin!==url.origin)return Response.json({error:'Origin is not allowed'},{status:403});
 try{
  const response=await fetch(`${process.env.DASHBOARD_BACKEND_URL??'http://127.0.0.1:2041'}/dashboard/${path.join('/')}`,{method:request.method,headers:{'Content-Type':'application/json'},body:request.method==='GET'?undefined:await request.text(),signal:request.signal,cache:'no-store'});
  return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')??'application/json','Cache-Control':'no-cache, no-transform'}});
 }catch{return Response.json({error:'Python backend is unavailable'},{status:502});}
}
