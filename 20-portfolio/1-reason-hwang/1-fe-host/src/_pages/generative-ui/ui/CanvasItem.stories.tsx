import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { CanvasItemFrame } from "@/shared/ui/intelligent-ui/components/canvas-item";
import { OutputView, type CanvasItemSelection } from "@/shared/ui/intelligent-ui";

function CanvasItemExample() {
  const [selection, setSelection] = useState<CanvasItemSelection | null>(null);
  const [addCount, setAddCount] = useState(0);
  return <div><OutputView program={'root = Col([CanvasItem("demo:chart", "차트", [Text("선택할 차트")]), CanvasItem("demo:note", "메모", [Text("별도 메모")])])'} onCanvasAdd={item => { setSelection(item); setAddCount(count => count + 1); }} />
    <output aria-label="추가 횟수">{addCount}</output>
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
    const addButton = canvas.getAllByRole("button", { name: "Canvas에 추가" })[0];
    addButton.focus();
    await userEvent.keyboard("{Enter}");
    expect(canvas.getByLabelText("추가 횟수")).toHaveTextContent("2");
  },
};


export const ReusableFrame: Story = {
  render: () => <div style={{ width: 280, overflow: "hidden", padding: 8 }}>
    <CanvasItemFrame title="재사용 차트" onAdd={() => {}}>
      <div data-testid="frame-content" style={{ height: 140, border: "1px solid currentColor" }}>차트와 조작 영역</div>
    </CanvasItemFrame>
    <CanvasItemFrame title="저장된 차트"><p>추가 동작 없는 결과</p></CanvasItemFrame>
  </div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Canvas에 추가" });
    expect(button).toBeVisible();
    expect(canvas.getAllByRole("button")).toHaveLength(1);
    const content = canvas.getByTestId("frame-content").getBoundingClientRect();
    const action = button.getBoundingClientRect();
    const frame = canvas.getByRole("region", { name: "재사용 차트" }).getBoundingClientRect();
    expect(action.bottom).toBeLessThanOrEqual(content.top);
    expect(action.top).toBe(frame.top - 8);
    expect(action.right).toBe(frame.right + 8);
    button.focus();
    expect(button).toHaveFocus();
    expect(getComputedStyle(button).boxShadow).not.toBe("none");
  },
};
