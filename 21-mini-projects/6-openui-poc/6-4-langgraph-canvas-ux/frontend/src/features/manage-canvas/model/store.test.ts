import {beforeEach,describe,expect,it,vi} from 'vitest';
import {useCanvas,activateThread,getCanvasStore,discardThread} from './store';
import type {CanvasEvent,Widget} from '@/entities/analysis';
vi.mock('@/entities/analysis',async importOriginal=>({...await importOriginal<typeof import('@/entities/analysis')>(),validProgram:(s:string)=>{if(s==='invalid')throw new Error('Invalid program');return s;}}));
const fixture=():Widget=>({schemaVersion:1,catalogVersion:1,widgetId:'sales',title:'Sales',program:'root = Col([CanvasChart("Sales", "bar")])',chartType:'bar',queryId:'a'.repeat(24),queryVersion:1,parameters:{months:3,region:'ALL'},snapshot:{rows:[{period:'2026-10',value:100}],dataVersion:1,sourceWatermark:'2026-10-18T00:00:00Z',fetchedAt:'2026-10-18T00:00:00Z',parametersHash:'abc',provenance:'synthetic',resultSchemaVersion:1},definitionRevision:1,refreshPolicy:'manual',intervalSeconds:60,uiState:{}});
let runId:string;
const event=(sequence:number,props:Partial<CanvasEvent>)=>useCanvas.getState().event({channel:'canvas',type:'start',widgetId:'sales',runId,sequence,...props});
beforeEach(()=>{
 vi.unstubAllGlobals();vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()});activateThread(crypto.randomUUID());runId=crypto.randomUUID();
 useCanvas.setState({widgets:[fixture()],pending:{},notice:'',storageBlocked:false,running:true,refreshStatus:{}});
});
describe('Canvas stream lifecycle',()=>{
 it('routes interleaved widget deltas independently and ignores duplicate frames',()=>{
  event(0,{});event(1,{widgetId:'ads'});event(2,{delta:'sales(',type:'delta'});event(3,{widgetId:'ads',delta:'ads(',type:'delta'});event(3,{widgetId:'ads',delta:'duplicate',type:'delta'});
  expect(useCanvas.getState().pending.sales.program).toBe('sales(');expect(useCanvas.getState().pending.ads.program).toBe('ads(');
 });
 it('rejects a late commit from a cancelled run after the newer run succeeds',()=>{
  const old=runId;event(0,{});useCanvas.getState().finish(old);runId=crypto.randomUUID();event(0,{});
  event(1,{type:'commit',baseRevision:1,widget:{...fixture(),title:'New',definitionRevision:2}});
  runId=old;event(999,{type:'commit',baseRevision:2,widget:{...fixture(),title:'Late',definitionRevision:3}});
  expect(useCanvas.getState().widgets[0].title).toBe('New');
 });
 it('preserves newer local edits and valid widgets when a program is invalid',()=>{
  event(0,{});useCanvas.getState().edit('sales',{parameters:{months:6,region:'KR'}});
  event(1,{type:'commit',baseRevision:1,widget:{...fixture(),title:'Stale'}});
  expect((useCanvas.getState().widgets[0] as Widget).parameters).toEqual({months:6,region:'KR'});
  event(2,{type:'commit',baseRevision:2,widget:{...fixture(),program:'invalid'}});
  expect(useCanvas.getState().widgets[0].program).toBe(fixture().program);
 });
});
describe('saved-query refresh',()=>{
 it('merges concurrent refresh attempts and preserves the UI program',async()=>{
  let resolve!:(r:Response)=>void;const fetch=vi.fn(()=>new Promise<Response>(r=>resolve=r));vi.stubGlobal('fetch',fetch);
  const first=useCanvas.getState().refresh('sales');await useCanvas.getState().refresh('sales');expect(fetch).toHaveBeenCalledTimes(1);
  resolve(Response.json({...fixture().snapshot,dataVersion:2}));await first;
  expect((useCanvas.getState().widgets[0] as Widget).snapshot.dataVersion).toBe(2);expect(useCanvas.getState().widgets[0].program).toBe(fixture().program);
 });
 it('preserves last success on failure and schedules exponential polling backoff',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));const start=Date.now();await useCanvas.getState().refresh('sales');
  expect(useCanvas.getState().widgets[0]).toEqual(fixture());expect(useCanvas.getState().refreshStatus.sales.failures).toBe(1);expect(useCanvas.getState().refreshStatus.sales.nextAttemptAt).toBeGreaterThanOrEqual(start+120000);
  await useCanvas.getState().refresh('sales');expect(useCanvas.getState().refreshStatus.sales.failures).toBe(2);
 });
 it('discards old-filter responses and fetches the latest filter after the in-flight request',async()=>{
  const resolvers:Array<(r:Response)=>void>=[];
  const fetch=vi.fn(()=>new Promise<Response>(resolve=>resolvers.push(resolve)));vi.stubGlobal('fetch',fetch);
  const first=useCanvas.getState().refresh('sales');
  useCanvas.getState().edit('sales',{parameters:{months:6,region:'KR'}});
  await useCanvas.getState().refresh('sales');expect(fetch).toHaveBeenCalledTimes(1);
  resolvers[0](Response.json({...fixture().snapshot,dataVersion:99}));await first;
  expect((useCanvas.getState().widgets[0] as Widget).snapshot.dataVersion).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  resolvers[1](Response.json({...fixture().snapshot,dataVersion:2}));
  await vi.waitFor(()=>expect((useCanvas.getState().widgets[0] as Widget).snapshot.dataVersion).toBe(2));
  expect((useCanvas.getState().widgets[0] as Widget).parameters).toEqual({months:6,region:'KR'});
 });
 it('reports storage quota failure without discarding current widgets',()=>{
  vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('QuotaExceededError');}});
  useCanvas.getState().persist();expect(useCanvas.getState().notice).toContain('저장 공간');expect(useCanvas.getState().widgets).toMatchObject([fixture()]);
 });
 it('never fetches frozen snapshots',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);useCanvas.getState().edit('sales',{refreshPolicy:'snapshot'});await useCanvas.getState().refresh('sales');expect(fetch).not.toHaveBeenCalled();
 });
});

