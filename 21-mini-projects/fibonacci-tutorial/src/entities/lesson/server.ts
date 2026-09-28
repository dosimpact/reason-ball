import "server-only";
import { analysisPlanSchema, gradeQuiz, gradeRubric, validateAnalysisPlan, validateCorrectionSegments, validateFlatVariant, validateWaveStructure, type LearningGrade, type LearningSubmission, type LearningView, type PatternPolicy } from "./index";
import { lessonDefinitions, type LessonCase, type LessonDefinition } from "./definitions";

import { authoredPatternCandles } from "./pattern-fixtures";

for (const definition of lessonDefinitions) {
  if (definition.kind === "theory") definition.candles = authoredPatternCandles(definition.id,60,0,lessonDefinitions.indexOf(definition)*400_000);
  definition.cases?.forEach((lessonCase,index)=>{
    if (lessonCase.source === "authored-dummy") lessonCase.candles=authoredPatternCandles(definition.id,lessonCase.totalCount,index,lessonDefinitions.indexOf(definition)*400_000+index*100_000);
  });
}
export { lessonDefinitions };
export type { LessonCase, LessonDefinition };
export function getLessonDefinition(unitId:string):LessonDefinition | undefined { return lessonDefinitions.find((definition)=>definition.id===unitId); }
export function getLessonCase(unitId:string,caseIndex=0):LessonCase | undefined { return getLessonDefinition(unitId)?.cases?.[caseIndex]; }
export function getLearningView(unitId:string,caseIndex=0,stepIndex=0,feedback:string[]=[],objectivePassed=false,submitted=false):LearningView | undefined {
  const definition=getLessonDefinition(unitId);
  if (!definition) return undefined;
  if (definition.kind==="theory") return {kind:"theory",profile:definition.profile,steps:definition.steps?.[stepIndex]?[definition.steps[stepIndex]]:[],stepIndex,stepCount:definition.steps?.length??0,questions:stepIndex>=4?definition.questions:undefined,caseIndex:0,caseCount:1,submitted,feedback,objectivePassed,selfAssessment:false};
  const lessonCase=definition.cases?.[caseIndex];
  if (!lessonCase) return undefined;
  const {expected,acceptableAlternates,invalidation,completionEvidence,candles,feedback:privateFeedback,...currentCase}=lessonCase;
  void expected;void acceptableAlternates;void invalidation;void completionEvidence;void candles;void privateFeedback;
  return {kind:"practice",profile:definition.profile,currentCase,caseIndex,caseCount:definition.cases?.length??1,stepIndex:0,stepCount:0,submitted,feedback,objectivePassed,selfAssessment:lessonCase.source!=="authored-dummy"};
}
export function gradeLearningSubmission(unitId:string,submission:LearningSubmission,caseIndex=0,visibleCount?:number):LearningGrade {
  const definition=getLessonDefinition(unitId);
  if (!definition) throw new Error(`Unknown lesson: ${unitId}`);
  if (definition.kind==="theory") return gradeQuiz(definition.correctAnswers??[],submission.answers??{});
  const lessonCase=definition.cases?.[caseIndex];
  if (!lessonCase || submission.caseId!==lessonCase.id) throw new Error("Case ID does not match current lesson case.");
  const values=submission.values??{};
  const feedback:string[]=[];
  for (const field of lessonCase.fields) {
    const value=values[field.key];
    if (field.required && (value===undefined || value==="" || (Array.isArray(value) && value.length===0))) feedback.push(`${field.label}을 제출하세요.`);
    if (field.kind==="points" && Array.isArray(value)) {
      if (value.length!==field.count || value.some((point,index)=>typeof point!=="number" || !Number.isInteger(point) || point<0 || point>=(visibleCount??lessonCase.visibleCount) || (index>0 && point<=Number(value[index-1])))) feedback.push(`${field.label}: 공개된 봉 안에서 시간순 ${field.count}점을 선택하세요.`);
    }
    if (field.kind==="number" && typeof value!=="number") feedback.push(`${field.label}: 숫자를 입력하세요.`);
    const expected=lessonCase.expected[field.key];
    if (typeof expected==="number" && typeof value==="number" && Math.abs(value-expected)>0.01) feedback.push(`${field.label}: 기준점·방향·원값을 다시 계산하세요.`);
    if (typeof expected==="string" && value!==expected) feedback.push(`${field.label}: 분할과 상대 종점을 다시 비교하세요.`);
  }
  const points=values.points;
  const policyByUnit:Record<string,PatternPolicy>={"ew-bearish-impulse":"bearish-impulse","ew-truncation":"truncation","ew-zigzag":"zigzag","ew-flat-classify":"flat","ew-triangle-count":"triangle","ew-combination-count":"combination","ew-ending-diagonal":"diagonal"};
  const policy=policyByUnit[unitId];
  if (policy && lessonCase.candles && Array.isArray(points) && points.every((point)=>typeof point==="number")) {
    const results=validateWaveStructure(policy,lessonCase.candles,points as number[],visibleCount??lessonCase.visibleCount);
    if(lessonCase.phase==="counterexample" && policy!=="combination") {
      const failures=results.filter((result)=>!result.pass);
      if(failures.length===0) feedback.push("반례에서 실패 규칙을 찾지 못했습니다. 다른 구간을 선택하세요.");
      else if(typeof values.violation!=="string"||!failures.some((result)=>String(values.violation).toLowerCase().includes(result.rule))) feedback.push(`실패 규칙을 이름으로 적으세요: ${failures.map((item)=>item.rule).join(", ")}`);
    } else for (const result of results) if (!result.pass) feedback.push(`${result.rule}: ${result.reason}`);
  }
  if (values.analysis!==undefined) {
    const parsed=analysisPlanSchema.safeParse(values.analysis);
    if (!parsed.success) feedback.push("분석 계획의 패턴·차수·근거·무효화·시점 항목을 채우세요.");
    else {
      for(const result of validateAnalysisPlan(parsed.data,visibleCount??lessonCase.visibleCount)) if(!result.pass) feedback.push(`${result.rule}: ${result.reason}`);
      if(lessonCase.candles && lessonCase.phase!=="counterexample") for(const result of validateCorrectionSegments(parsed.data,lessonCase.candles,visibleCount??lessonCase.visibleCount)) if(!result.pass) feedback.push(`${result.rule}: ${result.reason}`);
      const requiredPatternByUnit:Record<string,string>={"ew-truncation":"truncation","ew-impulse-audit":"impulse","ew-zigzag":"zigzag","ew-flat-classify":"flat","ew-triangle-count":"triangle","ew-combination-count":"wxy","ew-ending-diagonal":"diagonal","ew-diagonal-replay":"diagonal"};
      const required=unitId==="ew-diagonal-versus-impulse"?["impulse","diagonal","wxy"][caseIndex]:requiredPatternByUnit[unitId];
      if(lessonCase.source==="authored-dummy" && lessonCase.phase!=="counterexample" && required && !parsed.data.primary.pattern.toLowerCase().includes(required)) feedback.push(`${required} 구조를 실제 구간과 연결해 분석하세요.`);

      if (["ew-correction-replay","ew-complex-ambiguity","ew-alternate-replay","ew-blind-analysis","ew-final-portfolio"].includes(unitId) && !parsed.data.alternate && !parsed.data.abstainReason) feedback.push("대안 카운팅 또는 판단 유보 근거가 필요합니다.");
      if (lessonCase.phase==="counterexample" && !parsed.data.abstainReason && !parsed.data.primary.evidence.includes("위반")) feedback.push("반례에서 실패 규칙 또는 판단 유보를 명시하세요.");
    }
  }
  if (unitId==="ew-fib-measure" && lessonCase.candles && Array.isArray(values.anchors)) {
    const anchors=values.anchors as number[];
    const expected=lessonCase.expected.anchors as number[];
    if(anchors.length!==3||anchors.some((value,index)=>value!==expected[index])) feedback.push("사례의 S·E·P 기준점 세 개를 다시 선택하세요.");
  }
  if (unitId==="ew-flat-classify" && lessonCase.candles && lessonCase.phase!=="counterexample" && typeof values.classification==="string" && ["regular-flat","expanded-flat","running-flat"].includes(values.classification)) {
    const anchor=(position:number)=>Math.round(position*(lessonCase.totalCount-1)/11);
    const value=(position:number)=>{const bar=lessonCase.candles![anchor(position)];return (bar.high+bar.low)/2;};
    for(const result of validateFlatVariant(values.classification as "regular-flat"|"expanded-flat"|"running-flat",value(0),value(3),value(6),value(11))) if(!result.pass) feedback.push(`${result.rule}: ${result.reason}`);
  }
  if (unitId==="ew-channel-time" && lessonCase.candles && Array.isArray(points) && points.length===3 && points.every((point)=>typeof point==="number")) {
    const [start,middle,end]=points as number[];
    if(start<end && end<(visibleCount??lessonCase.visibleCount)) {
      const candles=lessonCase.candles;
      const projectedLow=candles[start].low+(candles[end].low-candles[start].low)*(middle-start)/(end-start);
      const width=candles[middle].high-projectedLow;
      if(typeof values.width!=="number"||Math.abs(values.width-width)>0.01) feedback.push("채널 폭은 중간 고점과 두 저점 평행선의 차이로 계산하세요.");
      if(values.bars!==end-start) feedback.push("봉 수는 두 기준 저점의 인덱스 차이로 기록하세요.");
    }
  }
  if (unitId==="ew-live-followup" && submission.observedAt===undefined) feedback.push("새 확정봉을 관측하기 전에는 대기 상태입니다.");
  const objectivePassed=feedback.length===0;
  const needsRubric=lessonCase.fields.some((field)=>field.kind==="analysis");
  const selfAssessmentPassed=needsRubric ? gradeRubric(submission.rubric??[]) : true;
  if (needsRubric && !selfAssessmentPassed) feedback.push("실전 분석은 자기 점검 5항목에서 각 1점 이상, 합계 8점 이상을 기록하세요. 전문가 인증 점수가 아닙니다.");
  if (objectivePassed) feedback.push(lessonCase.feedback);
  return {passed:objectivePassed&&selfAssessmentPassed,objectivePassed,selfAssessmentPassed,score:objectivePassed?1:0,feedback};
}
