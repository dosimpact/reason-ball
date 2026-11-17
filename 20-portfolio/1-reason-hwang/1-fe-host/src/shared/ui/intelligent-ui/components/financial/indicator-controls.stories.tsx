import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { IndicatorControlsView } from "./indicator-controls";
import type { IndicatorCatalog } from "./financial-schema";
const catalog: IndicatorCatalog = { schemaVersion: 2, catalogVersion: "fixture", maxInstances: 40, maxVisiblePanels: 4, defaultInstances: [{ name: "SMA", parameters: { timeperiod: 20 } }], indicators: [{ name: "SMA", label: "단순 이동평균", defaults: { timeperiod: 20 }, parameters: { timeperiod: { default: 20, min: 2, max: 200, type: "integer" } }, supportsSignal: false, panel: "price", series: [{ key: "sma", label: "SMA", unit: "price", display: "line" }] }] };
function Example() { const [value, setValue] = useState('[{"name":"SMA","parameters":{"timeperiod":20}}]'); return <><IndicatorControlsView value={value} onApply={setValue} catalog={catalog} /><output aria-label="적용된 인스턴스">{value}</output></>; }
const meta = { title: "OpenUI/IndicatorControls", component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DraftAndApply: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "지표 추가" }));
  await expect(within(canvas.getByRole("region", { name: "지표 설정" })).getByRole("status")).toHaveTextContent("적용하지 않은 초안");
  await expect(canvas.getByLabelText("적용된 인스턴스")).not.toHaveTextContent("instanceId");
  await userEvent.click(canvas.getByRole("button", { name: "지표 설정 적용 · 차트 조회" }));
  await expect(canvas.getByLabelText("적용된 인스턴스")).toHaveTextContent("instanceId");
} };
