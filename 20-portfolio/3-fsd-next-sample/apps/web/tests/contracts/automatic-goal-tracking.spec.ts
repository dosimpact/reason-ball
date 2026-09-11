import { expect, test } from "@playwright/test";
import { materializeTrackedGoals, trackedGoalInstructions, type GoalTrackingContext } from "../../src/entities/mission-run/model/automatic-goal-tracking";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context: GoalTrackingContext = { runId:id(1), versionId:id(2), userMessageId:id(3), messages:[{id:id(3),role:"user",text:"How much is tea?"},{id:id(4),role:"assistant",text:"Would you like tea?"}], steps:[{id:id(5),order:1,title:"Order",objective:"Order tea",learnerGoal:"Order",criteria:[],optional:false},{id:id(6),order:2,title:"Price",objective:"Ask price",learnerGoal:"Ask",criteria:[],optional:false}] };
const goal = (n: number, completed: boolean) => ({stepId:id(n),completed,evidenceMessageIds:completed?[id(3)]:[],feedback:"목표 근거"});
test("out of order achievement preserves exact pinned order and does not mutate evidence", () => {
 const input={steps:[goal(6,true),goal(5,false)]}; const before=structuredClone(input);
 const result=materializeTrackedGoals(context,input);
 expect(result.map(s=>s.stepId)).toEqual([id(5),id(6)]);
 expect(result[0].completed).toBe(false); expect(result[1].completed).toBe(true); expect(input).toEqual(before);
 expect(trackedGoalInstructions(context,result)).toContain("next remaining required objective");
});
test("forged assistant/unknown IDs, omitted goals, duplicate goals and unsupported completion are rejected", () => {
 for(const steps of [[goal(5,true)], [goal(5,true),goal(5,true)], [goal(5,true),{...goal(6,true),evidenceMessageIds:[]}], [goal(5,true),{...goal(6,true),evidenceMessageIds:[id(4)]}], [goal(5,true),{...goal(6,true),evidenceMessageIds:[id(99)]}]]) {
  expect(()=>materializeTrackedGoals(context,{steps})).toThrow();
 }
});
test("all required goals wrap up without awarding; incomplete optional goal does not hold roleplay open", () => {
 const optional={...context,steps:context.steps.map((s,i)=>({...s,optional:i===1}))};
 const instructions=trackedGoalInstructions(optional,materializeTrackedGoals(optional,{steps:[goal(5,true),goal(6,false)]}));
 expect(instructions).toContain("Naturally conclude"); expect(instructions).toContain("not a final pass"); expect(instructions).not.toContain("Continue the roleplay naturally");
});
