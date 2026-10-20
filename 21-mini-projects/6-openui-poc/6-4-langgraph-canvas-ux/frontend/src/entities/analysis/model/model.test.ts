import {describe,it,expect} from 'vitest';
import {restore,widgetSchema} from './model';
const widget={schemaVersion:1,catalogVersion:1,widgetId:'sales',title:'Sales',program:'root = Col([CanvasChart("Sales", "bar")])',chartType:'bar',queryId:'a'.repeat(24),queryVersion:1,parameters:{months:3,region:'ALL'},snapshot:{rows:[{period:'2026-10',value:100}],dataVersion:1,sourceWatermark:'2026-10-18T00:00:00Z',fetchedAt:'2026-10-18T00:00:00Z',parametersHash:'abc',provenance:'synthetic',resultSchemaVersion:1},definitionRevision:1,refreshPolicy:'manual',intervalSeconds:60,uiState:{}};
describe('persisted Canvas contract',()=>{
 it('restores current snapshots without querying',()=>{expect(restore(JSON.stringify({schemaVersion:1,widgets:[widget]}))).toEqual([widget]);});
 it('migrates only the known v0 envelope',()=>{expect(restore(JSON.stringify({schemaVersion:0,items:[widget]}))).toEqual([widget]);});
 it('rejects unknown document and catalog versions',()=>{expect(()=>restore('{"schemaVersion":42}')).toThrow();expect(()=>widgetSchema.parse({...widget,catalogVersion:2})).toThrow();});
 it('rejects malformed results instead of charting invented values',()=>{expect(()=>widgetSchema.parse({...widget,snapshot:{...widget.snapshot,rows:[{period:'x',value:'100'}]}})).toThrow();});
});
