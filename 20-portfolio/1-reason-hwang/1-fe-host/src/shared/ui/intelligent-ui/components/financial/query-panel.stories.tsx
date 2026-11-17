import { Renderer } from "@openuidev/react-lang";
import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { library } from "../../library";

function QueryExample({ failFirst = false, explicitControls = false }: { failFirst?: boolean; explicitControls?: boolean }) {
  const toolProvider = useMemo(() => {
    let calls = 0;
    return { example: async (args: Record<string, unknown>) => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 200));
      return { message: failFirst && calls <= 2 ? "조회 실패: 다시 시도해 주세요" : `${args.ticker} ${args.interval} ${args.count} 조회 ${calls}` };
    } };
  }, [failFirst]);
  const controls = 'Row([Input($ticker,"티커","text"),Select($interval,["1d","1wk"],"주기"),Select($count,["60","120","200"],"봉 수")],2)';
  const data = 'Text(data.message),Chart("line",[{date:"2026-11-16",value:1},{date:"2026-11-17",value:2}],"date",["value"])';
  const panel = explicitControls
    ? `QueryPanel([${data}],Action([@Run(data)]),[${controls}])`
    : `QueryPanel([Col([${controls},${data}],2)],Action([@Run(data)]))`;
  return <Renderer library={library} toolProvider={toolProvider} response={'$ticker = "AAPL"\n$interval = "1d"\n$count = "60"\ndata = Query("example", {ticker:$ticker,interval:$interval,count:$count}, {message:"준비 중"})\nroot = ' + panel} />;
}
const meta = { title: "OpenUI/QueryPanel", component: QueryExample } satisfies Meta<typeof QueryExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RefreshAndArguments: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const refresh = canvas.getByRole("button", { name: "데이터 새로고침" });
  await waitFor(() => expect(canvas.getByText(/AAPL 1d 60 조회 \d+/)).toBeVisible());
  const initial = Number(canvas.getByText(/AAPL 1d 60 조회 \d+/).textContent?.match(/조회 (\d+)/)?.[1]);
  await userEvent.click(refresh);
  await expect(refresh).toBeDisabled();
  await waitFor(() => expect(canvas.getByText(`AAPL 1d 60 조회 ${initial + 1}`)).toBeVisible());
  await expect(refresh).toBeEnabled();
  await expect(canvas.getByLabelText("티커")).not.toBeVisible();
  await expect(canvasElement.querySelector(".iui-chart")).toBeVisible();
  const disclosure = canvas.getByText("조회 조건");
  await userEvent.click(disclosure);
  await expect(canvas.getByLabelText("티커")).toBeVisible();
  await userEvent.selectOptions(canvas.getByLabelText("주기"), "1wk");
  await waitFor(() => expect(canvas.getByText(`AAPL 1wk 60 조회 ${initial + 2}`)).toBeVisible());
  await userEvent.selectOptions(canvas.getByLabelText("봉 수"), "120");
  await waitFor(() => expect(canvas.getByText(`AAPL 1wk 120 조회 ${initial + 3}`)).toBeVisible());
  await expect(canvas.getByLabelText("티커")).toHaveValue("AAPL");
  await userEvent.click(disclosure);
  await expect(canvas.getByLabelText("주기")).not.toBeVisible();
  await expect(canvas.getByText(`AAPL 1wk 120 조회 ${initial + 3}`)).toBeVisible();
  await userEvent.click(disclosure);
  await expect(canvas.getByLabelText("주기")).toHaveValue("1wk");
  await expect(canvas.getByLabelText("봉 수")).toHaveValue("120");
  await expect(canvas.getByRole("region", { name: "데이터 조회" })).toContainElement(refresh);
  await userEvent.click(disclosure);
  await expect(canvasElement.querySelector(".iui-chart")).toBeVisible();
} };
export const ErrorRecovery: Story = { args: { failFirst: true }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByText("조회 실패: 다시 시도해 주세요")).toBeVisible());
  await userEvent.click(canvas.getByRole("button", { name: "데이터 새로고침" }));
  await waitFor(() => expect(canvas.getByText(/AAPL 1d 60 조회 \d+/)).toBeVisible());
} };

export const ExplicitControls: Story = { args: { explicitControls: true }, play: RefreshAndArguments.play };
