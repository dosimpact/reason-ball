import type { Candle } from "@/entities/candle/@x";
import { getTheoryQuestions } from "./questions";
import type { DataProfile, LessonField, LessonQuestion, LessonStep, CaseView } from "./index";

export interface LessonDefinition {
  candles?: Candle[]; id: string; chapterId: string; title: string; kind: "theory" | "practice"; profile: DataProfile;
  objective: string; completionCriteria: string; steps?: LessonStep[]; questions?: LessonQuestion[];
  correctAnswers?: number[]; cases?: LessonCase[];
}
export interface LessonCase extends CaseView {
  candles?: Candle[];
  expected: Record<string, string | number | number[]>;
  acceptableAlternates: string[];
  invalidation: string;
  feedback: string;
  completionEvidence: string;
}


export type TheorySeed = readonly [string, string, string, string, string, string, string, string, string];
export type PracticeSeed = readonly [string, string, string, string, string, string];
export function theory(seed: TheorySeed, chapterId: string): LessonDefinition {
  const [id,title,concept,criterion,chart,counterexample,summary,_distinction,profile] = seed;
  void _distinction;
  const bodies = [concept,criterion,chart,counterexample,summary];
  const titles = ["개념과 표기","판정 기준","차트에서 확인","반례와 한계","적용 요약"];
  const steps = bodies.map((body,index) => ({ title: titles[index], body, visibleCount: [12,24,36,48,60][index], focusIndices: [index*10, Math.min(index*10+5,59)] }));
  const { questions, correctAnswers } = getTheoryQuestions(id);
  return {id,chapterId,title,kind:"theory",profile:profile as DataProfile,objective:concept,completionCriteria:"5단계 완료와 3문항 중 2문항 정답",steps,questions,correctAnswers};
}
function fields(kind: string,id: string): LessonField[] {
  const text = (key:string,label:string,help:string):LessonField => ({key,label,kind:"text",required:true,help});
  const analysis:LessonField = {key:"analysis",label:"파동 분석 계획",kind:"analysis",required:true,help:"주 해석·대안 또는 유보·규칙·기준점·무효화·다음 관찰을 기록하세요."};
  if (kind === "numeric") return [{key:"anchors",label:"S·E·P 캔들 인덱스",kind:"points",count:3,required:true},...[["r382","38.2% 되돌림"],["r500","50% 되돌림"],["r618","61.8% 되돌림"],["r786","78.6% 되돌림"],["p100","1.0 투사"],["p1618","1.618 투사"],["p2618","2.618 투사"]].map(([key,label])=>({key,label,kind:"number" as const,required:true})),text("direction","방향과 부호 설명","하락에서도 같은 식을 사용합니다.")];
  if (kind === "wave") return [{key:"points",label:"0–5파 전환점",kind:"points",count:6,required:true},text("ruleEvidence","하락 2·3·4파 규칙 근거","가격 경계와 내부 분할을 설명하세요.")];
  if (kind === "channel") return [{key:"points",label:"평행 채널 기준점",kind:"points",count:3,required:true},{key:"width",label:"채널 가격 폭",kind:"number",required:true},{key:"bars",label:"비교 봉 수",kind:"number",required:true},text("limit","시간 도구의 한계","확정 반전 시점이 아님을 설명하세요.")];
  if (kind === "choice") return [{key:"classification",label:"패턴 분류",kind:"choice",options:["regular-flat","expanded-flat","running-flat","impulse-invalid","diagonal-candidate","combination","defer"],required:true},text("evidence","분할·위치·가격 근거","겹침 하나만으로 Diagonal을 단정하지 마세요."),{key:"analysis",label:"패턴별 구조 분석",kind:"analysis",required:true,help:"분류한 패턴의 부모·하위 구간과 적용 규칙을 입력하세요."}];
  if (kind === "segments") return [{key:"points",label:"부모 구간의 경계점",kind:"points",count:id==="ew-zigzag"?4:6,required:true},analysis];
  if (kind === "multiscale") return [{key:"parent",label:"닫힌 상위봉 인덱스",kind:"points",count:2,required:true},{key:"children",label:"그 안의 하위 구간 인덱스",kind:"points",count:2,required:true},analysis];
  if (kind === "portfolio") return [analysis,{...text("postObservation","이 구간의 평가·회고","새 봉 관측 후 원본 가설과 수정 이유를 기록하세요."),required:false}];
  if (kind === "replay") return [analysis,{...text("postObservation","새 봉 관측 후 유지·수정·폐기 이유","Replay 이후 평가에서 기록하세요. 사전 분석 단계에서는 비워 둡니다."),required:false}];
  return [analysis];
}
function expectedForCase(id:string,kind:string,index:number,totalCount:number):Record<string,string|number|number[]> {
  if(kind==="numeric") {
    const [start,end,projectionBase]=index===1?[120,100,110]:index===2?[90,114,104]:[100,120,110];
    const retrace=(ratio:number)=>end-ratio*(end-start);
    const project=(ratio:number)=>projectionBase+ratio*(end-start);
    return {anchors:[0,10,20],r382:retrace(.382),r500:retrace(.5),r618:retrace(.618),r786:retrace(.786),p100:project(1),p1618:project(1.618),p2618:project(2.618)};
  }
  if(kind==="choice") return {classification:id==="ew-diagonal-versus-impulse"?["impulse-invalid","diagonal-candidate","combination"][index]:["regular-flat","defer","expanded-flat"][index]};
  const anchorCount=id==="ew-zigzag"?14:12;
  if(["wave","segments"].includes(kind)) return {points:(id==="ew-zigzag"?[0,5,8,13]:[0,1,2,3,4,5]).map((point)=>Math.round(point*(totalCount-1)/(anchorCount-1)))};
  return {};
}
export function practice(seed: PracticeSeed, chapterId: string): LessonDefinition {
  const [id,title,profile,objective,evidence,kind] = seed;
  const source = profile === "H" || profile === "HR" || profile === "M" ? "binance-historical" : profile === "L" ? "binance-recent" : "authored-dummy";
  const totalCount = profile === "D96" || profile === "D96R" ? 96 : profile === "H" || profile === "HR" || profile === "L" ? 120 : profile === "M" ? 480 : 60;
  const visibleCount = profile === "D60R" ? 30 : profile === "D96R" ? 48 : profile === "H" || profile === "HR" || profile === "L" ? 80 : profile === "M" ? 240 : totalCount;
  const cases:LessonCase[] = (["basic","counterexample","assessment"] as const).map((phase,index) => {
    const instruction = phase === "basic" ? `${objective} 공개 구간의 기준점과 근거를 직접 제출하세요.` : phase === "counterexample" ? `${objective} 비슷해 보이지만 규칙 또는 분할이 다른 반례를 찾아 수정하세요.` : `${objective} 예시 없이 평가 변형을 독립적으로 분석하세요.`;
    const caseObjective=id==="ew-final-portfolio"?["첫 구간: Impulse 또는 규칙 위반을 분석·평가한다.","둘째 구간: 조정 또는 Diagonal 후보와 반례를 분석·평가한다.","셋째 구간: 애매한 구조의 대안 또는 관망 근거를 분석·평가한다."][index]:objective;
    return {id:`${id}-${phase}-v1`,title:`${title} · ${["기본 사례","반례","평가 변형"][index]}`,objective:caseObjective,profile:profile as DataProfile,source,sourceNote:source === "authored-dummy" ? "교육용 직접 제작 OHLC. 실제 시장 데이터가 아닙니다." : "Binance Spot 확정봉. UTC 범위와 snapshotId를 세션 생성 시 고정합니다. 실전 패턴의 유일 정답을 가정하지 않습니다.",visibleCount,totalCount,instruction:id==="ew-final-portfolio"?caseObjective+" 공개 구간의 분석 원본을 확정하고 이후 평가와 회고를 남기세요.":instruction,fields:phase==="counterexample"&&["wave","segments"].includes(kind)?[...fields(kind,id),{key:"violation",label:"실패 규칙 또는 분할",kind:"text",required:true,help:"관찰한 반례의 객관 실패 규칙을 이름과 근거로 기록하세요."}]:fields(kind,id),phase,canReveal:phase!=="assessment",expected:expectedForCase(id,kind,index,totalCount),acceptableAlternates:phase==="counterexample"?["근거 있는 판단 유보","객관 규칙을 통과하는 대안 카운팅"]:["다른 유효 카운팅과 명시된 무효화 기준"],invalidation:phase==="counterexample"?"단일 외형이 맞아도 내부 분할이나 위치 규칙을 위반하면 원래 분류를 폐기한다.":"공개 범위 밖 봉과 역순 구간을 근거로 사용할 수 없다.",feedback:phase==="basic"?`제출한 ${evidence}을 공개 범위와 규칙표에 대조하세요.`:phase==="counterexample"?"실패 규칙을 이름과 가격·구간 근거로 설명하세요.":"예시 없이 객관 검사와 자기 평가를 분리해 보존하세요.",completionEvidence:evidence};
  });
  if (["ew-impulse-audit","ew-flat-classify","ew-diagonal-versus-impulse"].includes(id)) cases.push({...cases[0],id:`${id}-comparison-v1`,title:id==="ew-flat-classify"?"Flat 유형 비교 · Running Flat":"${title} · 추가 비교",instruction:id==="ew-flat-classify"?"B가 시작점을 넘지만 C가 A 끝에 도달하지 않는 Running Flat 후보의 3–3–5를 검토하세요.":`${objective} 별도 네 번째 사례의 근거를 기록하세요.`,expected:id==="ew-flat-classify"?{classification:"running-flat"}:cases[0].expected,phase:"basic"});
  return {id,chapterId,title,kind:"practice",profile:profile as DataProfile,objective,completionCriteria:evidence,cases};
}
