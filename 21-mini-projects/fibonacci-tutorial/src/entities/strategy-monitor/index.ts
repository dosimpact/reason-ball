import { z } from "zod";
import type { Candle } from "@/entities/candle/@x";

export const monitoringPolicySchema=z.enum(["auto-abort","warn-only"]);
export type MonitoringPolicy=z.infer<typeof monitoringPolicySchema>;
export const monitoringRuleInputSchema=z.discriminatedUnion("kind",[
  z.strictObject({kind:z.literal("price-level"),level:z.number().finite().positive()}),
  z.strictObject({kind:z.literal("wave4-overlap"),wave3Index:z.number().int().nonnegative()}),
]);
export const monitoringInputSchema=z.strictObject({policy:monitoringPolicySchema.default("auto-abort"),rule:monitoringRuleInputSchema.optional()});
export type MonitoringInput=z.infer<typeof monitoringInputSchema>;
export const monitoringRuleSchema=z.discriminatedUnion("kind",[
  z.strictObject({kind:z.literal("price-level"),level:z.number().finite().positive()}),
  z.strictObject({kind:z.literal("wave4-overlap"),level:z.number().finite().positive(),wave3Index:z.number().int().nonnegative(),wave3Time:z.number().int().nonnegative()}),
]);
export type MonitoringRule=z.infer<typeof monitoringRuleSchema>;
export const monitoringConfigSchema=z.strictObject({policy:monitoringPolicySchema,rule:monitoringRuleSchema});
export type MonitoringConfig=z.infer<typeof monitoringConfigSchema>;
export const monitoringStatusSchema=z.enum(["PENDING","OPEN","CLOSED_TP","CLOSED_SL","INVALIDATED_STOP","EXPIRED","ABORTED","INDETERMINATE"]);
export type MonitoringStatus=z.infer<typeof monitoringStatusSchema>;
export const monitoringEventKindSchema=z.enum(["PLAN_LOADED","WARNING","ENTERED","INVALIDATED","CLOSED_TP","CLOSED_SL","ABORTED","EXPIRED","INDETERMINATE"]);
export const monitoringEventSchema=z.strictObject({
  id:z.string().min(1),planId:z.uuid(),sequence:z.number().int().positive(),kind:monitoringEventKindSchema,
  candleTime:z.number().int().nonnegative(),recordedAt:z.iso.datetime(),price:z.number().finite().positive().nullable(),reason:z.string().min(1),
});
export type MonitoringEvent=z.infer<typeof monitoringEventSchema>;
export const monitoringStateSchema=z.strictObject({
  schemaVersion:z.literal("1"),planId:z.uuid(),policy:monitoringPolicySchema,rule:monitoringRuleSchema,status:monitoringStatusSchema,
  health:z.enum(["unknown","healthy","warning","invalidated"]),
  initialRisk:z.number().finite().positive(),entryFillPrice:z.number().finite().positive().nullable(),exitPrice:z.number().finite().positive().nullable(),
  realizedR:z.number().finite().nullable(),currentPrice:z.number().finite().positive().nullable(),
  unrealizedPnl:z.number().finite().nullable(),liveR:z.number().finite().nullable(),
  distanceToInvalidation:z.number().finite().nullable(),distancePercent:z.number().finite().nullable(),
  observedThrough:z.number().int().nonnegative(),boundaryBreached:z.boolean(),events:z.array(monitoringEventSchema),
});
export type MonitoringState=z.infer<typeof monitoringStateSchema>;
export type MonitoringPlan={id:string;asOf:number;entry:number;stopLoss:number;target:number;invalidationPrice:number|null;monitoringConfig?:MonitoringConfig|null;wavePoints?:readonly {price:number}[]};

