import { useEffect, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { A2UIProvider, A2UIRenderer, useA2UIActions } from "@copilotkit/a2ui-renderer";
import { createHostCatalog } from "./catalog";
import { catalogId } from "./definitions";

function Surface({ kind }: { kind: string }) {
  const { processMessages, clearSurfaces } = useA2UIActions();
  useEffect(() => {
    const multiple = kind === "grouped_bar" || kind === "stacked_bar";
    const series = [{ key: "s0", label: "제품 A" }, ...(multiple ? [{ key: "s1", label: "제품 B" }] : [])];
    const rows = kind === "donut" ? [{ label: "제품 A", s0: 100 }, { label: "제품 B", s0: 125 }]
      : [{ label: "2024", s0: 100, ...(multiple ? { s1: 20 } : {}) }, { label: "2025", s0: 125, ...(multiple ? { s1: 30 } : {}) }];
    processMessages([
      { version: "v0.9", createSurface: { surfaceId: "financial-story", catalogId: catalogId("sec") } },
      { version: "v0.9", updateComponents: { surfaceId: "financial-story", components: [{ id: "root", component: "FinancialChart", kind,
        title: "검증용 재무 차트", unitLabel: "USD 백만", series, data: { path: "/rows" }, sources: { path: "/sources" } }] } },
      { version: "v0.9", updateDataModel: { surfaceId: "financial-story", value: { rows, sources: "합성 재무제표 · 매출 · USD in millions · 100 / 125" } } },
    ]);
    return clearSurfaces;
  }, [kind, processMessages, clearSurfaces]);
  return <A2UIRenderer surfaceId="financial-story" />;
}
function Preview({ kind = "bar" }: { kind?: string }) {
  const catalog = useMemo(() => createHostCatalog("sec"), []);
  return <div style={{ width: "100%", maxWidth: 640 }}><A2UIProvider catalog={catalog}><Surface kind={kind} /></A2UIProvider></div>;
}
const meta = { title: "A2UI/Financial", component: Preview,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("figure", { name: "검증용 재무 차트" })).toBeVisible();
    await userEvent.click(canvas.getByText("데이터 표 보기"));
    await expect(canvas.getByRole("cell", { name: /^125$/ })).toBeVisible();
    await userEvent.click(canvas.getByText("출처 보기"));
    await expect(canvas.getByText(/합성 재무제표/)).toBeVisible();
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Bar: Story = { args: { kind: "bar" } };
export const Grouped: Story = { args: { kind: "grouped_bar" } };
export const Stacked: Story = { args: { kind: "stacked_bar" } };
export const Line: Story = { args: { kind: "line" } };
export const Area: Story = { args: { kind: "area" } };
export const Donut: Story = { args: { kind: "donut" } };
