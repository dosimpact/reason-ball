import {describe,it,expect} from 'vitest';
import {normalizeWidgets} from './layout';
import {migrateGridDocument,registeredWidgetSchema} from '@/entities/analysis';
const widget=(id:string,layout:Record<string,number>,tabId='main')=>registeredWidgetSchema.parse({kind:'registered',schemaVersion:1,catalogVersion:1,registrationId:'openui',registrationVersion:1,sourceId:id,widgetId:id,title:id,program:'root = Col([])',uiState:{text:'preserved'},definitionRevision:2,tabId,layout});
describe('Grafana layout boundary',()=>{
 it('packs new cards in 24 columns and compacts gaps after removal',()=>{
  const packed=normalizeWidgets([widget('a',{w:12,h:8}),widget('b',{w:12,h:8}),widget('c',{w:24,h:8})]);
  expect(packed.map(w=>w.layout)).toEqual([{x:0,y:0,w:12,h:8},{x:12,y:0,w:12,h:8},{x:0,y:8,w:24,h:8}]);
  expect(normalizeWidgets(packed.slice(2))[0].layout?.y).toBe(0);
 });
 it('resolves collisions without overlap and leaves other tabs and UI content intact',()=>{
  const result=normalizeWidgets([widget('a',{x:0,y:0,w:24,h:8}),widget('b',{x:0,y:0,w:12,h:8}),widget('c',{x:12,y:0,w:12,h:8},'other')]);
  expect(result[1].layout?.y).toBe(8);expect(result[2].layout).toEqual({x:12,y:0,w:12,h:8});
  expect(result.every(w=>w.definitionRevision===2&&w.uiState.text==='preserved')).toBe(true);
 });
 it('migrates v4 width proportion and pixel height once, leaving v5 unchanged',()=>{
  const old={schemaVersion:4,widgets:[{layout:{w:6,h:11}}]};
  expect(migrateGridDocument(old)).toMatchObject({widgets:[{layout:{w:12,h:14}}]});
  const current={...old,schemaVersion:5};expect(migrateGridDocument(current)).toBe(current);
 });
});
