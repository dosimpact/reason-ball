const test = require('node:test');
const assert = require('node:assert/strict');
const { SecModelingService, modelingFilters, pageLimit } = require('../dist/us-corporate-filings/service/sec-modeling.service');

const A = { cik:'0000000001', accessionNo:'0000000001-26-000001', formType:'10-K', hasSource:true, sourceHash:'current' };
const B = { ...A, cik:'0000000002', accessionNo:'0000000002-26-000001', formType:'10-Q' };
function fixture(items, runs, publications) {
  const calls=[];
  const store={
    filings:async (...args)=>{calls.push(['filings',args]); return { items:items.map(x=>({...x})),total:99,limit:20,offset:0 };},
    latestRuns:async rows=>{calls.push(['latestRuns',rows]);return runs;},
  };
  const client={request:async (path,body)=>{calls.push(['published',path,body]);if(publications instanceof Error)throw publications;return {items:publications};}};
  return {service:new SecModelingService(store,client),calls};
}

test('one page uses one latest-run batch and one publication batch; historical success is not readiness',async()=>{
  const {service,calls}=fixture([A,B],[{cik:B.cik,accessionNo:B.accessionNo,stage:3,status:'SUCCEEDED'}],[
    {...A,stages:{'1':{generationId:'g1',sourceHash:'current'},'2':{generationId:'g2',sourceHash:'old',inputGenerationId:'g1'}}},
    {...B,stages:{}},
  ]);
  const result=await service.filings(20,0);
  assert.equal(result.total,99);
  assert.equal(result.items[0].stages[1].status,'ready');
  assert.equal(result.items[0].stages[2].status,'stale');
  assert.equal(result.items[1].stages[1].status,'unsupported');
  assert.equal(result.items[1].stages[3].status,'unprocessed');
  assert.equal(calls.filter(c=>c[0]==='latestRuns').length,1);
  assert.equal(calls.filter(c=>c[0]==='published').length,1);
  assert.equal(calls.find(c=>c[0]==='published')[2].filings.length,2);
});

test('service failure and incomplete batch never become ready or zero successful work',async()=>{
  for(const publication of [new Error('offline'),[]]){
    const {service}=fixture([A],[{cik:A.cik,accessionNo:A.accessionNo,stage:1,status:'SUCCEEDED'}],publication);
    const result=await service.filings(20,0);
    assert.equal(result.items.length,1);
    assert.equal(result.items[0].stages[1].status,'unavailable');
    assert.equal(result.items[0].stages[1].readiness,'unavailable');
    assert.equal(result.items[0].stages[1].latestRun.status,'SUCCEEDED');
  }
});

test('empty out-of-range page keeps total without any per-page upstream lookups',async()=>{
  const {service,calls}=fixture([],[],[]);
  const result=await service.filings(20,1000);
  assert.equal(result.total,99);assert.equal(result.items.length,0);
  assert.deepEqual(calls.map(c=>c[0]),['filings']);
});

test('model2 requires current source version and active job status stays visible',async()=>{
  const {service}=fixture([A],[{cik:A.cik,accessionNo:A.accessionNo,stage:2,status:'QUEUED'}],[{...A,stages:{'1':{generationId:'old',sourceHash:'different'}}}]);
  const result=await service.filings(20,0);
  assert.equal(result.items[0].stages[2].readiness,'input_required');
  assert.equal(result.items[0].stages[2].status,'QUEUED');
});

test('filters normalize CIK and preserve literal text; invalid values fail before SQL',()=>{
  assert.deepEqual(modelingFilters({cik:'1',q:' A%_ ',sourceStatus:'missing',formType:'10-Q'}),{cik:'0000000001',q:'A%_',sourceStatus:'missing',formType:'10-Q'});
  for(const value of [{cik:'oops'},{q:'x'.repeat(101)},{q:['a','b']},{formType:'20-F'},{sourceStatus:'downloaded'}])assert.throws(()=>modelingFilters(value));
  assert.throws(()=>pageLimit('0',20));assert.equal(pageLimit(undefined,20),20);
});

test('invalid action body never reaches source reads or job creation',async()=>{
  const service=new SecModelingService({filing(){throw new Error('must not read');}},{});
  for(const body of [null,[],{unknown:true},{extractionModel:null},{extractionModel:'invalid'}]){
    await assert.rejects(service.create(A.cik,A.accessionNo,1,body),error=>error.status===400);
  }
  await assert.rejects(service.create(A.cik,A.accessionNo,3,{extractionModel:'gpt-5.6-sol'}),error=>error.status===400);
});

test('retry projects existing extraction config without sending historical metadata as public body',async()=>{
  for(const stage of [1,3]){
    const model=stage===3?'gpt-6-luna':'gpt-5.6-luna';
    let seen;
    const store={
      run:async()=>({id:'old-run',cik:A.cik,accessionNo:A.accessionNo,stage,status:'FAILED',config:{extractionModel:model,historicalMetadata:'preserved-on-old-run'}}),
      filing:async()=>A,
      create:async(...args)=>{seen=args;return{id:'new-run',status:'QUEUED'};},
    };
    const result=await new SecModelingService(store,{}).retry('old-run');
    assert.deepEqual(result,{runId:'new-run',status:'QUEUED'});
    assert.deepEqual(seen[2],{extractionModel:model});
    assert.equal(seen[4],'old-run');
  }
});


test('completion filter validates and normalizes stages; unavailable publication cannot appear as empty success',async()=>{
  assert.deepEqual(modelingFilters({completedStages:'3,1,3'}).completedStages,[1,3]);
  for(const completedStages of ['4','1,,2','1,', ['1','2']]) assert.throws(()=>modelingFilters({completedStages}));
  const service=new SecModelingService({}, {request:async()=>{throw new Error('offline');}});
  await assert.rejects(service.filings(20,0,undefined,{completedStages:[1]}),error=>error.status===503);
  await assert.rejects(service.overview({completedStages:[2]}),error=>error.status===503);
});

test('completion filter rejects changed publication instead of returning nonmatching rows',async()=>{
  for(const stages of [{}, {'1':{generationId:'g1',sourceHash:'old'}}]){
    const store={filings:async()=>({items:[A],total:1}),latestRuns:async()=>[]};
    const client={request:async(path)=>path.endsWith('/publications')
      ?{items:[{...A,stages:{'1':{generationId:'g1',sourceHash:'current'}}}]}
      :{items:[{...A,stages}]}};
    await assert.rejects(new SecModelingService(store,client).filings(20,0,undefined,{completedStages:[1]}),error=>error.status===503);
  }
});
