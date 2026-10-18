import {beforeEach,expect,it,vi} from 'vitest';
import {hydrateArtifacts,saveArtifact,removeArtifacts,useArtifacts} from './artifacts';
const fixture=()=>({schemaVersion:1,artifactId:crypto.randomUUID(),title:'Sales',chartType:'bar',queryId:'a'.repeat(24),queryVersion:1,parameters:{months:3,region:'KR'},snapshot:{rows:[{period:'2026-10',value:42}],dataVersion:1,sourceWatermark:'2026-10-18',fetchedAt:'2026-10-18',parametersHash:'abc',provenance:'synthetic',resultSchemaVersion:1},queryDefinition:{schemaVersion:1,queryId:'a'.repeat(24),queryVersion:1,title:'Sales query',description:'Monthly',sql:'SELECT ...',createdAt:'2026-10-18',parameterSchema:{},resultSchema:{}}});
let storage:Map<string,string>;
beforeEach(()=>{storage=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});useArtifacts.setState({threads:{}});});
it('persists independent thread artifacts and cleans up only the deleted thread',()=>{
 const a=fixture(),b=fixture();saveArtifact('a',a);saveArtifact('b',b);useArtifacts.setState({threads:{}});hydrateArtifacts('a');hydrateArtifacts('b');
 expect(useArtifacts.getState().threads.a[a.artifactId]).toEqual(a);expect(useArtifacts.getState().threads.b[a.artifactId]).toBeUndefined();
 removeArtifacts('a');expect(storage.has('canvas-ux:artifacts:a')).toBe(false);expect(useArtifacts.getState().threads.b[b.artifactId]).toEqual(b);
});
it('preserves unknown saved versions and rejects invalid artifacts',()=>{
 const id=crypto.randomUUID();storage.set(`canvas-ux:artifacts:${id}`,'{"schemaVersion":999}');hydrateArtifacts(id);saveArtifact(id,fixture());
 expect(storage.get(`canvas-ux:artifacts:${id}`)).toBe('{"schemaVersion":999}');expect(()=>saveArtifact('invalid',{artifactId:'fake'})).toThrow();expect(useArtifacts.getState().threads.invalid).toEqual({});
});
