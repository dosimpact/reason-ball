import type { Candle } from "@/entities/candle/@x";
import type { AnalysisPlan } from "./index";

export type PatternPolicy = "bearish-impulse" | "truncation" | "zigzag" | "flat" | "triangle" | "combination" | "diagonal" | "analysis";
export interface StructureCheck { rule: string; pass: boolean; reason: string }
const check=(rule:string,pass:boolean,reason:string):StructureCheck=>({rule,pass,reason});
export function validateWaveStructure(policy:PatternPolicy,candles:readonly Candle[],indices:readonly number[],visibleCount=candles.length):StructureCheck[] {
  const order=indices.length>=3&&indices.every((point,index)=>Number.isInteger(point)&&point>=0&&point<visibleCount&&(index===0||point>indices[index-1]));
  if (!order) return [check("time-and-visibility",false,"전환점은 공개된 봉 안에서 시간순이어야 합니다.")];
  const price=(position:number,high:boolean)=>high?candles[indices[position]].high:candles[indices[position]].low;
  if (policy==="bearish-impulse" || policy==="truncation" || policy==="diagonal") {
    if(indices.length!==6) return [check("point-count",false,"시작점과 1–5파 끝점 여섯 개가 필요합니다.")];
    const [zero,one,two,three,four,five]=[price(0,true),price(1,false),price(2,true),price(3,false),price(4,true),price(5,false)];
    const down=one<zero&&two>one&&three<two&&four>three&&five<four;
    const len1=zero-one,len3=two-three,len5=four-five;
    if(policy==="bearish-impulse") return [check("direction",down,"하락 1·3·5와 반등 2·4를 구분하세요."),check("wave-2",two<=zero,"하락 2파는 시작 고점을 넘지 않습니다."),check("wave-3",!(len3<len1&&len3<len5),"3파가 1·5파보다 모두 짧을 수 없습니다."),check("wave-4",four<one,"일반 하락 Impulse의 4파는 1파 저가에 닿지 않습니다."),check("wave-5",five<three,"표준 완료형 5파는 3파 저점을 낮춥니다.")];
    if(policy==="truncation") return [check("direction",down,"진행과 조정이 번갈아야 합니다."),check("wave-5-truncation",five>=three,"절단 후보의 5파는 3파 극점을 넘지 못합니다."),check("wave-3",!(len3<len1&&len3<len5),"3파 최단 규칙을 확인하세요.")];
    return [check("direction",down,"진행과 조정이 번갈아야 합니다."),check("diagonal-overlap",four>=one,"하락 Diagonal 후보에서는 1·4파 겹침을 확인합니다."),check("position",true,"상위 5파/C 또는 1파/A 위치 증거는 분석 계획에서 확인합니다.")];
  }
  if(policy==="zigzag" || policy==="flat") {
    if(indices.length!==4) return [check("point-count",false,"조정 시작과 A·B·C 끝 네 점이 필요합니다.")];
    const [start,a,b,c]=[price(0,true),price(1,false),price(2,true),price(3,false)];
    const ordered=a<start&&b>a&&c<b;
    if(policy==="zigzag") return [check("abc-direction",ordered,"A 하락·B 반등·C 하락을 확인하세요."),check("b-position",b<start,"Zigzag의 B는 시작점을 넘어가지 않아야 합니다."),check("c-position",c<a,"C가 A의 저점 아래로 진행하는 후보인지 확인하세요.")];
    return [check("abc-direction",ordered,"A 하락·B 반등·C 하락을 확인하세요."),check("b-retracement",(b-a)/(start-a)>=0.9,"Flat B의 회복 비율은 (B-A)/(시작-A)로 계산하고 90% 부근을 확인하세요."),check("c-direction",c<b,"C는 B에서 반대 방향으로 진행해야 합니다.")];
  }
  if(policy==="triangle") {
    if(indices.length!==6) return [check("point-count",false,"시작과 A–E 끝 여섯 점이 필요합니다.")];
    const [a,b,c,d,e]=[price(1,false),price(2,true),price(3,false),price(4,true),price(5,false)];
    return [check("alternation",a<b&&c<b&&c<d&&e<d,"A–E의 방향이 교대로 바뀌어야 합니다."),check("convergence",c>a&&d<b,"수렴형에서는 A–C 저점이 올라가고 B–D 고점이 내려옵니다."),check("e-boundary",e>=c,"E가 C 경계와 어떤 관계인지 확인하세요.")];
  }
  if(policy==="combination") return [check("segments",indices.length>=6,"W·X·Y와 각 시작·끝 구간을 표시하세요.")];
  return [check("visible",true,"공개 시점의 구간만 사용했습니다.")];
}

