import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { OutputView } from "@/shared/ui/intelligent-ui";
const meta = { title: "Generative UI/Business actions", component: OutputView } satisfies Meta<typeof OutputView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RegionQuery: Story = {
  args: { onBusinessAction: fn(), onError: fn(), program: 'root = Col([Select($region, [{value: "all", label: "전체"}, {value: "seoul", label: "서울"}], "지역"), Button("매출 조회", @BusinessAction("search_sales", {region: $region}))]); $region = "all";' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(await canvas.findByRole("combobox", { name: "지역" }), "seoul");
    await userEvent.click(canvas.getByRole("button", { name: "매출 조회" }));
    await expect(args.onBusinessAction).toHaveBeenCalledWith({ name: "search_sales", context: { region: "seoul" } });
    await expect(args.onError).not.toHaveBeenCalled();
  },
};
export const BusyDisablesAction: Story = {
  args: { onBusinessAction: fn(), busy: true, program: 'root = Col([Button("항공편 선택", @BusinessAction("select_flight", {flightId: "demo-icn-nrt"}))]);' },
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByRole("button", { name: "항공편 선택" })).toBeDisabled();
    await expect(args.onBusinessAction).not.toHaveBeenCalled();
  },
};
