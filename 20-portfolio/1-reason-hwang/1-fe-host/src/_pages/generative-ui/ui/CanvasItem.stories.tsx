import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { OutputView, type CanvasItemSelection } from "@/shared/ui/intelligent-ui";

function CanvasItemExample() {
  const [selection, setSelection] = useState<CanvasItemSelection | null>(null);
  return <div><OutputView program={'root = Col([CanvasItem("demo:chart", "차트", [Text("선택할 차트")]), CanvasItem("demo:note", "메모", [Text("별도 메모")])])'} onCanvasAdd={setSelection} />
    {selection && <div data-testid="selected-canvas"><strong>{selection.title}</strong><OutputView program={selection.program} /></div>}
  </div>;
}

const meta = { title: "Generative UI/CanvasItem", component: CanvasItemExample } satisfies Meta<typeof CanvasItemExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PinInlineItem: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("button", { name: "Canvas에 추가" })).toHaveLength(2);
    await userEvent.click(canvas.getAllByRole("button", { name: "Canvas에 추가" })[0]);
    const selected = canvas.getByTestId("selected-canvas");
    expect(within(selected).getByText("차트")).toBeVisible();
    expect(within(selected).getByText("선택할 차트")).toBeVisible();
    expect(within(selected).queryByText("별도 메모")).toBeNull();
    expect(within(selected).queryByRole("button", { name: "Canvas에 추가" })).toBeNull();
  },
};
