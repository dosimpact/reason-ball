import { z } from "zod";
import {gridLayoutSchema,migrateGridDocument} from "./grid";
export const snapshotSchema = z.object({
  rows:z.array(z.object({period:z.string(),value:z.number().finite()})).max(500),
  dataVersion:z.number(), sourceWatermark:z.string(), fetchedAt:z.string(),
  parametersHash:z.string(), provenance:z.literal("synthetic"), resultSchemaVersion:z.literal(1),
}).passthrough();
export const queryDefinitionSchema=z.object({schemaVersion:z.literal(1),queryId:z.string().regex(/^[a-f0-9]{24}$/),queryVersion:z.literal(1),sql:z.string(),title:z.string(),description:z.string(),createdAt:z.string(),parameterSchema:z.record(z.string(),z.unknown()),resultSchema:z.record(z.string(),z.unknown())});
export const widgetSchema = z.object({
  schemaVersion:z.literal(1), catalogVersion:z.literal(1), widgetId:z.string(),title:z.string(),program:z.string().max(10000),
  chartType:z.enum(["bar","line","area","pie","donut","scatter"]),queryId:z.string().regex(/^[a-f0-9]{24}$/),queryVersion:z.literal(1),
  parameters:z.object({months:z.number().int().min(1).max(24),region:z.enum(["ALL","KR","US"]),start_date:z.iso.date().optional(),end_date:z.iso.date().optional()}),
  snapshot:snapshotSchema,definitionRevision:z.number().int().positive(),refreshPolicy:z.enum(["manual","snapshot","polling"]),
  sourceArtifactId:z.string().optional(),queryDefinition:queryDefinitionSchema.optional(),
  tabId:z.string().optional(),layout:gridLayoutSchema.optional(),
  intervalSeconds:z.number().min(10).max(3600),uiState:z.record(z.string(),z.unknown()),
});
export const registeredContentSchema=z.object({
 registrationId:z.string().min(1).max(100),registrationVersion:z.literal(1),
 sourceId:z.string().min(1).max(20000),title:z.string().min(1).max(300),
 program:z.string().min(1).max(10000),uiState:z.record(z.string(),z.unknown()),
});
export const registeredWidgetSchema=registeredContentSchema.extend({
 kind:z.literal("registered"),schemaVersion:z.literal(1),catalogVersion:z.literal(1),
 widgetId:z.string(),definitionRevision:z.number().int().positive(),
 tabId:z.string(),layout:gridLayoutSchema,
});
export type RegisteredContent=z.infer<typeof registeredContentSchema>;
export type RegisteredWidget=z.infer<typeof registeredWidgetSchema>;
export const canvasWidgetSchema=z.union([registeredWidgetSchema,widgetSchema]);
export type CanvasWidget=z.infer<typeof canvasWidgetSchema>;
export function isRegistered(w:CanvasWidget):w is RegisteredWidget{return "kind" in w && w.kind==="registered";}
export type Snapshot=z.infer<typeof snapshotSchema>;
export type Widget=z.infer<typeof widgetSchema>;
export type Pending={tabId?:string;title:string;program:string;message:string;error?:string;runId:string;action:string;snapshot?:Snapshot};
export type CanvasEvent={tabId?:string;channel:string;type:string;widgetId?:string;runId:string;sequence:number;baseRevision?:number;title?:string;action?:string;delta?:string;error?:string;message?:string;widget?:unknown;snapshot?:unknown};
export const STORAGE_KEY="canvas-ux:dashboard:v1";
export function restore(raw:string):Widget[] {
  const data=JSON.parse(raw);
  // Explicit v0 migration: only the known envelope shape changed, never UI semantics.
  if(data.schemaVersion===0 && Array.isArray(data.items)) return z.array(widgetSchema).max(50).parse(data.items);
  if(data.schemaVersion!==1) throw new Error("지원하지 않는 저장 형식입니다. 원본은 보존됩니다.");
  return z.array(widgetSchema).max(50).parse(data.widgets);
}

// Read only a bounded data projection; never execute programs from unsupported catalogs.
const fallbackSchema = z.object({title:z.string().max(300),snapshot:z.object({rows:snapshotSchema.shape.rows})});
export type FallbackSnapshot = z.infer<typeof fallbackSchema>;
export function fallbackSnapshots(raw:string):FallbackSnapshot[] {
 try {
  const data=JSON.parse(raw);
  const items=Array.isArray(data.widgets)?data.widgets:Array.isArray(data.items)?data.items:[];
  return items.slice(0,50).flatMap((item:unknown)=>{const result=fallbackSchema.safeParse(item);return result.success?[result.data]:[];});
 } catch { return []; }
}

export const ACTIVE_THREAD_KEY="canvas-ux:active-thread";
export const threadCanvasKey=(id:string)=>`canvas-ux:thread-canvas:${encodeURIComponent(id)}`;
export const tabSchema=z.object({id:z.string().min(1),title:z.string().trim().min(1).max(80)});
export type CanvasTab=z.infer<typeof tabSchema>;
const currentDocumentSchema=z.object({schemaVersion:z.union([z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),threadId:z.string(),tabs:z.array(tabSchema).min(1).max(20),activeTabId:z.string(),selectedWidgetId:z.string().nullable(),widgets:z.array(canvasWidgetSchema).max(50)}).superRefine((d,ctx)=>{
 const tabs=new Set(d.tabs.map(t=>t.id));
 if(tabs.size!==d.tabs.length||!tabs.has(d.activeTabId)||d.widgets.some(w=>!tabs.has(w.tabId||"main"))||new Set(d.widgets.map(w=>w.widgetId)).size!==d.widgets.length||d.selectedWidgetId&&!d.widgets.some(w=>w.widgetId===d.selectedWidgetId))ctx.addIssue({code:"custom",message:"Canvas 참조가 올바르지 않습니다."});
});

export const documentSchema=z.preprocess(migrateGridDocument,currentDocumentSchema);

export const artifactSchema=widgetSchema.pick({title:true,chartType:true,queryId:true,queryVersion:true,parameters:true,snapshot:true}).extend({schemaVersion:z.literal(1),artifactId:z.string().uuid(),queryDefinition:queryDefinitionSchema}).refine(a=>a.queryDefinition.queryId===a.queryId,"Query definition mismatch");
export type ChartArtifact=z.infer<typeof artifactSchema>;