export function validateAnalysisPlan(plan:AnalysisPlan,visibleCount:number):StructureCheck[] {
  const checks:StructureCheck[]=[check("as-of",plan.asOf>=0&&plan.snapshotId.length>0,"판단 시점과 스냅샷이 필요합니다.")];
  for(const [hypothesisName,hypothesis] of [["primary",plan.primary],["alternate",plan.alternate]] as const){
    if(!hypothesis) continue;
    const segments=hypothesis.segments;
    const byId=new Map(segments.map((segment)=>[segment.id,segment]));
    checks.push(check(`${hypothesisName}:segment-ids`,byId.size===segments.length,"같은 가설 안에서 구간 ID는 고유해야 합니다."));
    checks.push(check(`${hypothesisName}:segment-range`,segments.every((segment)=>segment.startIndex<segment.endIndex&&segment.endIndex<visibleCount),"모든 분할은 공개 범위 안에서 시작보다 끝이 뒤여야 합니다."));
    checks.push(check(`${hypothesisName}:parent-containment`,segments.every((segment)=>!segment.parentId||(byId.has(segment.parentId)&&byId.get(segment.parentId)!.startIndex<=segment.startIndex&&segment.endIndex<=byId.get(segment.parentId)!.endIndex&&segment.degree!==byId.get(segment.parentId)!.degree)),"하위 분할은 부모 구간 안에 있고 차수가 달라야 합니다."));
    const hasCycle=segments.some((segment)=>{
      const seen=new Set<string>([segment.id]);
      let current=segment;
      while(current.parentId){
        if(seen.has(current.parentId)) return true;
        seen.add(current.parentId);
        const parent=byId.get(current.parentId);
        if(!parent) break;
        current=parent;
      }
      return false;
    });
    checks.push(check(`${hypothesisName}:parent-cycle`,!hasCycle,"부모·자식 구간이 순환해서는 안 됩니다."));
    const roots=segments.filter((segment)=>!segment.parentId).sort((a,b)=>a.startIndex-b.startIndex);
    checks.push(check(`${hypothesisName}:root-order`,roots.every((segment,index)=>index===0||roots[index-1].endIndex===segment.startIndex),"같은 차수의 최상위 구간은 겹치거나 비어 있으면 안 됩니다."));
    const parents=new Set(segments.filter((segment)=>segment.parentId).map((segment)=>segment.parentId));
    for(const parentId of parents){
      const children=segments.filter((segment)=>segment.parentId===parentId).sort((a,b)=>a.startIndex-b.startIndex);
      const parent=byId.get(parentId!);
      checks.push(check(`${hypothesisName}:child-order:${parentId}`,!!parent&&children[0]?.startIndex===parent.startIndex&&children.at(-1)?.endIndex===parent.endIndex&&children.every((child,index)=>index===0||children[index-1].endIndex===child.startIndex),"하위 구간은 부모 시작부터 끝까지 순서대로 경계를 공유해야 합니다."));
    }
  }
  const pattern=plan.primary.pattern.toLowerCase();
  const required=pattern.includes("zigzag")||pattern.includes("flat")?["A","B","C"]:pattern.includes("triangle")?["A","B","C","D","E"]:pattern.includes("wxy")?["W","X","Y"]:pattern.includes("diagonal")||pattern.includes("impulse")||pattern.includes("truncation")?["1","2","3","4","5"]:[];
  if(required.length) checks.push(check("pattern-labels",required.every((label)=>plan.primary.segments.some((segment)=>segment.label.toUpperCase()===label)),`선택한 ${plan.primary.pattern}의 필수 구간 ${required.join("·")}를 입력하세요.`));
  if(pattern.includes("zigzag")) for(const [label,count] of [["A",5],["B",3],["C",5]] as const){
    const parent=plan.primary.segments.find((segment)=>segment.label.toUpperCase()===label);
    if(parent) checks.push(check(`subdivision:${label}`,plan.primary.segments.filter((segment)=>segment.parentId===parent.id).length===count,`Zigzag ${label}의 실제 하위 ${count}구간 경계를 입력하세요.`));
  }
  if(pattern.includes("flat")) for(const [label,count] of [["A",3],["B",3],["C",5]] as const){
    const parent=plan.primary.segments.find((segment)=>segment.label.toUpperCase()===label);
    if(parent) checks.push(check(`subdivision:${label}`,plan.primary.segments.filter((segment)=>segment.parentId===parent.id).length===count,`Flat ${label}의 실제 하위 ${count}구간 경계를 입력하세요.`));
  }
  if(pattern.includes("truncation")) {
    const fifth=plan.primary.segments.find((segment)=>segment.label==="5");
    if(fifth) checks.push(check("subdivision:5",plan.primary.segments.filter((segment)=>segment.parentId===fifth.id).length===5,"절단 후보 5파의 실제 하위 다섯 구간이 필요합니다."));
  }
  if(plan.optionalTrade){const {entry,stop,target}=plan.optionalTrade;checks.push(check("optional-trade",(stop<entry&&entry<target)||(target<entry&&entry<stop),"선택한 매매의 진입·손절·목표 순서를 확인하세요."));}
  return checks;
}

