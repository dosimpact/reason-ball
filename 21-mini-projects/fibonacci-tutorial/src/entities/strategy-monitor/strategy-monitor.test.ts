import { describe, expect, it } from "vitest";
import type { Candle } from "@/entities/candle/@x";
import { abortMonitoring, advanceMonitoring, createMonitoringState, monitoringInputSchema, monitoringStateSchema, type MonitoringPlan } from "./index";

const now="2026-09-27T00:00:00.000Z";
const plan:MonitoringPlan={id:"11111111-1111-4111-8111-111111111111",asOf:1,entry:110,stopLoss:100,target:130,invalidationPrice:105,monitoringConfig:{policy:"auto-abort",rule:{kind:"price-level",level:105}}};
const bar=(time:number,open:number,high:number,low:number,close:number):Candle=>({time,open,high,low,close});
const start=(value:MonitoringPlan=plan)=>createMonitoringState(value,now,108);
const move=(state:ReturnType<typeof start>,candle:Candle,value:MonitoringPlan=plan,final=false)=>advanceMonitoring(state,value,candle,now,final);
const entered=()=>move(start(),bar(2,110,112,108,111));

describe("strategy monitor",()=>{
  it("defaults new input to auto-abort and parses a legacy plan-derived monitor",()=>{
    expect(monitoringInputSchema.parse({}).policy).toBe("auto-abort");
    const legacy=start({...plan,monitoringConfig:null});
    expect(legacy.policy).toBe("auto-abort");
    expect(legacy.rule).toEqual({kind:"price-level",level:105});
    expect(monitoringStateSchema.safeParse(legacy).success).toBe(true);
    expect(legacy.events.map((event)=>event.kind)).toEqual(["PLAN_LOADED"]);
  });
  it("derives initial health and distance from the known asOf close",()=>{
    const initial=createMonitoringState(plan,now,105.5);
    expect(initial.health).toBe("warning");
    expect(initial.distanceToInvalidation).toBe(.5);
    expect(initial.distancePercent).toBeCloseTo(.473934,5);
    expect(createMonitoringState(plan,now).health).toBe("unknown");
    expect(createMonitoringState(plan,now).distanceToInvalidation).toBeNull();
  });
  it("preserves a tiny positive initial risk without rounding it to zero",()=>{
    const tight={...plan,entry:100.00000001,stopLoss:100,target:101,invalidationPrice:100};
    const initial=createMonitoringState(tight,now,100.00000001);
    expect(initial.initialRisk).toBeGreaterThan(0);
    expect(monitoringStateSchema.safeParse(initial).success).toBe(true);
  });
  it("keeps initial risk fixed after an opening fill and deduplicates a bar",()=>{
    const opened=move(start(),bar(2,115,117,112,116));
    expect(opened.status).toBe("OPEN");
    expect(opened.entryFillPrice).toBe(115);
    expect(opened.initialRisk).toBe(10);
    expect(opened.unrealizedPnl).toBe(1);
    expect(opened.liveR).toBe(.1);
    expect(move(opened,bar(2,115,117,112,116))).toBe(opened);
    expect(opened.events.map((event)=>event.id)).toEqual([`${plan.id}:1`,`${plan.id}:2`]);
  });
  it("warns near the boundary and auto-aborts an open position at the boundary",()=>{
    const warning=move(entered(),bar(3,111,112,106,106));
    expect(warning.status).toBe("OPEN");
    expect(warning.health).toBe("warning");
    expect(warning.events.at(-1)?.kind).toBe("WARNING");
    const stopped=move(warning,bar(4,106,110,104,107));
    expect(stopped.status).toBe("INVALIDATED_STOP");
    expect(stopped.exitPrice).toBe(105);
    expect(stopped.realizedR).toBe(-.5);
    expect(stopped.health).toBe("invalidated");
    expect(stopped.unrealizedPnl).toBeNull();
  });
  it("cancels pending before entry when active wave4 boundary is above entry at the open",()=>{
    const wavePlan={...plan,monitoringConfig:{policy:"auto-abort" as const,rule:{kind:"wave4-overlap" as const,level:120,wave3Index:7,wave3Time:9}}};
    const canceled=move(start(wavePlan),bar(11,115,117,114,116),wavePlan);
    expect(canceled.status).toBe("INVALIDATED_STOP");
    expect(canceled.entryFillPrice).toBeNull();
    expect(canceled.events.map((item)=>item.kind)).toEqual(["PLAN_LOADED","INVALIDATED"]);
    const stopGap=move(start(wavePlan),bar(11,99,118,98,105),wavePlan);
    expect(stopGap.status).toBe("INVALIDATED_STOP");
    expect(stopGap.entryFillPrice).toBeNull();
  });
  it("uses the opening price for a gap through the invalidation boundary",()=>{
    const stopped=move(entered(),bar(3,103,110,102,108));
    expect(stopped.status).toBe("INVALIDATED_STOP");
    expect(stopped.exitPrice).toBe(103);
    expect(stopped.realizedR).toBe(-.7);
  });
  it("cancels a pending plan at an opening gap before later intrabar entry",()=>{
    const canceled=move(start(),bar(2,103,112,102,111));
    expect(canceled.status).toBe("INVALIDATED_STOP");
    expect(canceled.entryFillPrice).toBeNull();
    expect(canceled.realizedR).toBeNull();
  });
  it("preserves unknown ordering for entry and invalidation or target and invalidation",()=>{
    const ambiguousEntry=move(start(),bar(2,108,112,104,109));
    expect(ambiguousEntry.status).toBe("INDETERMINATE");
    expect(ambiguousEntry.boundaryBreached).toBe(true);
    expect(ambiguousEntry.realizedR).toBeNull();
    const ambiguousExit=move(entered(),bar(3,111,132,104,116));
    expect(ambiguousExit.status).toBe("INDETERMINATE");
    expect(ambiguousExit.exitPrice).toBeNull();
  });
  it("selects the first descending boundary before a lower stop",()=>{
    const lowerInvalidation={...plan,monitoringConfig:{policy:"auto-abort" as const,rule:{kind:"price-level" as const,level:95}}};
    const opened=move(start(lowerInvalidation),bar(2,110,112,108,111),lowerInvalidation);
    const stopped=move(opened,bar(3,111,115,94,103),lowerInvalidation);
    expect(stopped.status).toBe("CLOSED_SL");
    expect(stopped.exitPrice).toBe(100);
  });
  it("warn-only records invalidation and continues until a normal close",()=>{
    const warningPlan={...plan,monitoringConfig:{policy:"warn-only" as const,rule:{kind:"price-level" as const,level:105}}};
    const opened=move(start(warningPlan),bar(2,110,112,108,111),warningPlan);
    const breached=move(opened,bar(3,111,114,104,106),warningPlan);
    expect(breached.status).toBe("OPEN");
    expect(breached.health).toBe("invalidated");
    expect(breached.events.filter((event)=>event.kind==="INVALIDATED")).toHaveLength(1);
    const closed=move(breached,bar(4,120,131,116,130),warningPlan);
    expect(closed.status).toBe("CLOSED_TP");
    expect(closed.exitPrice).toBe(130);
  });
  it("keeps an intrabar entry open when warn-only invalidation is the only competing touch",()=>{
    const warningPlan={...plan,monitoringConfig:{policy:"warn-only" as const,rule:{kind:"price-level" as const,level:105}}};
    const result=move(start(warningPlan),bar(2,108,112,104,109),warningPlan);
    expect(result.status).toBe("OPEN");
    expect(result.boundaryBreached).toBe(true);
    expect(result.events.map((item)=>item.kind)).toEqual(["PLAN_LOADED","ENTERED","INVALIDATED"]);
  });
  it("uses auto-abort policy at an invalidation level equal to stop",()=>{
    const equal={...plan,monitoringConfig:{policy:"auto-abort" as const,rule:{kind:"price-level" as const,level:100}}};
    const opened=move(start(equal),bar(2,110,112,108,111),equal);
    const result=move(opened,bar(3,111,115,99,104),equal);
    expect(result.status).toBe("INVALIDATED_STOP");
    expect(result.exitPrice).toBe(100);
  });
  it("activates wave4 overlap only after the confirmed wave3 candle",()=>{
    const wavePlan={...plan,entry:125,target:150,monitoringConfig:{policy:"auto-abort" as const,rule:{kind:"wave4-overlap" as const,level:120,wave3Index:7,wave3Time:10}}};
    const before=move(start(wavePlan),bar(9,125,128,122,126),wavePlan);
    expect(before.status).toBe("OPEN");
    expect(before.health).toBe("unknown");
    const after=move(before,bar(11,126,130,119,124),wavePlan);
    expect(after.status).toBe("INVALIDATED_STOP");
    expect(after.exitPrice).toBe(120);
  });
  it("expires pending, permits a reasoned manual abort, and never revives terminal state",()=>{
    const pending=move(start(),bar(2,108,109,107,108),plan,true);
    expect(pending.status).toBe("EXPIRED");
    const opened=entered();
    expect(()=>abortMonitoring(opened,plan,111,now," ")).toThrow();
    const aborted=abortMonitoring(opened,plan,111,now,"학습자가 구조를 재검토함");
    expect(aborted.status).toBe("ABORTED");
    expect(aborted.exitPrice).toBe(111);
    expect(()=>abortMonitoring(aborted,plan,111,now,"again")).toThrow();
    const later=move(aborted,bar(3,115,135,114,134));
    expect(later.status).toBe("ABORTED");
    expect(later.currentPrice).toBe(134);
    expect(later.events).toEqual(aborted.events);
    expect(later.unrealizedPnl).toBeNull();
  });
});
