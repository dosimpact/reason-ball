import { describe, expect, it } from "vitest";
import { catalog } from "@/entities/tutorial/@x";
import { gradeQuiz, gradeRubric, validateAnalysisPlan, validateWaveStructure } from "./index";
import { lessonDefinitions } from "./definitions";
import { authoredPatternCandles } from "./pattern-fixtures";

const indices=(length:number,anchors:number)=>Array.from({length:anchors},(_,index)=>Math.round(index*(length-1)/(anchors-1)));
describe("advanced curriculum",()=>{
  it("maps 35 advanced units to the 10-chapter public catalog",()=>{
    expect(lessonDefinitions).toHaveLength(35);
    expect(new Set(lessonDefinitions.map((unit)=>unit.id)).size).toBe(35);
    const catalogIds=new Set(catalog.chapters.flatMap((chapter)=>chapter.unitIds));
    for(const lesson of lessonDefinitions) expect(catalogIds.has(lesson.id)).toBe(true);
    expect(catalog.chapters).toHaveLength(10);
    expect(catalogIds.size).toBe(44);
  });
  it("provides five distinct steps, three real questions, and 2-of-3 grading for every new theory",()=>{
    const theories=lessonDefinitions.filter((lesson)=>lesson.kind==="theory");
    expect(theories).toHaveLength(13);
    for(const lesson of theories){
      expect(lesson.steps).toHaveLength(5);
      expect(new Set(lesson.steps!.map((step)=>step.body)).size).toBe(5);
      expect(lesson.questions).toHaveLength(3);
      expect(lesson.correctAnswers).toHaveLength(3);
      expect(lesson.questions!.every((q)=>q.options.length===3)).toBe(true);
      const answers=Object.fromEntries(lesson.correctAnswers!.map((answer,index)=>[`q${index+1}`,answer]));
      expect(gradeQuiz(lesson.correctAnswers!,answers).passed).toBe(true);
      answers.q3=(answers.q3+1)%3;
      expect(gradeQuiz(lesson.correctAnswers!,answers).passed).toBe(true);
      answers.q2=(answers.q2+1)%3;
      expect(gradeQuiz(lesson.correctAnswers!,answers).passed).toBe(false);
    }
  });
  it("defines three private, distinct cases for every new practice",()=>{
    const practices=lessonDefinitions.filter((lesson)=>lesson.kind==="practice");
    expect(practices).toHaveLength(22);
    for(const lesson of practices){
      expect(lesson.cases!.length).toBeGreaterThanOrEqual(3);
      expect(lesson.cases!.map((c)=>c.phase).slice(0,3)).toEqual(["basic","counterexample","assessment"]);
      expect(new Set(lesson.cases!.map((c)=>c.id)).size).toBe(lesson.cases!.length);
      for(const lessonCase of lesson.cases!) {
        expect(lessonCase.fields.length).toBeGreaterThan(0);
        if(lessonCase.source==="authored-dummy") expect(lessonCase.candles).toBeUndefined();
      }
    }
  });
  it("validates authored bearish, zigzag, triangle, and diagonal structures",()=>{
    const cases:[string,Parameters<typeof validateWaveStructure>[0],number[]][]=[
      ["ew-bearish-impulse","bearish-impulse",indices(96,12).slice(0,6)],
      ["ew-zigzag","zigzag",[0,5,8,13].map((point)=>Math.round(point*95/13))],
      ["ew-triangle-count","triangle",indices(96,12).slice(0,6)],
      ["ew-ending-diagonal","diagonal",indices(96,12).slice(0,6)],
    ];
    for(const [unit,policy,points] of cases){
      const candles=authoredPatternCandles(unit,96,0,0);
      expect(validateWaveStructure(policy,candles,points).every((check)=>check.pass),unit).toBe(true);
      expect(validateWaveStructure(policy,candles,[...points.slice(0,-1),96]).some((check)=>!check.pass)).toBe(true);
    }
  });
  it("separates rubric self-assessment from structural checks",()=>{
    expect(gradeRubric([2,2,2,1,1])).toBe(true);
    expect(gradeRubric([2,2,2,2,0])).toBe(false);
    expect(gradeRubric([2,1,1,1,1])).toBe(false);
    const base={primary:{pattern:"Zigzag",direction:"down" as const,degree:"minor",segments:[{id:"a",label:"A",degree:"minor",startIndex:0,endIndex:10,childLabels:[]}],evidence:"공개 봉의 A",invalidation:"시작 고점 초과"},rules:"5-3-5",guidelines:"비율은 보조",anchors:"0,10",nextObservation:"B 구간",asOf:1,snapshotId:"snap"};
    const checks=validateAnalysisPlan(base,20);
    expect(checks.find((check)=>check.rule==="pattern-labels")?.pass).toBe(false);
  });
});

describe("Flat price boundaries",()=>{
  it("uses retracement relative to A and permits Running C above A",async()=>{
    const { validateFlatVariant }=await import("./index");
    expect(validateFlatVariant("regular-flat",160,149,159,145).every((item)=>item.pass)).toBe(true);
    expect(validateFlatVariant("expanded-flat",160,149,164,143).every((item)=>item.pass)).toBe(true);
    expect(validateFlatVariant("running-flat",160,149,164,153).every((item)=>item.pass)).toBe(true);
    expect(validateFlatVariant("regular-flat",160,149,156,145).some((item)=>!item.pass)).toBe(true);
    expect(validateFlatVariant("running-flat",160,149,159,153).some((item)=>!item.pass)).toBe(true);
  });
});
