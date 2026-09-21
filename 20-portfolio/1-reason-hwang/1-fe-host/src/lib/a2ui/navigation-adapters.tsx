"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import * as A from "@/components/ui/accordion";
import * as C from "@/components/ui/carousel";
import * as L from "@/components/ui/collapsible";
import * as Q from "@/components/ui/command";
import * as X from "@/components/ui/context-menu";
import * as D from "@/components/ui/dropdown-menu";
import * as M from "@/components/ui/menubar";
import * as N from "@/components/ui/navigation-menu";
import * as P from "@/components/ui/pagination";
import * as S from "@/components/ui/sidebar";
import * as T from "@/components/ui/tabs";
import type { AdapterMap, AdapterProps } from "./adapter";

function SidebarAdapter({ props }: AdapterProps<"Sidebar">) {
  const [active, setActive] = useState(props.items[0]?.value);
  return <S.SidebarProvider className="min-h-0"><S.Sidebar collapsible="none" className="w-full"><S.SidebarContent><S.SidebarGroup><S.SidebarGroupLabel>{props.title}</S.SidebarGroupLabel><S.SidebarGroupContent><S.SidebarMenu>{props.items.map(item => <S.SidebarMenuItem key={item.value}><S.SidebarMenuButton isActive={active === item.value} onClick={() => setActive(item.value)}>{item.label}</S.SidebarMenuButton></S.SidebarMenuItem>)}</S.SidebarMenu></S.SidebarGroupContent></S.SidebarGroup></S.SidebarContent></S.Sidebar></S.SidebarProvider>;
}

export const navigationAdapters = {
  Accordion: ({ props }) => <A.Accordion>{props.items.map((item, index) => <A.AccordionItem key={index} value={String(index)}><A.AccordionTrigger>{item.title}</A.AccordionTrigger><A.AccordionContent className="whitespace-pre-wrap break-words">{item.text}</A.AccordionContent></A.AccordionItem>)}</A.Accordion>,
  Carousel: ({ props }) => <div className="px-10"><C.Carousel><C.CarouselContent>{props.items.map((item, index) => <C.CarouselItem key={index}><section className="rounded-lg border p-5"><h3>{item.title}</h3><p>{item.text}</p></section></C.CarouselItem>)}</C.CarouselContent><C.CarouselPrevious /><C.CarouselNext /></C.Carousel></div>,
  Collapsible: ({ props, children }) => <L.Collapsible><L.CollapsibleTrigger render={<Button variant="outline" />}>{props.title}</L.CollapsibleTrigger><L.CollapsibleContent className="pt-3">{children(props.child)}</L.CollapsibleContent></L.Collapsible>,
  Command: ({ props, emit, hasAction }) => <Q.Command><Q.CommandInput placeholder={props.label} aria-label={props.label} /><Q.CommandList><Q.CommandEmpty>일치하는 항목이 없습니다</Q.CommandEmpty><Q.CommandGroup>{props.items.map(item => <Q.CommandItem key={item.value} value={item.label} disabled={!hasAction} onSelect={() => emit({ value: item.value })}>{item.label}</Q.CommandItem>)}</Q.CommandGroup></Q.CommandList></Q.Command>,
  ContextMenu: ({ props, emit, hasAction }) => <X.ContextMenu><X.ContextMenuTrigger className="block rounded-lg border border-dashed p-6" tabIndex={0}>{props.label}</X.ContextMenuTrigger><X.ContextMenuContent>{props.items.map(item => <X.ContextMenuItem key={item.value} disabled={!hasAction} onClick={() => emit({ value: item.value })}>{item.label}</X.ContextMenuItem>)}</X.ContextMenuContent></X.ContextMenu>,
  DropdownMenu: ({ props, emit, hasAction }) => <D.DropdownMenu><D.DropdownMenuTrigger render={<Button variant="outline" />}>{props.label}</D.DropdownMenuTrigger><D.DropdownMenuContent>{props.items.map(item => <D.DropdownMenuItem key={item.value} disabled={!hasAction} onClick={() => emit({ value: item.value })}>{item.label}</D.DropdownMenuItem>)}</D.DropdownMenuContent></D.DropdownMenu>,
  Menubar: ({ props, emit, hasAction }) => <M.Menubar><M.MenubarMenu><M.MenubarTrigger>{props.label}</M.MenubarTrigger><M.MenubarContent>{props.items.map(item => <M.MenubarItem key={item.value} disabled={!hasAction} onClick={() => emit({ value: item.value })}>{item.label}</M.MenubarItem>)}</M.MenubarContent></M.MenubarMenu></M.Menubar>,
  NavigationMenu: ({ props }) => <N.NavigationMenu><N.NavigationMenuList>{props.items.map((item, index) => <N.NavigationMenuItem key={index}><N.NavigationMenuLink href={item.href}>{item.label}</N.NavigationMenuLink></N.NavigationMenuItem>)}</N.NavigationMenuList></N.NavigationMenu>,
  Pagination: ({ props, set }) => <P.Pagination aria-label={props.label}><P.PaginationContent className="flex-wrap">{Array.from({ length: props.pages }, (_, index) => <P.PaginationItem key={index}><P.PaginationLink href="#" aria-label={`${index + 1} 페이지`} isActive={props.value === index + 1} onClick={event => { event.preventDefault(); set("value", index + 1); }}>{index + 1}</P.PaginationLink></P.PaginationItem>)}</P.PaginationContent></P.Pagination>,
  Sidebar: SidebarAdapter,
  Tabs: ({ props }) => <T.Tabs defaultValue="0"><T.TabsList>{props.items.map((item, index) => <T.TabsTrigger key={index} value={String(index)}>{item.title}</T.TabsTrigger>)}</T.TabsList>{props.items.map((item, index) => <T.TabsContent key={index} value={String(index)}>{item.text}</T.TabsContent>)}</T.Tabs>,
} satisfies Partial<AdapterMap>;
