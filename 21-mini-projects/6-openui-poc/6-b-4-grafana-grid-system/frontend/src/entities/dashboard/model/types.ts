import { z } from "zod";

// 서버와 공유하는 패널 저장 계약입니다. 알 수 없는 형식은 덮어쓰지 않습니다.
export const layoutSchema = z.object({
  x: z.number().int().min(0).max(23),
  y: z.number().int().min(0),
  w: z.number().int().min(4).max(24),
  h: z.number().int().min(4).max(40),
});
export const panelSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["openui", "financial"]),
  tab_id: z.string(),
  layout: layoutSchema,
  pinned: z.boolean(),
  refresh: z
    .object({
      mode: z.enum(["live", "snapshot"]),
      interval_seconds: z.union([
        z.literal(0),
        z.literal(60),
        z.literal(300),
        z.literal(900),
      ]),
      last_attempt_at: z.string().nullable(),
      last_success_at: z.string().nullable(),
      error: z.string().nullable(),
    })
    .optional(),
  program: z.string(),
  ui_state: z.record(z.string(), z.unknown()),
  source_artifact_id: z.string().nullable(),
  query: z.record(z.string(), z.unknown()),
  data: z.record(z.string(), z.unknown()),
  sources: z.array(z.record(z.string(), z.unknown())),
});
export const dashboardSchema = z.object({
  revision: z.number().int(),
  tabs: z.array(z.object({ id: z.string(), title: z.string() })),
  active_tab_id: z.string(),
  panels: z.array(panelSchema),
  artifacts: z.array(panelSchema),
  selected_panel_id: z.string().nullable(),
  export_request: z
    .object({ id: z.string(), format: z.enum(["json", "csv", "print"]) })
    .nullable(),
});
export type Panel = z.infer<typeof panelSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type GridLayout = z.infer<typeof layoutSchema>;
export const EMPTY: Dashboard = {
  revision: 0,
  tabs: [{ id: "main", title: "Overview" }],
  active_tab_id: "main",
  panels: [],
  artifacts: [],
  selected_panel_id: null,
  export_request: null,
};
