import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getLessonDefinition, gradeLearningSubmission, lessonDefinitions } from "./server";
import { validateWaveStructure, type AnalysisPlan, type LearningSubmission, type PatternPolicy } from "./index";

function structuredSegments(pattern:string,visibleCount:number,unitId:string){
  const labels=pattern==="zigzag"||pattern==="flat"?["A","B","C"]:pattern==="triangle"?["A","B","C","D","E"]:pattern==="wxy"?["W","X","Y"]:["1","2","3","4","5"];
  const anchorCount=unitId==="ew-zigzag"?14:12;
  const anchor=(position:number)=>Math.round(position*(visibleCount-1)/(anchorCount-1));
  const correctionBounds=pattern==="zigzag"?[0,5,8,13]:pattern==="flat"?[0,3,6,11]:undefined;
  const roots:AnalysisPlan["primary"]["segments"]=labels.map((label,index)=>({id:`root-${label}`,label,degree:"minor",startIndex:correctionBounds?anchor(correctionBounds[index]):Math.floor(index*(visibleCount-1)/labels.length),endIndex:correctionBounds?anchor(correctionBounds[index+1]):Math.floor((index+1)*(visibleCount-1)/labels.length),childLabels:[]}));
  const children:AnalysisPlan["primary"]["segments"]=[];
  const needed=pattern==="zigzag"?{A:5,B:3,C:5}:pattern==="flat"?{A:3,B:3,C:5}:pattern==="truncation"?{"5":5}:{} as Record<string,number>;
  for(const root of roots){
    const count=(needed as Record<string,number>)[root.label]??0;
    for(let index=0;index<count;index++) children.push({id:`${root.id}-${index+1}`,parentId:root.id,label:String(index+1),degree:"subminor",startIndex:correctionBounds?anchor(correctionBounds[labels.indexOf(root.label)]+index):root.startIndex+Math.floor(index*(root.endIndex-root.startIndex)/count),endIndex:correctionBounds?anchor(correctionBounds[labels.indexOf(root.label)]+index+1):root.startIndex+Math.floor((index+1)*(root.endIndex-root.startIndex)/count),childLabels:[]});
  }
  return [...roots,...children];
}
function submissionFor(unitId:string,caseIndex:number){
  const definition=getLessonDefinition(unitId)!;
  const lessonCase=definition.cases![caseIndex];
  const values:NonNullable<LearningSubmission["values"]>={};
  for(const field of lessonCase.fields){
    if(field.kind==="points") values[field.key]=field.key==="anchors"?[0,10,20]:lessonCase.expected.points??Array.from({length:field.count??3},(_,index)=>index*Math.max(1,Math.floor((lessonCase.visibleCount-1)/(field.count??3))));
    else if(field.kind==="number") values[field.key]=lessonCase.expected[field.key]??1;
    else if(field.kind==="choice") values[field.key]=lessonCase.expected[field.key]??field.options?.[0];
    else if(field.kind==="text") values[field.key]=field.key==="violation"?"wave-4 위반":`${unitId} 공개 구간과 가격 경계를 관찰했습니다.`;
    else if(field.kind==="analysis") {
      const policy:Record<string,string>={"ew-truncation":"truncation","ew-impulse-audit":"impulse","ew-zigzag":"zigzag","ew-flat-classify":"flat","ew-triangle-count":"triangle","ew-combination-count":"wxy","ew-ending-diagonal":"diagonal","ew-diagonal-replay":"diagonal"};
      const pattern=lessonCase.phase==="counterexample"?"판단 유보":unitId==="ew-diagonal-versus-impulse"?["impulse","diagonal","wxy"][caseIndex%3]:policy[unitId]??"판단 유보";
      values[field.key]={primary:{pattern,direction:"uncertain",degree:"minor",segments:pattern==="판단 유보"?[]:structuredSegments(pattern,lessonCase.visibleCount,unitId),evidence:"위반 가능성을 공개된 봉에서 확인",invalidation:"새 봉에서 경계 이탈",},alternate:{pattern:"대안",direction:"sideways",degree:"minor",segments:[],evidence:"다른 분할 가능성",invalidation:"경계 이탈"},abstainReason:"내부 분할 부족",rules:"객관 규칙과 가이드라인 분리",guidelines:"비율은 보조",anchors:"공개된 기준점",nextObservation:"다음 확정봉",asOf:lessonCase.candles?.[lessonCase.visibleCount-1]?.time??1,snapshotId:"test-snapshot"};
    }
  }
  if(unitId==="ew-channel-time" && Array.isArray(values.points) && lessonCase.candles){
    const [start,middle,end]=values.points as number[];
    const candles=lessonCase.candles;
    values.width=candles[middle].high-(candles[start].low+(candles[end].low-candles[start].low)*(middle-start)/(end-start));
    values.bars=end-start;
  }
  if(lessonCase.phase==="counterexample" && Array.isArray(values.points) && lessonCase.candles){
    const policy:Record<string,PatternPolicy>={"ew-bearish-impulse":"bearish-impulse","ew-truncation":"truncation","ew-zigzag":"zigzag","ew-triangle-count":"triangle","ew-combination-count":"combination","ew-ending-diagonal":"diagonal"};
    const name=policy[unitId];
    if(name) values.violation=validateWaveStructure(name,lessonCase.candles,values.points as number[],lessonCase.visibleCount).find((item)=>!item.pass)?.rule??"분할 위반";
  }
  if(unitId==="ew-live-followup") return {caseId:lessonCase.id,values,observedAt:1,rubric:[2,2,2,1,1]};
  return {caseId:lessonCase.id,values,rubric:[2,2,2,1,1]};
}
describe("every advanced practice case can be graded",()=>{
  it("checks all 22 practices and each authored or historical case",()=>{
    const failures:string[]=[];
    for(const definition of lessonDefinitions.filter((lesson)=>lesson.kind==="practice")){
      for(let caseIndex=0;caseIndex<definition.cases!.length;caseIndex++){
        const submission=submissionFor(definition.id,caseIndex);
        const grade=gradeLearningSubmission(definition.id,submission,caseIndex,definition.cases![caseIndex].visibleCount);
        if(!grade.passed) failures.push(`${definition.id}/${caseIndex}: ${grade.feedback.join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
  });
  it("rejects a missing required field and invalid rubric in every case",()=>{
    for(const definition of lessonDefinitions.filter((lesson)=>lesson.kind==="practice")){
      for(let caseIndex=0;caseIndex<definition.cases!.length;caseIndex++){
        const lessonCase=definition.cases![caseIndex];
        const good=submissionFor(definition.id,caseIndex);
        const missing={...good,values:{...good.values}};
        delete missing.values[lessonCase.fields[0].key];
        const grade=gradeLearningSubmission(definition.id,missing,caseIndex,lessonCase.visibleCount);
        expect(grade.passed,`${definition.id}/${caseIndex}`).toBe(false);
        if(lessonCase.fields.some((field)=>field.kind==="analysis")){
          const rubricGrade=gradeLearningSubmission(definition.id,{...good,rubric:[2,2,2,2,0]},caseIndex,lessonCase.visibleCount);
          expect(rubricGrade.passed,`${definition.id}/${caseIndex} rubric`).toBe(false);
        }
      }
    }
  });
});
