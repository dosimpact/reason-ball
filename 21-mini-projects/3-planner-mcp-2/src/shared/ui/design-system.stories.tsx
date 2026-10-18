import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Input } from "./input";

function DesignSystemPreview() {
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "32px auto",
        padding: 16,
        display: "grid",
        gap: 24,
      }}
    >
      <header>
        <h1>Planner 디자인 시스템</h1>
        <p className="muted">
          문서 중심의 작업을 위한 GitHub 스타일 팔레트와 shadcn/ui 컴포넌트
        </p>
      </header>
      <div
        aria-label="색상 팔레트"
        style={{ display: "flex", flexWrap: "wrap", gap: 16 }}
      >
        {[
          ["Background", "#ffffff"],
          ["Canvas", "#f6f8fa"],
          ["Text", "#1f2328"],
          ["Border", "#d1d9e0"],
          ["Primary", "#1f883d"],
          ["Link", "#0969da"],
          ["Danger", "#cf222e"],
        ].map(([label, color]) => (
          <div key={label}>
            <div
              style={{
                width: 84,
                height: 48,
                background: color,
                border: "1px solid #d1d9e0",
                borderRadius: 6,
              }}
            />
            <strong style={{ fontSize: 12 }}>{label}</strong>
            <div style={{ fontSize: 11 }}>{color}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>프로젝트 문서</CardTitle>
          <CardDescription>
            설계에서 검증까지, 현재 문서에서 다음 작업을 시작합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="design">
            <TabsList variant="line" aria-label="작업 단계">
              <TabsTrigger value="design">설계</TabsTrigger>
              <TabsTrigger value="implementation">구현</TabsTrigger>
              <TabsTrigger value="verification">검증</TabsTrigger>
            </TabsList>
            <TabsContent value="design">
              <p>설계 문서와 하위 문서를 관리합니다.</p>
              <Badge>진행 중</Badge>
            </TabsContent>
            <TabsContent value="implementation">
              <p>설계에 따라 구현 작업을 진행합니다.</p>
            </TabsContent>
            <TabsContent value="verification">
              <p>AI 검증과 사람의 최종 확인을 기록합니다.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              하위 문서 만들기
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>하위 문서 만들기</DialogTitle>
              <DialogDescription>
                설계 index 아래에 새로운 문서를 추가합니다.
              </DialogDescription>
            </DialogHeader>
            <label>
              문서 제목
              <Input placeholder="예: 로그인 흐름 설계" />
            </label>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">취소</Button>
              </DialogClose>
              <Button disabled>미리보기 전용</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="secondary">저장</Button>
        <Button variant="outline">미리보기</Button>
        <Button variant="ghost">더 보기</Button>
        <Button variant="destructive">문서 삭제</Button>
      </div>
    </div>
  );
}
const meta = {
  title: "Planner/DesignSystem",
  component: DesignSystemPreview,
} satisfies Meta<typeof DesignSystemPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GitHubPalette: Story = {};
