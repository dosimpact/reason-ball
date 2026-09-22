import { useEffect, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { A2UIProvider, A2UIRenderer, useA2UIActions } from "@copilotkit/a2ui-renderer";
import fixtures from "../../../../assets/a2ui/sec-search-transitions.json";
import { createHostCatalog } from "./catalog";

function SearchUpdates() {
  const { processMessages, clearSurfaces } = useA2UIActions();
  useEffect(() => {
    processMessages(fixtures.initial);
    return clearSurfaces;
  }, [processMessages, clearSurfaces]);
  return <>
    <button onClick={() => processMessages(fixtures.empty)}>빈 결과 적용</button>
    <button onClick={() => processMessages(fixtures.recovered)}>검색 복구</button>
    <A2UIRenderer surfaceId="sec-search-transition" />
  </>;
}

function SearchTransition() {
  const catalog = useMemo(() => createHostCatalog("sec"), []);
  return <A2UIProvider catalog={catalog}><SearchUpdates /></A2UIProvider>;
}

const meta = { title: "A2UI/SEC Search Transition", component: SearchTransition } satisfies Meta<typeof SearchTransition>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ResultsEmptyResults: Story = {
  play: async ({ canvasElement }) => {
    // SEC-A2UI-10: merged A2UI updates must not retain a previous table in an empty result.
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(canvas.getByRole("cell", { name: "Coupang, Inc." })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "빈 결과 적용" }));
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "공시 조회" })).not.toBeInTheDocument();
    await expect(canvas.getAllByText("검색 결과가 없습니다. 검색어를 바꿔 주세요.")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "검색 복구" }));
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(canvas.queryByText("검색 결과가 없습니다. 검색어를 바꿔 주세요.")).not.toBeInTheDocument();
  },
};
