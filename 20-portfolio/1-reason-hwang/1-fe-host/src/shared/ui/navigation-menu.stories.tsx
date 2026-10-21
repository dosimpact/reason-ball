import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from './navigation-menu';

const meta = {
  title: 'UI/Navigation Menu',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Documentation: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>시작하기</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-72 gap-2 p-3">
              <NavigationMenuLink href="https://ui.shadcn.com/docs">
                <strong>소개</strong>
                <span className="text-xs text-muted-foreground">
                  컴포넌트 라이브러리 시작하기
                </span>
              </NavigationMenuLink>
              <NavigationMenuLink href="https://ui.shadcn.com/docs/installation">
                <strong>설치</strong>
                <span className="text-xs text-muted-foreground">
                  프로젝트 설정과 CLI 사용법
                </span>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="https://react.dev">
            React 문서 ↗
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
export const DirectLinks: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink href="https://ui.shadcn.com/docs" active>
            문서
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="https://ui.shadcn.com/docs/components">
            컴포넌트
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
