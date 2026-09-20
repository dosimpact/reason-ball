import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from './combobox';

const meta = {
  title: 'UI/Combobox',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const frameworks = ['Next.js', 'React', 'Vue', 'Svelte', 'Angular', 'Astro'];
export const Searchable: Story = {
  render: () => (
    <Combobox items={frameworks}>
      <ComboboxInput
        placeholder="프레임워크 검색…"
        aria-label="프레임워크"
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>일치하는 항목이 없습니다.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};
export const Disabled: Story = {
  render: () => (
    <Combobox items={frameworks} defaultValue="Next.js" disabled>
      <ComboboxInput aria-label="고정 프레임워크" />
    </Combobox>
  ),
};

export const Interaction: Story = {
  ...Searchable,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox'), 'Svelte');
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('option', { name: 'Svelte' }));
    await expect(canvas.getByRole('combobox')).toHaveValue('Svelte');
  },
};