describe('thread ownership and tabs',()=>{
 it('isolates late refreshes, selections and streams across threads',async()=>{
  const first=getCanvasStore(useCanvas.getState().threadId);
  let resolve!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>resolve=r)));
  const refresh=first.getState().refresh('sales');
  activateThread('other-'+crypto.randomUUID());expect(useCanvas.getState().widgets).toEqual([]);
  useCanvas.setState({widgets:[{...fixture(),title:'Other'}]});
  resolve(Response.json({...fixture().snapshot,dataVersion:7}));await refresh;
  expect((useCanvas.getState().widgets[0] as Widget).snapshot.dataVersion).toBe(1);
  first.getState().event({channel:'canvas',type:'commit',widgetId:'sales',runId:crypto.randomUUID(),sequence:0,baseRevision:1,widget:{...fixture(),title:'Owner',definitionRevision:2}});
  expect(useCanvas.getState().widgets[0].title).toBe('Other');expect(first.getState().widgets[0].title).toBe('Owner');
 });
 it('persists tab membership and sizes without a fetch and keeps one tab after deletion',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);useCanvas.setState({running:false});
  useCanvas.getState().addTab();const tab=useCanvas.getState().activeTabId;
  useCanvas.getState().renameTab(tab,'분석');useCanvas.getState().transfer('sales',tab);
  useCanvas.getState().edit('sales',{layout:{w:6,h:14}});
  expect(useCanvas.getState().widgets[0]).toMatchObject({tabId:tab,layout:{w:6,h:14}});
  useCanvas.getState().removeTab(tab);expect(useCanvas.getState().widgets).toEqual([]);
  useCanvas.getState().removeTab('main');expect(useCanvas.getState().tabs).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
 });
 it('deleting a thread retires its store so late events cannot recreate its saved canvas',()=>{
  const owner=getCanvasStore(useCanvas.getState().threadId);discardThread(owner.getState().threadId!);
  owner.getState().event({channel:'canvas',type:'delete',widgetId:'sales',runId:crypto.randomUUID(),sequence:0,baseRevision:1});
  expect(owner.getState().disposed).toBe(true);expect(useCanvas.getState().widgets).toEqual([]);
 });
});

describe('Add to Canvas',()=>{
 const artifact=()=>({schemaVersion:1 as const,artifactId:crypto.randomUUID(),title:'Monthly sales',chartType:'bar' as const,queryId:'a'.repeat(24),queryVersion:1 as const,parameters:fixture().parameters,snapshot:fixture().snapshot,queryDefinition:{schemaVersion:1 as const,queryId:'a'.repeat(24),queryVersion:1 as const,title:'Sales query',description:'Monthly aggregate',sql:'SELECT ...',createdAt:'2026-10-18',parameterSchema:{},resultSchema:{}}});
 it('copies a standalone chart into the active tab without fetching, and deduplicates repeated clicks',()=>{
  useCanvas.setState({running:false,widgets:[]});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const source=artifact();useCanvas.getState().addTab();const tab=useCanvas.getState().activeTabId;
  useCanvas.getState().addArtifact(source);const copied=useCanvas.getState().widgets[0] as Widget;
  expect(copied.tabId).toBe(tab);expect(copied.queryId).toBe(source.queryId);expect(copied.snapshot).toEqual(source.snapshot);expect(copied.sourceArtifactId).toBe(source.artifactId);
  useCanvas.getState().edit(copied.widgetId,{parameters:{months:6,region:'US'}});
  expect(source.parameters).toEqual({months:3,region:'ALL'});
  useCanvas.getState().addTab();useCanvas.getState().addArtifact(source);
  expect(useCanvas.getState().widgets).toHaveLength(1);expect(useCanvas.getState().activeTabId).toBe(tab);expect(fetch).not.toHaveBeenCalled();
 });
 it('rejects malformed metadata and incomplete/running additions',()=>{
  const source=artifact();useCanvas.getState().addArtifact(source);expect(useCanvas.getState().widgets).toHaveLength(1);
  useCanvas.setState({running:false});expect(()=>useCanvas.getState().addArtifact({...source,queryDefinition:{...source.queryDefinition,queryId:'b'.repeat(24)}})).toThrow();
  expect(useCanvas.getState().widgets).toHaveLength(1);
 });
});

