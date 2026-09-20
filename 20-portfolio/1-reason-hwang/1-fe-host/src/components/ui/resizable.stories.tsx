import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './resizable';

const meta = {
  title: 'UI/Resizable',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editor: Story = {
  render: () => (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-64 w-[min(85vw,640px)] rounded-lg border"
    >
      <ResizablePanel defaultSize="25%" minSize="15%">
        <div className="p-4 text-sm">
          파일 탐색기
          <br />
          <br />
          src/
          <br />
          components/
          <br />
          stories/
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="75%">
        <div className="p-6">
          <h3 className="font-semibold">미리보기</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            구분선을 드래그하거나 키보드로 패널 크기를 조절하세요.
          </p>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
export const Vertical: Story = {
  render: () => (
    <ResizablePanelGroup
      orientation="vertical"
      className="h-80 w-80 rounded-lg border"
    >
      <ResizablePanel>
        <div className="p-4">편집 영역</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <div className="p-4 text-sm text-muted-foreground">
          콘솔 · 준비 완료
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
