import { useState, type ComponentProps } from 'react';
import { Folder, Home, Inbox, Settings, Sparkles } from 'lucide-react';
import {
  SidebarHeader,
  SidebarFooter,
  SidebarMenuBadge,
  SidebarSeparator,
} from './sidebar';
import { Avatar, AvatarFallback } from './avatar';
import { Card, CardHeader, CardTitle, CardDescription } from './card';
import { TooltipProvider } from './tooltip';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from './sidebar';

const meta = {
  title: 'UI/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '400px' } },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<a href="#home" />} isActive>
                    Home
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<a href="#settings" />}>
                    Settings
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-4">
          <SidebarTrigger />
          <p>사이드바를 열거나 닫아보세요.</p>
        </div>
      </SidebarInset>
    </>
  ),
};

function WorkspaceSidebar({
  variant = 'sidebar',
  collapsible = 'icon',
}: Pick<ComponentProps<typeof Sidebar>, 'variant' | 'collapsible'>) {
  const [active, setActive] = useState('개요');
  return (
    <TooltipProvider>
      <Sidebar variant={variant} collapsible={collapsible}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Sparkles />
                <span className="font-semibold">Reason Workspace</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>워크스페이스</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  { label: '개요', icon: Home },
                  { label: '프로젝트', icon: Folder },
                  { label: '받은 편지함', icon: Inbox },
                  { label: '설정', icon: Settings },
                ].map(({ label, icon: Icon }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      isActive={active === label}
                      tooltip={label}
                      onClick={() => setActive(label)}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {label === '받은 편지함' && (
                      <SidebarMenuBadge>4</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>최근 프로젝트</SidebarGroupLabel>
            <SidebarMenu>
              {['Portfolio v2', 'Design System'].map((name) => (
                <SidebarMenuItem key={name}>
                  <SidebarMenuButton
                    onClick={() => setActive(name)}
                    isActive={active === name}
                    tooltip={name}
                  >
                    <Folder />
                    <span>{name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Avatar size="sm">
                  <AvatarFallback>RH</AvatarFallback>
                </Avatar>
                <span>Reason Hwang</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-3 border-b p-4">
          <SidebarTrigger />
          <h2 className="text-sm font-semibold">{active}</h2>
        </header>
        <div className="space-y-5 p-5">
          <p className="text-sm text-muted-foreground">
            메뉴를 선택하거나 사이드바를 접어보세요. 좁은 화면에서는 서랍으로
            열립니다.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardDescription>진행 중 프로젝트</CardDescription>
                <CardTitle className="text-2xl">12</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>이번 주 완료</CardDescription>
                <CardTitle className="text-2xl">28</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </TooltipProvider>
  );
}
export const Workspace: Story = { render: () => <WorkspaceSidebar /> };
export const Floating: Story = {
  render: () => <WorkspaceSidebar variant="floating" />,
};
export const Inset: Story = {
  render: () => <WorkspaceSidebar variant="inset" />,
};
export const Offcanvas: Story = {
  render: () => <WorkspaceSidebar collapsible="offcanvas" />,
};
