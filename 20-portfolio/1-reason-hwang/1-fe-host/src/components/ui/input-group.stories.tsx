import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group';

const meta = {
  title: 'UI/Input Group',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SearchAndUrl: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <InputGroup>
        <InputGroupAddon>⌕</InputGroupAddon>
        <InputGroupInput
          aria-label="프로젝트 검색"
          placeholder="프로젝트 검색…"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>⌘ K</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput aria-label="사이트 주소" placeholder="example.com" />
      </InputGroup>
    </div>
  ),
};
export const MessageComposer: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupTextarea
        aria-label="메시지"
        placeholder="팀에 공유할 내용을 입력하세요…"
      />
      <InputGroupAddon align="block-end">
        <InputGroupText>Markdown 지원 · 최대 2,000자</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};