describe('registered content and layout commands',()=>{
 const content=(title='Note')=>({registrationId:'openui',registrationVersion:1 as const,sourceId:`note:${title}`,title,program:`root = Col([Text(${JSON.stringify(title)})])`,uiState:{}});
 beforeEach(()=>useCanvas.setState({running:false}));
 it('adds query-free content, deduplicates, removes from Chat and restores the same independent program',()=>{
  useCanvas.getState().addRegistered(content());useCanvas.getState().addRegistered(content());
  expect(useCanvas.getState().widgets).toHaveLength(2);
  const item=useCanvas.getState().widgets[1];expect(item).not.toHaveProperty('queryId');
  useCanvas.getState().removeSource('note:Note');expect(useCanvas.getState().widgets).toHaveLength(1);
  useCanvas.getState().addRegistered(content());expect(useCanvas.getState().widgets[1].widgetId).not.toBe(item.widgetId);
 });
 it('rejects unregistered and incomplete programs without changing the document',()=>{
  const before=useCanvas.getState().widgets;
  expect(()=>useCanvas.getState().addRegistered({...content(),registrationId:'unknown'})).toThrow();
  expect(()=>useCanvas.getState().addRegistered({...content(),program:'root = Col(['})).toThrow();
  expect(()=>useCanvas.getState().addRegistered({...content(),program:'root = Col([Text(missing)])'})).toThrow();
  expect(useCanvas.getState().widgets).toBe(before);
 });
 it('reorders mixed widgets and transfers to a tab without querying or changing content revisions',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);useCanvas.getState().addRegistered(content());
  const item=useCanvas.getState().widgets[1];useCanvas.getState().reorder(item.widgetId,'sales');
  expect(useCanvas.getState().widgets.map(w=>w.widgetId)).toEqual([item.widgetId,'sales']);
  useCanvas.getState().addTab();const tab=useCanvas.getState().activeTabId;
  useCanvas.getState().reorder(item.widgetId,undefined,tab);
  expect(useCanvas.getState().widgets.at(-1)).toMatchObject({tabId:tab,definitionRevision:1});
  expect(fetch).not.toHaveBeenCalled();
 });
 it('restores a mixed v3 document and refuses invalid registration versions',()=>{
  useCanvas.getState().addRegistered(content());const state=useCanvas.getState();
  const raw=JSON.stringify({schemaVersion:3,threadId:state.threadId,tabs:state.tabs,activeTabId:state.activeTabId,selectedWidgetId:state.selected,widgets:state.widgets});
  vi.stubGlobal('localStorage',{getItem:()=>raw,setItem:vi.fn()});
  state.hydrate();expect(useCanvas.getState().widgets).toHaveLength(2);expect(useCanvas.getState().storageBlocked).toBe(false);
  vi.stubGlobal('localStorage',{getItem:()=>raw.replace('"registrationVersion":1','"registrationVersion":99'),setItem:vi.fn()});
  state.hydrate();expect(useCanvas.getState().storageBlocked).toBe(true);state.persist();expect(localStorage.setItem).not.toHaveBeenCalled();
 });
 it('blocks additions and moves while running or preserving an incompatible document',()=>{
  for(const guard of [{running:true},{running:false,storageBlocked:true}]){
   useCanvas.setState(guard);useCanvas.getState().addRegistered(content());useCanvas.getState().reorder('sales');
   expect(useCanvas.getState().widgets).toHaveLength(1);
  }
 });
 it('commits displaced layouts atomically and rejects missing peers or busy writes',()=>{
  useCanvas.getState().addRegistered(content());const before=useCanvas.getState().widgets;
  const entries=before.map((w,i)=>({id:w.widgetId,layout:{x:0,y:i*10,w:24,h:10}}));
  const writes=vi.fn();vi.stubGlobal('localStorage',{setItem:writes});
  useCanvas.getState().setLayouts('main',entries.slice(0,1));expect(writes).not.toHaveBeenCalled();
  useCanvas.getState().setLayouts('main',entries);expect(writes).toHaveBeenCalledTimes(1);
  expect(useCanvas.getState().widgets.map(w=>w.layout)).toEqual(entries.map(e=>e.layout));
  expect(useCanvas.getState().widgets.map(w=>w.definitionRevision)).toEqual(before.map(w=>w.definitionRevision));
  useCanvas.setState({running:true});useCanvas.getState().setLayouts('main',entries);expect(writes).toHaveBeenCalledTimes(1);
 });
 it('does not call a query API for registered content',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);useCanvas.getState().addRegistered(content());
  await useCanvas.getState().refresh(useCanvas.getState().widgets[1].widgetId);expect(fetch).not.toHaveBeenCalled();
 });
});
