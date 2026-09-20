import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemMedia,
  ItemGroup,
  ItemSeparator,
} from './item';

const meta = {
  title: 'UI/Item',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectList: Story = {
  render: () => (
    <ItemGroup className="w-80">
      {['디자인 시스템', '고객 포털', '분석 대시보드'].map((name, i) => (
        <div key={name}>
          <Item>
            <ItemMedia variant="icon">{i + 1}</ItemMedia>
            <ItemContent>
              <ItemTitle>{name}</ItemTitle>
              <ItemDescription>
                팀 프로젝트 · {i + 2}시간 전 업데이트
              </ItemDescription>
            </ItemContent>
          </Item>
          {i < 2 && <ItemSeparator />}
        </div>
      ))}
    </ItemGroup>
  ),
};
export const Outlined: Story = {
  render: () => (
    <Item variant="outline" className="w-80">
      <ItemMedia variant="icon">✓</ItemMedia>
      <ItemContent>
        <ItemTitle>배포 완료</ItemTitle>
        <ItemDescription>모든 변경사항이 반영되었습니다.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};
