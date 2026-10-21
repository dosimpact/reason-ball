"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import * as A from "@/shared/ui/alert-dialog";
import * as D from "@/shared/ui/dialog";
import * as W from "@/shared/ui/drawer";
import * as H from "@/shared/ui/hover-card";
import * as P from "@/shared/ui/popover";
import * as S from "@/shared/ui/sheet";
import * as T from "@/shared/ui/tooltip";
import { Toaster, createToastManager } from "@/shared/ui/toast";
import type { AdapterMap, AdapterProps } from "./adapter";

function ToastAdapter({ props }: AdapterProps<"Toast">) {
  const [manager] = useState(() => createToastManager());
  return <Toaster toastManager={manager}><Button onClick={() => manager.add({ title: props.title, description: props.description })}>{props.trigger}</Button></Toaster>;
}

export const overlayAdapters = {
  AlertDialog: ({ props, children, emit, hasAction }) => <A.AlertDialog><A.AlertDialogTrigger render={<Button variant="outline" />}>{props.trigger}</A.AlertDialogTrigger><A.AlertDialogContent><A.AlertDialogHeader><A.AlertDialogTitle>{props.title}</A.AlertDialogTitle><A.AlertDialogDescription>{props.description}</A.AlertDialogDescription></A.AlertDialogHeader>{children(props.child)}<A.AlertDialogFooter><A.AlertDialogCancel>취소</A.AlertDialogCancel><A.AlertDialogAction disabled={!hasAction} onClick={() => emit()}>{props.confirmLabel}</A.AlertDialogAction></A.AlertDialogFooter></A.AlertDialogContent></A.AlertDialog>,
  Dialog: ({ props, children }) => <D.Dialog><D.DialogTrigger render={<Button variant="outline" />}>{props.trigger}</D.DialogTrigger><D.DialogContent><D.DialogHeader><D.DialogTitle>{props.title}</D.DialogTitle><D.DialogDescription>{props.description}</D.DialogDescription></D.DialogHeader>{children(props.child)}</D.DialogContent></D.Dialog>,
  Drawer: ({ props, children }) => <W.Drawer showSwipeHandle><W.DrawerTrigger render={<Button variant="outline" />}>{props.trigger}</W.DrawerTrigger><W.DrawerContent><W.DrawerHeader><W.DrawerTitle>{props.title}</W.DrawerTitle><W.DrawerDescription>{props.description}</W.DrawerDescription></W.DrawerHeader><div className="p-4">{children(props.child)}</div><W.DrawerFooter><W.DrawerClose render={<Button variant="outline" />}>닫기</W.DrawerClose></W.DrawerFooter></W.DrawerContent></W.Drawer>,
  HoverCard: ({ props, children }) => <H.HoverCard><H.HoverCardTrigger render={<button type="button" className="underline" />}>{props.trigger}</H.HoverCardTrigger><H.HoverCardContent><h3 className="font-semibold">{props.title}</h3><p>{props.description}</p>{children(props.child)}</H.HoverCardContent></H.HoverCard>,
  Popover: ({ props, children }) => <P.Popover><P.PopoverTrigger render={<Button variant="outline" />}>{props.trigger}</P.PopoverTrigger><P.PopoverContent><P.PopoverTitle>{props.title}</P.PopoverTitle><P.PopoverDescription>{props.description}</P.PopoverDescription>{children(props.child)}</P.PopoverContent></P.Popover>,
  Sheet: ({ props, children }) => <S.Sheet><S.SheetTrigger render={<Button variant="outline" />}>{props.trigger}</S.SheetTrigger><S.SheetContent><S.SheetHeader><S.SheetTitle>{props.title}</S.SheetTitle><S.SheetDescription>{props.description}</S.SheetDescription></S.SheetHeader><div className="p-4">{children(props.child)}</div></S.SheetContent></S.Sheet>,
  Toast: ToastAdapter,
  Tooltip: ({ props }) => <T.TooltipProvider><T.Tooltip><T.TooltipTrigger render={<Button variant="outline" />}>{props.trigger}</T.TooltipTrigger><T.TooltipContent>{props.text}</T.TooltipContent></T.Tooltip></T.TooltipProvider>,
} satisfies Partial<AdapterMap>;
