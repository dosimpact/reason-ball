import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { HttpAgent } from "@ag-ui/client";
import { A2UIProvider, A2UIRenderer } from "@copilotkit/a2ui-renderer";
import fixtures from "../../../../assets/a2ui/sec-search-transitions.json";
import { SurfaceMessages } from "@/features/a2ui-demo/activity-renderer";
import { SurfaceStreamProvider, type Operations } from "@/features/a2ui-demo/surface-stream";
import { createHostCatalog } from "./catalog";

function rename(operations: Operations, surfaceId: string): Operations {
  return JSON.parse(JSON.stringify(operations).replaceAll("sec-search-transition", surfaceId));
}

function JournalHarness() {
  const agent = useMemo(() => new HttpAgent({ url: "/unused" }), []);
  const catalog = useMemo(() => createHostCatalog("sec"), []);
  const [visible, setVisible] = useState(false);
  const initial = useMemo(() => rename(fixtures.initial, "sec-canvas-story"), []);
  const inline = useMemo(() => rename(fixtures.initial, "sec-inline-story"), []);
  const publish = (id: string, operations: Operations) => agent.addMessage({ id, role: "tool", toolCallId: id, content: JSON.stringify({ a2ui_operations: operations }) });
  return <SurfaceStreamProvider agent={agent}>
    <button onClick={() => {
      // Both renders can arrive before the activity mounts. The subscriber was
      // mounted before the run, so neither an early nor a later update is lost.
      publish("initial", initial);
      publish("empty", rename(fixtures.empty, "sec-canvas-story"));
      setVisible(true);
    }}>실행 중 화면 생성</button>
    <button onClick={() => {
      publish("recovered", rename(fixtures.recovered, "sec-canvas-story"));
      // Runtime may replay the original tool as an activity with another ID.
      agent.addMessage({ id: "a2ui-surface-initial", role: "activity", activityType: "a2ui-surface", content: { a2ui_operations: initial } });
    }}>Canvas 복구와 중복 이벤트</button>
    <section aria-label="Inline 보존"><A2UIProvider catalog={catalog}><SurfaceMessages surfaceId="sec-inline-story" initial={inline} /><A2UIRenderer surfaceId="sec-inline-story" /></A2UIProvider></section>
    {visible && <section aria-label="Canvas 갱신"><A2UIProvider catalog={catalog}><SurfaceMessages surfaceId="sec-canvas-story" initial={initial} /><A2UIRenderer surfaceId="sec-canvas-story" /></A2UIProvider></section>}
  </SurfaceStreamProvider>;
}

const meta = { title: "A2UI/SEC Surface Stream", component: JournalHarness } satisfies Meta<typeof JournalHarness>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LateMountAndPersistentCanvas: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inline = within(canvas.getByRole("region", { name: "Inline 보존" }));
    await expect(await inline.findByRole("table")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "실행 중 화면 생성" }));
    const workspace = within(canvas.getByRole("region", { name: "Canvas 갱신" }));
    await expect(workspace.queryByRole("table")).not.toBeInTheDocument();
    await expect(workspace.getAllByText("검색 결과가 없습니다. 검색어를 바꿔 주세요.")).toHaveLength(2);
    await expect(inline.getByRole("table")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Canvas 복구와 중복 이벤트" }));
    await expect(await workspace.findByRole("table")).toBeVisible();
    await expect(workspace.queryByText("검색 결과가 없습니다. 검색어를 바꿔 주세요.")).not.toBeInTheDocument();
    await expect(inline.getByRole("cell", { name: "Coupang, Inc." })).toBeVisible();
  },
};