export function validateCorrectionSegments(plan:AnalysisPlan,candles:readonly Candle[],visibleCount:number):StructureCheck[] {
  const pattern=plan.primary.pattern.toLowerCase();
  if(!pattern.includes("zigzag")&&!pattern.includes("flat")) return [];
  const value=(index:number)=>{const bar=candles[index];return (bar.high+bar.low)/2;};
  const roots=plan.primary.segments.filter((segment)=>!segment.parentId);
  const byLabel=new Map(roots.map((segment)=>[segment.label.toUpperCase(),segment]));
  const a=byLabel.get("A"),b=byLabel.get("B"),c=byLabel.get("C");
  if(!a||!b||!c) return [check("abc-parents",false,"A·B·C 부모 구간을 모두 표기하세요.")];
  if([a,b,c].some((segment)=>segment.endIndex>=visibleCount)) return [check("abc-visible",false,"공개 범위를 넘어선 구간입니다.")];
  const results=[check("abc-parent-direction",value(a.endIndex)<value(a.startIndex)&&value(b.endIndex)>value(b.startIndex)&&value(c.endIndex)<value(c.startIndex),"A 하락·B 반등·C 하락의 부모 구간 방향을 확인하세요.")];
  for(const parent of [a,b,c]){
    const children=plan.primary.segments.filter((segment)=>segment.parentId===parent.id).sort((left,right)=>left.startIndex-right.startIndex);
    const baseDirection=parent.label.toUpperCase()==="B"?1:-1;
    results.push(check(`child-price:${parent.label}`,children.every((child,index)=>{
      if(child.endIndex>=visibleCount) return false;
      const direction=(value(child.endIndex)-value(child.startIndex))*baseDirection*(index%2===0?1:-1);
      return direction>0;
    }),`${parent.label}의 하위 가격 움직임이 시작 방향과 번갈아야 합니다.`));
  }
  if(pattern.includes("zigzag")) results.push(check("zigzag-b",value(b.endIndex)<value(a.startIndex),"Zigzag B는 A의 시작 고점을 넘지 않아야 합니다."));
  return results;
}

export function validateMultiscaleSelection(
  parent:readonly number[],
  children:readonly number[],
  timeframes:{"1h":readonly Candle[];"4h":readonly Candle[];"1d":readonly Candle[]},
):StructureCheck[] {
  const ordered=(indices:readonly number[],size:number)=>indices.length===2&&indices.every((index,position)=>Number.isInteger(index)&&index>=0&&index<size&&(position===0||index>indices[position-1]));
  if(!ordered(parent,timeframes["1d"].length)||!ordered(children,timeframes["1h"].length)) return [check("multiscale-range",false,"닫힌 일봉과 시간봉에서 각각 시작·끝 두 점을 시간순으로 고르세요.")];
  const parentStart=timeframes["1d"][parent[0]].time;
  const parentEnd=timeframes["1d"][parent[1]].time+86400;
  const childStart=timeframes["1h"][children[0]].time;
  const childEnd=timeframes["1h"][children[1]].time+3600;
  const bounds=childStart>=parentStart&&childEnd<=parentEnd;
  const fourHourStarts=new Set(timeframes["4h"].map((bar)=>bar.time));
  const bothMapped=children.every((index)=>fourHourStarts.has(Math.floor(timeframes["1h"][index].time/14400)*14400));
  return [
    check("utc-parent-containment",bounds,"선택한 1h 하위 구간이 닫힌 1d 부모 구간의 UTC 시작·끝 안에 있어야 합니다."),
    check("closed-4h-bridge",bothMapped,"두 1h 기준점에 해당하는 4h 봉이 확정되어 있어야 합니다."),
  ];
}

export function validateFlatVariant(variant:"regular-flat"|"expanded-flat"|"running-flat",start:number,a:number,b:number,c:number):StructureCheck[] {
  const retracement=(b-a)/(start-a);
  const generic=start>a&&b>a&&c<b&&retracement>=0.9;
  const position=variant==="regular-flat"?b<=start&&c<a:variant==="expanded-flat"?b>start&&c<a:b>start&&c>a;
  return [check("flat-retracement",generic,"Flat의 B는 A 하락폭을 약 90% 이상 회복해야 합니다."),check("flat-variant",position,`${variant}의 B·C 상대 종점을 확인하세요.`)];
}
