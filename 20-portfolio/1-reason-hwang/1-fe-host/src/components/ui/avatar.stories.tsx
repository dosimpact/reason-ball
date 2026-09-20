import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import {
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from './avatar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar, AvatarFallback } from './avatar';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>RH</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <StoryGallery
      title="아바타 크기"
      description="좁은 목록부터 프로필 헤더까지, 공간에 맞게 크기를 선택합니다."
    >
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <StorySample key={size} title={size}>
          <Avatar size={size}>
            <AvatarFallback>RH</AvatarFallback>
          </Avatar>
          <Avatar size={size}>
            <AvatarFallback>김</AvatarFallback>
            <AvatarBadge />
          </Avatar>
        </StorySample>
      ))}
    </StoryGallery>
  ),
};
export const Team: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <AvatarGroup>
        {['RH', 'MK', 'JL'].map((name) => (
          <Avatar key={name}>
            <AvatarFallback>{name}</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroupCount>+4</AvatarGroupCount>
      </AvatarGroup>
      <span className="text-sm text-muted-foreground">7명이 함께 작업 중</span>
    </div>
  ),
};
export const ImageFallback: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage src="data:image/png;base64,invalid" alt="Reason Hwang" />
        <AvatarFallback>RH</AvatarFallback>
      </Avatar>
      <p className="text-sm text-muted-foreground">
        이미지를 불러오지 못하면 이니셜을 표시합니다.
      </p>
    </div>
  ),
};
