import type { Meta, StoryObj } from "@storybook/react-vite";
import { catalog, sessionViewSchema, type SessionView } from "@/entities/tutorial";
import { tradePlanSchema } from "@/entities/trade-plan";
import { tradeEvaluationSchema } from "@/entities/trade-evaluation";
import { abortMonitoring, advanceMonitoring, createMonitoringState } from "@/entities/strategy-monitor";
import { StrategyMonitor } from "@/widgets/strategy-monitor";
import { TutorialWorkspace } from "./index";
import { AdvancedLesson } from "./advanced";
import { TutorialError, TutorialLoading } from "./status";

const units = catalog.chapters.flatMap((chapter) => chapter.units);
const unit = (id: string) => units.find((item) => item.id === id)!;
const candles = [[102,106,100,104],[104,110,103,108],[108,116,107,114],[114,120,112,118],[118,119,113,115],[115,117,111,113],[113,115,110,112],[112,116,111,114],[114,121,113,119],[119,130,118,128],[128,143,127,141],[141,146,138,144]].map(([open,high,low,close], index) => ({ time:1770000000 + index * 3600, open, high, low, close }));
const plan = tradePlanSchema.parse({ schemaVersion:"1", id:"11111111-1111-4111-8111-111111111111", sessionId:"22222222-2222-4222-8222-222222222222", unitId:"wave-three", createdAt:"2026-09-27T00:00:00.000Z", asOf:candles[7].time, snapshotId:"story-preview", source:"dummy", wavePoints:[{ wave:0,candleIndex:0,time:candles[0].time,price:100 },{ wave:1,candleIndex:3,time:candles[3].time,price:120 },{ wave:2,candleIndex:6,time:candles[6].time,price:110 }], entry:114, stopLoss:99, target:142.36, rationale:"2파 저점을 확인하고 1파 길이의 1.618배 확장을 목표로 삼았습니다.", fibonacci:{ retracement:.5, extension1618:142.36 }, policyVersion:"touch-v1" });
const evaluation = tradeEvaluationSchema.parse({ id:"33333333-3333-4333-8333-333333333333", planId:plan.id, evaluatedAt:"2026-09-27T00:00:00.000Z", observedThrough:candles[11].time, status:"target", entryPrice:114, exitPrice:142.36, resultR:1.890667, reason:"목표가에 도달했습니다.", returnPercent:24.88, riskRewardRatio:1.89, feedback:[{ rule:"Wave 2", pass:true, reason:"2파 저점이 시작점 위에 있습니다." }] });
function session(unitId: string, patch: Partial<SessionView> = {}) { return sessionViewSchema.parse({ id:plan.sessionId, unitId, cursor:7, visibleCandles:candles.slice(0,8), totalCandles:candles.length, plan:null, evaluations:[], complete:false, unit:unit(unitId), source:{ type:"dummy" }, theoryStep:0, theoryStepCount:3, instruction:{ title:unit(unitId).title, description:unit(unitId).description, showFibonacci:unitId.includes("fibonacci") }, selectedIndices:[], validation:[], hint:null, exampleIndices:null, plans:[], reflection:null, ...patch }); }
function Stage({ children }: { children: React.ReactNode }) { return <div style={{ padding:32, minHeight:"100vh", maxWidth:1400, margin:"auto" }}>{children}</div>; }
function WorkspaceStory({ value, indices }: { value: SessionView; indices: number[] }) { return <Stage><TutorialWorkspace session={value} waveIndices={indices} chooseCandle={() => {}} undo={() => {}} reset={() => {}} confirm={() => {}} advance={() => {}} prev={() => {}} check={() => {}} hint={() => {}} revise={() => {}} replay={() => {}} evaluate={() => {}} reflect={() => {}} playing={false} setPlaying={() => {}} pending={false} /></Stage>; }
const meta = { title:"Tutorial/Complete Learning Flow" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { render: () => <Stage><TutorialLoading /></Stage> };
export const Error: Story = { render: () => <Stage><TutorialError message="저장된 세션을 찾을 수 없습니다." onNewSession={() => {}} pending={false} /></Stage> };
export const TheoryStep: Story = { render: () => <WorkspaceStory value={session("impulse-theory", { selectedIndices:[0,3], instruction:{ title:"Impulse: 시작점과 1파", description:"현재 공개된 파동 구조를 살펴보세요.", showFibonacci:false } })} indices={[]} /> };
export const SixPointCount: Story = { render: () => <WorkspaceStory value={session("wave-counting", { visibleCandles:candles, cursor:11 })} indices={[0,2,4,6,8,10]} /> };
export const RuleFeedback: Story = { render: () => <WorkspaceStory value={session("rules-practice", { visibleCandles:candles, cursor:11, validation:[{ rule:"Wave 2", pass:true, reason:"시작점 위입니다." },{ rule:"Wave 3", pass:false, reason:"3파는 가장 짧을 수 없습니다." }], hint:"3파의 길이를 비교해 보세요." })} indices={[0,2,4,6,8,10]} /> };
export const FibonacciPractice: Story = { render: () => <WorkspaceStory value={session("fibonacci-practice", { exampleIndices:[0,3,6] })} indices={[0,3,6]} /> };
export const DraftTrade: Story = { render: () => <WorkspaceStory value={session("wave-three")} indices={[0,3]} /> };
export const ConfirmedPlan: Story = { render: () => <WorkspaceStory value={session("wave-three", { plan, plans:[plan] })} indices={[0,3,6]} /> };
export const EvaluatedResult: Story = { render: () => <WorkspaceStory value={session("trade-review", { cursor:11, visibleCandles:candles, plan, plans:[plan], evaluations:[evaluation], complete:true })} indices={[0,3,6]} /> };
export const MarketLab: Story = { render: () => <WorkspaceStory value={session("market-lab", { source:{ type:"binance", symbol:"BTCUSDT", interval:"1h" }, plan, plans:[plan], evaluations:[evaluation] })} indices={[0,3,6]} /> };
function AdvancedStory({ value }: { value: SessionView }) { return <Stage><AdvancedLesson session={value} update={() => {}} pending={false} setPending={() => {}} actionError="" setActionError={() => {}} /></Stage>; }
export const FiveStepTheory: Story = { render: () => <AdvancedStory value={session("ew-fib-anchors", { theoryStep:4, theoryStepCount:5, visibleCandles:candles, cursor:11, learning:{ kind:"theory", profile:"T", steps:[{ title:"적용 요약", body:"S·E·P와 방향을 먼저 고른 후 비율을 적용합니다.", visibleCount:12, focusIndices:[0,5] }], stepIndex:4, stepCount:5, questions:[{ id:"q1", prompt:"50%는 필수 규칙인가요?", options:["아니요. 가이드라인입니다.","네. 필수 규칙입니다."] },{ id:"q2", prompt:"먼저 기록할 것은?", options:["공개된 기준점", "미래 가격"] },{ id:"q3", prompt:"후보 가격은 확정인가요?", options:["아니요", "네"] }], caseIndex:0, caseCount:1, submitted:false, feedback:[], objectivePassed:false, selfAssessment:false } })} /> };
export const NumericWorkbook: Story = { render: () => <AdvancedStory value={session("ew-fib-measure", { visibleCandles:candles, cursor:11, learning:{ kind:"practice", profile:"D60", stepIndex:0, stepCount:0, caseIndex:0, caseCount:3, currentCase:{ id:"ew-fib-measure-basic-v1", title:"되돌림·확장 직접 측정 · 기본 사례", objective:"상승과 하락의 기준점과 값을 계산합니다.", profile:"D60", source:"authored-dummy", sourceNote:"교육용 직접 제작 OHLC", visibleCount:12, totalCount:12, instruction:"S·E·P를 고른 뒤 가격을 계산하세요.", fields:[{ key:"anchors", label:"S·E·P 기준점", kind:"points", required:true, count:3 },{ key:"r382", label:"38.2% 되돌림", kind:"number", required:true },{ key:"r500", label:"50% 되돌림", kind:"number", required:true },{ key:"r618", label:"61.8% 되돌림", kind:"number", required:true },{ key:"r786", label:"78.6% 되돌림", kind:"number", required:true },{ key:"p100", label:"1.0 투사", kind:"number", required:true },{ key:"p1618", label:"1.618 투사", kind:"number", required:true },{ key:"p2618", label:"2.618 투사", kind:"number", required:true },{ key:"direction", label:"방향 근거", kind:"text", required:true }], phase:"basic", canReveal:true }, submitted:false, feedback:[], objectivePassed:false, selfAssessment:false } })} /> };

const loadedMonitor = createMonitoringState(plan, "2026-09-27T00:00:00.000Z", candles[7].close);
const openMonitor = advanceMonitoring(loadedMonitor, plan, candles[8], "2026-09-27T01:00:00.000Z");
function MonitorStory({ state }: { state: typeof loadedMonitor }) { return <Stage><div style={{ maxWidth:420 }}><StrategyMonitor plan={plan} monitoring={state} history={[]} sourceType="binance" onAbort={() => {}} onStart={() => {}} onStop={() => {}} autoMonitoring={false} pending={false} /></div></Stage>; }
export const MonitorPending: Story = { render: () => <MonitorStory state={loadedMonitor} /> };
export const MonitorOpen: Story = { render: () => <MonitorStory state={openMonitor} /> };
export const MonitorWarning: Story = { render: () => <MonitorStory state={{ ...openMonitor, health:"warning", distanceToInvalidation:1, distancePercent:1, currentPrice:101 }} /> };
export const MonitorInvalidated: Story = { render: () => <MonitorStory state={advanceMonitoring(openMonitor, plan, { time:candles[9].time, open:110, high:112, low:98, close:101 }, "2026-09-27T02:00:00.000Z")} /> };
export const MonitorAborted: Story = { render: () => <MonitorStory state={abortMonitoring(openMonitor, plan, candles[8].close, "2026-09-27T02:00:00.000Z", "공개 봉에서 추세 근거가 약해져 수동 중단합니다.")} /> };
