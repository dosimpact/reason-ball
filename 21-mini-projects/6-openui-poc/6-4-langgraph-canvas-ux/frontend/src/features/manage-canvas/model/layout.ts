import {verticalCompactor,collides,type LayoutItem} from 'react-grid-layout/core';
import {clampGrid,type CanvasWidget} from '@/entities/analysis';
export function normalizeWidgets(widgets:CanvasWidget[]):CanvasWidget[]{
 const positions=new Map<string,LayoutItem>();
 for(const tab of new Set(widgets.map(w=>w.tabId||'main'))){
  const items:LayoutItem[]=[];
  for(const w of widgets.filter(w=>(w.tabId||'main')===tab)){
   const size=clampGrid(w.layout??{w:12,h:14});
   let item:LayoutItem={i:w.widgetId,w:size.w,h:size.h,x:size.x??0,y:size.y??0};
   if(size.x===undefined||size.y===undefined){
    let found=false;
    for(let y=0;!found;y++)for(let x=0;x<=24-size.w;x++){
     const candidate={...item,x,y};
     if(!items.some(other=>collides(candidate,other))){item=candidate;found=true;break;}
    }
   }
   items.push(item);
  }
  for(const item of verticalCompactor.compact(items,24))positions.set(item.i,item);
 }
 return widgets.map(w=>{const {x,y,w:width,h}=positions.get(w.widgetId)!;return {...w,layout:{x,y,w:width,h}};});
}