const terminal=new Set<MonitoringStatus>(["CLOSED_TP","CLOSED_SL","INVALIDATED_STOP","EXPIRED","ABORTED","INDETERMINATE"]);
const round=(value:number)=>Math.round((value+Number.EPSILON)*1_000_000)/1_000_000;
function event(state:MonitoringState,kind:MonitoringEvent["kind"],candleTime:number,recordedAt:string,price:number|null,reason:string):MonitoringState {
  const sequence=state.events.length+1;
  return {...state,events:[...state.events,{id:`${state.planId}:${sequence}`,planId:state.planId,sequence,kind,candleTime,recordedAt,price,reason}]};
}
function levelActive(state:MonitoringState,candleTime:number):boolean {return state.rule.kind==="price-level"||candleTime>state.rule.wave3Time;}
function updateMetrics(state:MonitoringState,close:number,candleTime:number):MonitoringState {
  const active=levelActive(state,candleTime);
  const distance=active?close-state.rule.level:null;
  const health=state.boundaryBreached?"invalidated":!active?"unknown":distance!==null&&distance<=0?"invalidated":distance!==null&&distance<=state.initialRisk*0.1?"warning":"healthy";
  const open=state.status==="OPEN"&&state.entryFillPrice!==null;
  return {...state,currentPrice:close,health,observedThrough:candleTime,distanceToInvalidation:distance===null?null:round(distance),distancePercent:distance===null?null:round(distance/close*100),unrealizedPnl:open?round(close-state.entryFillPrice!):null,liveR:open?round((close-state.entryFillPrice!)/state.initialRisk):null};
}
function finish(state:MonitoringState,status:MonitoringStatus,price:number|null,candle:Candle,recordedAt:string,reason:string):MonitoringState {
  const kind=status==="CLOSED_TP"?"CLOSED_TP":status==="CLOSED_SL"?"CLOSED_SL":status==="INVALIDATED_STOP"?"INVALIDATED":status==="EXPIRED"?"EXPIRED":status==="ABORTED"?"ABORTED":"INDETERMINATE";
  const realizedR=price!==null&&state.entryFillPrice!==null?round((price-state.entryFillPrice)/state.initialRisk):null;
  return event({...state,status,health:status==="INVALIDATED_STOP"?"invalidated":state.health,exitPrice:price,realizedR,unrealizedPnl:null,liveR:null,boundaryBreached:status==="INVALIDATED_STOP"||state.boundaryBreached},kind,candle.time,recordedAt,price,reason);
}
export function createMonitoringState(plan:MonitoringPlan,recordedAt:string,asOfClose?:number):MonitoringState {
  if(!(plan.stopLoss<plan.entry&&plan.entry<plan.target)) throw new Error("Long plan requires stopLoss < entry < target.");
  const rule=plan.monitoringConfig?.rule??{kind:"price-level" as const,level:plan.invalidationPrice??plan.wavePoints?.[0]?.price??plan.stopLoss};
  const config={policy:plan.monitoringConfig?.policy??"auto-abort" as const,rule};
  monitoringConfigSchema.parse(config);
  const state:MonitoringState={schemaVersion:"1",planId:plan.id,policy:config.policy,rule:config.rule,status:"PENDING",health:"unknown",initialRisk:plan.entry-plan.stopLoss,entryFillPrice:null,exitPrice:null,realizedR:null,currentPrice:asOfClose??null,unrealizedPnl:null,liveR:null,distanceToInvalidation:null,distancePercent:null,observedThrough:plan.asOf,boundaryBreached:false,events:[]};
  const initial=asOfClose===undefined?state:updateMetrics(state,asOfClose,plan.asOf);
  return event(initial,"PLAN_LOADED",plan.asOf,recordedAt,asOfClose??null,"확정된 계획과 무효화 규칙을 불러왔습니다.");
}
export function advanceMonitoring(state:MonitoringState,plan:MonitoringPlan,candle:Candle,recordedAt:string,isFinal=false):MonitoringState {
  if(state.planId!==plan.id) throw new Error("Monitoring plan mismatch.");
  if(candle.time<=state.observedThrough) return state;
  if(terminal.has(state.status)) return {...state,currentPrice:candle.close,observedThrough:candle.time,distanceToInvalidation:levelActive(state,candle.time)?round(candle.close-state.rule.level):null,distancePercent:levelActive(state,candle.time)?round((candle.close-state.rule.level)/candle.close*100):null};
  if(candle.time<=plan.asOf) throw new Error("Monitoring candles must follow the plan asOf.");
  let next=updateMetrics(state,candle.close,candle.time);
  const active=levelActive(next,candle.time),boundary=active&&candle.low<=next.rule.level;
  const stop=candle.low<=plan.stopLoss,target=candle.high>=plan.target;
  if(next.status==="PENDING") {
    const entryAtOpen=candle.open>=plan.entry;
    const entryTouched=entryAtOpen||(candle.low<=plan.entry&&candle.high>=plan.entry);
    if(boundary&&next.policy==="auto-abort"&&candle.open<=next.rule.level) return finish({...next,boundaryBreached:true,health:"invalidated"},"INVALIDATED_STOP",null,candle,recordedAt,"시가에서 진입 전 파동 전제가 무효화되어 미진입 주문을 취소했습니다.");
    if(boundary&&next.policy==="auto-abort"&&!entryAtOpen){
      if(entryTouched) return finish({...next,boundaryBreached:true,health:"invalidated"},"INDETERMINATE",null,candle,recordedAt,"진입과 무효화 경계가 같은 봉에 닿아 선후를 알 수 없습니다.");
      return finish({...next,boundaryBreached:true,health:"invalidated"},"INVALIDATED_STOP",null,candle,recordedAt,"진입 전 파동 전제가 무효화되었습니다.");
    }
    if(!entryTouched){
      if(boundary&&!next.boundaryBreached) next=event({...next,boundaryBreached:true,health:"invalidated"},"INVALIDATED",candle.time,recordedAt,next.rule.level,"무효화 경계에 닿았습니다. 경고 전용 정책으로 관찰을 계속합니다.");
      if(next.health==="warning") next=event(next,"WARNING",candle.time,recordedAt,candle.close,"종가가 무효화 경계에서 최초 위험의 10% 이내입니다.");
      return isFinal?finish(next,"EXPIRED",null,candle,recordedAt,"진입하지 않은 채 관측 구간이 끝났습니다."):next;
    }
    const fill=entryAtOpen?candle.open:plan.entry;
    next=event({...next,status:"OPEN",entryFillPrice:fill},"ENTERED",candle.time,recordedAt,fill,"모의 long 포지션이 열렸습니다.");
    if(!entryAtOpen&&(stop||target||boundary&&next.policy==="auto-abort")) return finish(boundary?{...next,boundaryBreached:true,health:"invalidated"}:next,"INDETERMINATE",null,candle,recordedAt,"같은 봉의 진입과 청산·무효화 조건 순서를 알 수 없습니다.");
  }
  // At an open gap, the opening price is observed before intrabar extremes.
  if(active&&next.policy==="auto-abort"&&candle.open<=next.rule.level) return finish(next,"INVALIDATED_STOP",candle.open,candle,recordedAt,"시가 갭에서 무효화 경계를 넘었습니다.");
  if(candle.open<=plan.stopLoss) return finish(next,"CLOSED_SL",candle.open,candle,recordedAt,"시가 갭에서 손절선을 넘었습니다.");
  if(candle.open>=plan.target) return finish(next,"CLOSED_TP",candle.open,candle,recordedAt,"시가 갭에서 목표선을 넘었습니다.");
  if(active&&boundary&&!next.boundaryBreached){
    if(next.policy==="warn-only") next=event({...next,boundaryBreached:true,health:"invalidated"},"INVALIDATED",candle.time,recordedAt,next.rule.level,"파동 전제 무효화 경고: 포지션을 계속 관찰합니다.");
  }
  if(active&&boundary&&next.policy==="auto-abort"){
    if(target) return finish({...next,boundaryBreached:true,health:"invalidated"},"INDETERMINATE",null,candle,recordedAt,"무효화와 목표의 장중 선후를 알 수 없습니다.");
    if(stop&&next.rule.level<plan.stopLoss) return finish(next,"CLOSED_SL",plan.stopLoss,candle,recordedAt,"손절선이 더 높은 가격에 있어 먼저 도달했습니다.");
    return finish(next,"INVALIDATED_STOP",next.rule.level,candle,recordedAt,"파동 전제 경계를 터치해 자동 중단했습니다.");
  }
  if(stop&&target) return finish(next,"INDETERMINATE",null,candle,recordedAt,"손절과 목표가 같은 봉에 닿아 선후를 알 수 없습니다.");
  if(stop) return finish(next,"CLOSED_SL",plan.stopLoss,candle,recordedAt,"손절 가격에 도달했습니다.");
  if(target) return finish(next,"CLOSED_TP",plan.target,candle,recordedAt,"목표 가격에 도달했습니다.");
  next=updateMetrics(next,candle.close,candle.time);
  if(next.health==="warning") next=event(next,"WARNING",candle.time,recordedAt,candle.close,"종가가 무효화 경계에서 최초 위험의 10% 이내입니다.");
  return next;
}
export function abortMonitoring(state:MonitoringState,plan:MonitoringPlan,lastClose:number,recordedAt:string,reason:string):MonitoringState {
  if(state.planId!==plan.id) throw new Error("Monitoring plan mismatch.");
  if(terminal.has(state.status)) throw new Error("Monitoring has already ended.");
  if(!reason.trim()) throw new Error("Manual abort requires a reason.");
  const candle={time:state.observedThrough,open:lastClose,high:lastClose,low:lastClose,close:lastClose};
  return finish({...state,currentPrice:lastClose},"ABORTED",state.status==="OPEN"?lastClose:null,candle,recordedAt,reason.trim());
}
