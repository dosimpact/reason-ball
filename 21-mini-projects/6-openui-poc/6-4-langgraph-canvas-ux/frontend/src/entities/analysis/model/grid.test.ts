import {describe,it,expect} from 'vitest';
import {gridLayoutSchema,resizeGrid,clampGrid} from './grid';
describe('Canvas grid',()=>{
 it('migrates old pixel layouts and persists only grid units',()=>{
  expect(gridLayoutSchema.parse({width:6,height:520})).toEqual({w:12,h:14});
  expect(gridLayoutSchema.parse({width:12,height:1200})).toEqual({w:24,h:32});
 });
 it('snaps using column gaps and row pitch, and clamps both axes',()=>{
  expect(resizeGrid({w:6,h:8},30,38,712)).toEqual({w:7,h:9});
  expect(resizeGrid({w:6,h:8},14,18,712)).toEqual({w:6,h:8});
  expect(clampGrid({w:-10,h:100})).toEqual({w:1,h:40});
 });
 it('rejects corrupt saved grid dimensions',()=>{
  expect(()=>gridLayoutSchema.parse({w:25,h:8})).toThrow();
 });
});
