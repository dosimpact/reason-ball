"use client";

import { Boxes, CheckSquare, Home, Images, LayoutTemplate, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { usePathname } from "next/navigation";
import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";

const navGroups = [
  {
    title: "Overview",
    items: [{ title: "Home", href: "/", icon: Home }],
  },
  {
    title: "Remote Apps",
    items: [
      { title: "Template", href: "/remotes/template", icon: LayoutTemplate },
      { title: "Todo", href: "/remotes/todo", icon: CheckSquare },
    ],
  },
  {
    title: "Operations",
    items: [{ title: "SEC 수집 관리", href: "/sec-collector", icon: Boxes }, { title: "SEC 모델링 관리", href: "/sec-modeling", icon: Boxes }, { title: "DART API Testing", href: "/dart-collector", icon: Boxes }],
  },
  {
    title: "AI Chat",
    items: [
      { title: "기술적 분석 · 인라인", href: "/technical-analysis", icon: MessagesSquare },
      { title: "기술적 분석 · Canvas", href: "/technical-analysis/canvas", icon: MessagesSquare },
      { title: "TA-Lib 채팅", href: "/talib-chat", icon: MessagesSquare },
      { title: "SEC API Agent", href: "/sec-api-agent", icon: MessagesSquare },
      { title: "SEC Research Chat", href: "/sec-chat", icon: MessagesSquare },
    ],
  },
  {
    title: "Debugging",
    items: [
      { title: "Langgraph dev chat", href: "/langgraph-dev-chat", icon: MessagesSquare },
      { title: "FastAPI 채팅", href: "/fastapi-chat", icon: MessagesSquare },
    ],
  },
  {
    title: "Generative UI",
    items: [
      { title: "UI Demos", href: "/open-ui", icon: Boxes },
      { title: "OpenUI Lang Catalog", href: "/open-ui/catalog", icon: LayoutTemplate },
      { title: "OpenUI Gallery", href: "/open-ui/gallery", icon: Images },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const activeHref = navGroups.flatMap(group => group.items)
    .filter(item => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Reason Hwang"
              render={<Link href="/" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Boxes className="size-4" aria-hidden="true" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Reason Hwang</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  FE Host
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map(group => <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeHref === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} onClick={() => { if (isMobile) setOpenMobile(false); }} />}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarTrigger />
          <ThemeToggle />
        </div>
        <SidebarGroup className="py-0">
          <SidebarGroupContent className="rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs text-sidebar-foreground/75 group-data-[collapsible=icon]:hidden">
            Remote entries are loaded through the BFF proxy.
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Mobile navigation remains reachable without reserving an application header. */
export function MobileSidebarTrigger() {
  const pathname = usePathname();
  if (["/talib-chat", "/langgraph-dev-chat", "/chat", "/fastapi-chat", "/technical-analysis", "/technical-analysis/canvas"].includes(pathname)) return null;
  return <SidebarTrigger className="fixed bottom-24 left-4 z-40 size-10 rounded-full border bg-background shadow-md md:hidden" />;
}
