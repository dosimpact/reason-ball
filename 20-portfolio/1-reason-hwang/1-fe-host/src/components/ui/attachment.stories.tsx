import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import { FileText, LoaderCircle, X } from 'lucide-react';
import {
  AttachmentGroup,
  AttachmentMedia,
  AttachmentActions,
  AttachmentAction,
} from './attachment';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Attachment,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
} from './attachment';

const meta = {
  title: 'UI/Attachment',
  component: Attachment,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    state: {
      control: 'select',
      options: ['idle', 'uploading', 'processing', 'done', 'error'],
    },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'default'] },
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Attachment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Attachment {...args}>
      <AttachmentContent>
        <AttachmentTitle>project-notes.pdf</AttachmentTitle>
        <AttachmentDescription>PDF · 240 KB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  ),
};

export const UploadStates: Story = {
  parameters: { layout: 'padded', controls: { disable: true } },
  render: () => (
    <StoryGallery
      title="파일 업로드 상태"
      description="업로드 전부터 처리 완료·실패까지 사용자에게 현재 상태를 전달합니다."
    >
      {(
        [
          ['idle', '업로드 대기'],
          ['uploading', '업로드 중 · 48%'],
          ['processing', '문서를 분석하고 있습니다'],
          ['done', 'PDF · 240 KB'],
          ['error', '업로드 실패 · 다시 시도해주세요'],
        ] as const
      ).map(([state, description]) => (
        <StorySample key={state} title={state}>
          <Attachment state={state}>
            <AttachmentMedia>
              {state === 'uploading' || state === 'processing' ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <FileText />
              )}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>project-brief.pdf</AttachmentTitle>
              <AttachmentDescription>{description}</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </StorySample>
      ))}
    </StoryGallery>
  ),
};
export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="space-y-4">
      {(['xs', 'sm', 'default'] as const).map((size) => (
        <Attachment key={size} size={size}>
          <AttachmentMedia>
            <FileText />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>design-spec.pdf</AttachmentTitle>
            <AttachmentDescription>{size} · 128 KB</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ))}
    </div>
  ),
};
export const FileCollection: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="w-full max-w-lg space-y-3">
      <h3 className="text-sm font-medium">프로젝트 첨부파일 · 3개</h3>
      <AttachmentGroup>
        {['요구사항.pdf', '화면설계.pdf', '검토메모.txt'].map((name) => (
          <Attachment key={name} orientation="vertical">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{name}</AttachmentTitle>
              <AttachmentDescription>240 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ))}
      </AttachmentGroup>
    </div>
  ),
};
export const LongFilename: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Attachment className="max-w-64">
      <AttachmentMedia>
        <FileText />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>
          2026-09-프로젝트-최종-디자인-검토-수정본-v12.pdf
        </AttachmentTitle>
        <AttachmentDescription>
          파일명이 길면 말줄임으로 표시합니다.
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="첨부파일 삭제">
          <X />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  ),
};
