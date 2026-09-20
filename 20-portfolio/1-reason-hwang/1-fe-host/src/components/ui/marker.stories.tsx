import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import { MarkerIcon } from './marker';
import { Check, Clock } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Marker, MarkerContent } from './marker';

const meta = {
  title: 'UI/Marker',
  component: Marker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Marker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Marker {...args} className="w-72" variant="separator">
      <MarkerContent>오늘</MarkerContent>
    </Marker>
  ),
};

export const Variants: Story = {
  parameters: { layout: 'padded', controls: { disable: true } },
  render: () => (
    <StoryGallery
      title="대화와 활동의 구분"
      description="날짜, 읽음 위치, 시스템 상태를 주변 콘텐츠와 구분합니다."
    >
      {(['default', 'separator', 'border'] as const).map((variant) => (
        <StorySample key={variant} title={variant}>
          <Marker variant={variant}>
            <MarkerContent>2026년 9월 20일</MarkerContent>
          </Marker>
        </StorySample>
      ))}
    </StoryGallery>
  ),
};
export const ActivityTimeline: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="w-full max-w-sm space-y-5 rounded-xl border p-5">
      <Marker variant="separator">
        <MarkerContent>오늘</MarkerContent>
      </Marker>
      <Marker>
        <MarkerIcon>
          <Check />
        </MarkerIcon>
        <MarkerContent>디자인 검토가 완료되었습니다 · 10:30</MarkerContent>
      </Marker>
      <Marker>
        <MarkerIcon>
          <Clock />
        </MarkerIcon>
        <MarkerContent>새 버전을 준비하고 있습니다 · 11:15</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerContent>여기까지 읽었습니다</MarkerContent>
      </Marker>
    </div>
  ),
};
