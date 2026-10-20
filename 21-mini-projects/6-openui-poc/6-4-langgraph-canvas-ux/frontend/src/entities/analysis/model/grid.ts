import {z} from "zod";
export const GRID_COLUMNS=24, GRID_GAP=8, GRID_ROW_HEIGHT=30;
export type GridLayout={w:number;h:number;x?:number;y?:number};
export function clampGrid(layout:Partial<GridLayout>):GridLayout{
 const w=Math.max(1,Math.min(24,Math.round(layout.w??12)));
 return {w,h:Math.max(4,Math.min(40,Math.round(layout.h??14))),...(layout.x===undefined?{}:{x:Math.max(0,Math.min(24-w,Math.round(layout.x)))}),...(layout.y===undefined?{}:{y:Math.max(0,Math.round(layout.y))})};
}
const size={w:z.number().int().min(1).max(24),h:z.number().int().min(4).max(40)};
export const gridLayoutSchema=z.union([
 z.object({...size,x:z.number().int().min(0).max(23),y:z.number().int().min(0).max(10000)}).refine(v=>v.x+v.w<=24,'Panel exceeds grid'),
 // Unpositioned current size is accepted for newly generated panels. Document migrations are explicit.
 z.object(size).strict(),
 z.object({width:z.number().int().min(4).max(12),height:z.number().int().min(320).max(1200)}).transform(v=>clampGrid({w:v.width*2,h:(v.height+8)/38})),
]).transform((v):GridLayout=>v);
export function migrateGridDocument(raw:unknown):unknown{
 if(!raw||typeof raw!=='object')return raw;
 const data=raw as Record<string,unknown>;
 if(![2,3,4].includes(Number(data.schemaVersion))||!Array.isArray(data.widgets))return raw;
 return {...data,widgets:data.widgets.map(w=>{
  if(!w||typeof w!=='object')return w;
  const layout=w.layout;
  if(layout&&typeof layout.w==='number'&&typeof layout.h==='number'&&layout.x===undefined){
   z.object({w:z.number().int().min(3).max(12),h:z.number().int().min(4).max(25)}).parse(layout);
   return {...w,layout:clampGrid({w:layout.w*2,h:(layout.h*48-16+8)/38})};
  }
  return w;
 })};
}
export function resizeGrid(start:GridLayout,dx:number,dy:number,containerWidth:number):GridLayout{
 return clampGrid({...start,w:start.w+Math.round(dx/((containerWidth+GRID_GAP)/GRID_COLUMNS)),h:start.h+Math.round(dy/(GRID_ROW_HEIGHT+GRID_GAP))});
}
