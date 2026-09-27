import type { Candle } from "@/entities/candle/@x";

const patterns:Record<string,readonly number[]> = {
  "ew-fib-anchors":[100,120,110,142,129,150,138],
  "ew-wave-proportions":[100,120,110,142,130,149,139],
  "ew-degree-structure":[100,110,106,115,111,120,116,127,122,135,128,142],
  "ew-extension":[100,112,107,141,132,145,136],
  "ew-correction-map":[160,151,156,142,147,131,141,148,143,137,139,126],
  "ew-flat-variants":[160,151,165,143,154,139,149,135,145,130,140,127],
  "ew-triangle-structure":[150,132,147,136,144,138,142,139,141,140,141,140],
  "ew-combination-structure":[160,148,153,142,150,154,148,137,143,131,139,127],
  "ew-diagonal-context":[160,143,153,137,148,131,143,127,139,126,137,124],
  "ew-leading-diagonal":[100,114,106,121,111,128,118,133,125,138,130,142],
  "ew-multiscale":[100,108,105,112,109,117,113,121,116,125,120,130],
  "ew-alternates":[150,138,146,135,143,134,145,137,148,139,151,141],
  "ew-analysis-contract":[100,119,109,137,124,148,135,142,131,151,140,159],
  "ew-fib-measure":[100,120,110,143,128,150,136],
  "ew-channel-time":[100,117,108,127,116,137,126,145],
  "ew-target-zones":[100,120,110,137,125,132,119,128],
  "ew-bearish-impulse":[160,142,151,126,136,110,121,103,114,91,101,83],
  "ew-truncation":[160,142,151,115,136,120,128,121,126,122,127,123],
  "ew-impulse-audit":[100,119,109,143,127,154,142,133,148,137,151,140],
  "ew-zigzag":[160,151,156,142,147,131,141,136,148,139,143,126,132,110],
  "ew-flat-classify":[160,151,156,149,154,152,159.8,153,155,150,152,145],
  "ew-correction-replay":[160,149,155,143,151,139,151,158,153,146,151,135],
  "ew-triangle-count":[150,132,147,136,144,138,142,139,141,140,141,140],
  "ew-combination-count":[160,148,153,142,150,154,148,137,143,131,139,127],
  "ew-complex-ambiguity":[150,135,147,138,144,139,143,140,142,137,146,132],
  "ew-ending-diagonal":[160,143,153,137,148,131,143,127,139,126,137,124],
  "ew-diagonal-versus-impulse":[160,141,152,145,136,110,137,112,131,106,126,101],
  "ew-diagonal-replay":[160,144,153,138,148,132,144,129,139,126,145,121],
};
const defaultPattern=[100,119,109,137,124,148,135,142,131,151,140,159];
function vary(values:readonly number[],caseIndex:number):number[]{
  if(caseIndex===0) return [...values];
  if(caseIndex===1) return values.map((value,index)=>+(value+(index>=Math.floor(values.length/2)?(index%2===0?7:-5):0)).toFixed(2));
  return values.map((value,index)=>+(value+Math.sin(index*0.7)*3+(index%3===0?1:0)).toFixed(2));
}
/** Authored OHLC, with exact marked swing prices at evenly spaced anchors. */
export function authoredPatternCandles(unitId:string,total:number,caseIndex:number,offset:number):Candle[]{
  const base=unitId==="ew-fib-measure"&&caseIndex===1?[120,100,110,77,91,69,84]:unitId==="ew-fib-measure"&&caseIndex===2?[90,114,104,138,124,146,131]:patterns[unitId]??defaultPattern;
  const counterOverrides:Record<string,number[]>={
    "ew-bearish-impulse":[160,142,151,126,145,110,121,103,114,91,101,83],
    "ew-truncation":[160,142,151,115,136,104,128,121,126,122,127,123],
    "ew-zigzag":[160,151,156,142,147,131,141,136,165,139,143,126,132,110],
    "ew-triangle-count":[150,132,147,130,144,128,142,139,141,140,141,140],
    "ew-ending-diagonal":[160,143,153,137,139,131,143,127,139,126,137,124],
    "ew-flat-classify":[160,151,156,149,155,153,159,156,158,154,157,155],
    "ew-diagonal-versus-impulse":[160,143,153,137,148,131,143,127,139,126,137,124],
  };
  const assessmentOverrides:Record<string,number[]>={
    "ew-flat-classify":[160,151,156,149,156,154,164,157,160,151,154,143],
    "ew-triangle-count":[152,134,149,138,146,141,144,142,143,142.5,143,142.7],
    "ew-diagonal-versus-impulse":[160,148,154,143,151,140,146,138,145,135,143,133],
  };
  const comparisonOverrides:Record<string,number[]>={"ew-flat-classify":[160,151,156,149,156,154,164,159,161,156,158,153]};
  const values=caseIndex===1&&counterOverrides[unitId]?counterOverrides[unitId]:caseIndex===2&&assessmentOverrides[unitId]?assessmentOverrides[unitId]:caseIndex===3&&comparisonOverrides[unitId]?comparisonOverrides[unitId]:vary(base,unitId==="ew-fib-measure"?0:caseIndex);
  const anchorIndices=unitId==="ew-fib-measure"?values.map((_,index)=>index*10):values.map((_,index)=>Math.round(index*(total-1)/(values.length-1)));
  return Array.from({length:total},(_,index)=>{
    let segment=anchorIndices.findIndex((point)=>point>=index);
    if(segment<0) segment=anchorIndices.length-1;
    const left=Math.max(0,segment-1), right=segment;
    const fraction=left===right?0:(index-anchorIndices[left])/(anchorIndices[right]-anchorIndices[left]);
    const center=values[left]*(1-fraction)+values[right]*fraction;
    const atAnchor=anchorIndices[segment]===index;
    const startsHigh=(unitId==="ew-fib-measure"&&caseIndex===1)||["ew-bearish-impulse","ew-truncation","ew-correction-map","ew-flat-variants","ew-triangle-structure","ew-combination-structure","ew-diagonal-context","ew-alternates","ew-zigzag","ew-flat-classify","ew-correction-replay","ew-triangle-count","ew-combination-count","ew-complex-ambiguity","ew-ending-diagonal","ew-diagonal-versus-impulse","ew-diagonal-replay"].includes(unitId);
    const isLow=startsHigh?segment%2===1:segment%2===0;
    const open=+(center+(isLow?0.75:-0.75)).toFixed(2);
    const close=+(center+(isLow?0.5:-0.5)).toFixed(2);
    const high=atAnchor&&!isLow?center:+(Math.max(open,close)+0.35).toFixed(2);
    const low=atAnchor&&isLow?center:+(Math.min(open,close)-0.35).toFixed(2);
    return {time:1_700_000_000+offset+index*3600,open,high,low,close,volume:100+index};
  });
}
