import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { A2UIGallery } from "@/features/a2ui-demo/gallery";

const meta = { title: "A2UI/CatalogPlayground", component: A2UIGallery } satisfies Meta<typeof A2UIGallery>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditDataModel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox", { name: "데이터 모델 JSON" });
    await expect(await canvas.findByText("$680,000")).toBeVisible();
    const model = JSON.parse((editor as HTMLTextAreaElement).value);
    model.revenue = "$950,000";
    model.title = "편집한 매출";
    model.rows = [{ region: "제주", revenue: 950000 }];
    fireEvent.change(editor, { target: { value: JSON.stringify(model) } });
    await userEvent.click(canvas.getByRole("button", { name: "미리보기에 적용" }));
    await expect(await canvas.findByText("$950,000")).toBeVisible();
    await expect(await canvas.findByText("편집한 매출")).toBeVisible();
    await expect(await canvas.findByRole("cell", { name: "제주" })).toBeVisible();
    fireEvent.change(editor, { target: { value: "{broken" } });
    await userEvent.click(canvas.getByRole("button", { name: "미리보기에 적용" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("JSON 형식");
    await expect(canvas.getByText("$950,000")).toBeVisible();
    fireEvent.change(editor, { target: { value: JSON.stringify({ ...model, series: "invalid" }) } });
    await userEvent.click(canvas.getByRole("button", { name: "미리보기에 적용" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("series");
    await userEvent.click(canvas.getByRole("button", { name: "예제 초기화" }));
    await expect(await canvas.findByText("$680,000")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: /컴포넌트/ }), "Input");
    await expect(await canvas.findByRole("textbox", { name: "입력값" })).toHaveValue("안녕하세요");
  },
};
