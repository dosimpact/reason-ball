import { createServer } from 'node:http';
import { URL } from 'node:url';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

// No model, market, SEC or database calls. All registered graph contracts are visible.
const ids = ['main_graph', 'simple_llm', 'technical_analysis_graph', 'price_agent', 'starter_graph', 'tenk_subgraph', 'sec_deep_agent', 'technical_analysis_agent', 'unknown_fixture_graph', 'schema_error_fixture'];
const chat = new Set(['starter_graph','simple_llm','technical_analysis_agent','sec_deep_agent']);
const calls = [];
const states = new Map();
const threads = [];
let sequence = 0;
const json = (response, body, status=200) => { response.writeHead(status, {'Content-Type':'application/json'}); response.end(JSON.stringify(body)); };
const schema = id => chat.has(id) ? {type:'object',properties:{messages:{type:'array'}},required:['messages']} : {type:'object',properties: id === 'price_agent' ? {query:{type:'string'},interval:{type:'string'},count:{type:'integer'}} : {input:{type:'object'}},required:id === 'price_agent' ? ['query'] : []};
const server=createServer(async(request,response)=>{
 const url=new URL(request.url,'http://fixture'); let text=''; for await(const chunk of request) text+=chunk;
 const input=text?JSON.parse(text):{}; calls.push({method:request.method,path:url.pathname,body:input});
 if(url.pathname==='/__calls')return json(response,calls);
 if(url.pathname==='/assistants/search')return json(response,ids.slice(input.offset||0,(input.offset||0)+(input.limit||100)).map(id=>({assistant_id:id,graph_id:id,name:id,metadata:{},created_at:'2026-11-14T00:00:00Z',updated_at:'2026-11-14T00:00:00Z',config:{}})));
 const match=/^\/assistants\/([^/]+)\/schemas$/.exec(url.pathname);
 if(match?.[1] === 'schema_error_fixture')return json(response,{message:'Fixture schema unavailable'},400);
 if(match)return json(response,{graph_id:match[1],input_schema:schema(match[1]),output_schema:{type:'object'},state_schema:{type:'object'}});
 if(url.pathname==='/threads/search')return json(response,threads.filter(thread => Object.entries(input.metadata||{}).every(([key,value])=>thread.metadata[key]===value)).slice(-(input.limit||50)).reverse());
 if(url.pathname==='/threads'&&request.method==='POST'){ const thread={thread_id:`fixture-thread-${++sequence}`,metadata:input.metadata||{},status:'idle',created_at:'2026-11-14T00:00:00Z',updated_at:'2026-11-14T00:00:00Z'}; threads.push(thread); return json(response,thread); }
 if(request.method === 'GET' && /^\/threads\/[^/]+\/runs\/[^/]+$/.test(url.pathname))return json(response,{status:'success'});
 const state=/^\/threads\/([^/]+)\/state$/.exec(url.pathname);if(state)return json(response,{values:states.get(state[1])||{messages:[]},next:[],tasks:[]});
 const run=/^\/threads\/([^/]+)\/runs\/stream$/.exec(url.pathname);
 if(run){response.writeHead(200,{'Content-Type':'text/event-stream'}); const event=(name,data)=>response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);event('metadata',{run_id:`fixture-run-${sequence}`});
  if(input.input?.delay) await delay(2000);
  if(input.input?.fail){event('error',{message:'Fixture graph execution failed'});return response.end();}
  const prompt=input.input?.messages?.at(-1)?.content||'';
  if(chat.has(input.assistant_id)&&prompt.includes('tools-')){
   const previous=states.get(run[1])?.messages||[];
   const callId=`safe-tool-${sequence}-${previous.length}`;
   const messages=[...previous,...(input.input.messages||[]),{id:`call-${callId}`,type:'ai',content:'',tool_calls:[{id:callId,name:'get_price_ohlcv',args:{private:'SECRET_ARGUMENT'},type:'tool_call'}]}];
   event('values',{messages});
   if(prompt.includes('running')||prompt.includes('interrupt'))await delay(3000);
   messages.push({id:`result-${callId}`,type:'tool',tool_call_id:callId,name:'get_price_ohlcv',status:prompt.includes('error')?'error':'success',content:'SECRET_TOOL_RESULT'});
   messages.push({id:`answer-${callId}`,type:'ai',content:'Safe fixture assistant answer'});
   states.set(run[1],{messages});event('values',{messages});return response.end();
  }
  const values=chat.has(input.assistant_id)?{messages:[...(input.input?.messages||[]),{id:'fixture-answer',type:'ai',content:`Fixture reply for ${input.assistant_id}`}]}:{graph:input.assistant_id,input:input.input,result:'Fixture structured output'};
  states.set(run[1],values);event('values',values);event('end',{});return response.end();
 }
 return json(response,{message:'Fixture route missing'},404);
});
server.listen(Number(process.env.FIXTURE_PORT||3984),'127.0.0.1',()=>process.stdout.write(`Graph fixture ready ${server.address().port}\n`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
