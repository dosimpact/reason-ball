"use client";

import { Fragment } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Attachment, AttachmentContent, AttachmentTitle, AttachmentDescription } from "@/components/ui/attachment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { ButtonGroup } from "@/components/ui/button-group";
import { DirectionProvider } from "@/components/ui/direction";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Item, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from "@/components/ui/message-scroller";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { AdapterMap } from "./adapter";

export const displayAdapters = {
  Alert: ({ props }) => <Alert variant={props.variant}><AlertTitle>{props.title}</AlertTitle><AlertDescription>{props.text}</AlertDescription></Alert>,
  AspectRatio: ({ props, children }) => <AspectRatio ratio={props.ratio}>{children(props.child)}</AspectRatio>,
  Attachment: ({ props }) => <Attachment><AttachmentContent><AttachmentTitle>{props.title}</AttachmentTitle><AttachmentDescription>{props.description}</AttachmentDescription></AttachmentContent></Attachment>,
  Avatar: ({ props }) => <Avatar aria-label={props.name}><AvatarFallback>{props.initials}</AvatarFallback></Avatar>,
  Breadcrumb: ({ props }) => <Breadcrumb><BreadcrumbList>{props.items.map((item, index) => <Fragment key={index}>{index > 0 && <BreadcrumbSeparator />}<BreadcrumbItem>{index === props.items.length - 1 ? <BreadcrumbPage>{item}</BreadcrumbPage> : <span>{item}</span>}</BreadcrumbItem></Fragment>)}</BreadcrumbList></Breadcrumb>,
  Bubble: ({ props }) => <Bubble align={props.from === "user" ? "end" : "start"}><BubbleContent>{props.text}</BubbleContent></Bubble>,
  ButtonGroup: ({ props, children }) => <ButtonGroup>{props.children.map(id => <Fragment key={id}>{children(id)}</Fragment>)}</ButtonGroup>,
  Direction: ({ props, children }) => <DirectionProvider direction={props.direction}><div dir={props.direction}>{children(props.child)}</div></DirectionProvider>,
  Empty: ({ props }) => <Empty><EmptyHeader><EmptyTitle>{props.title}</EmptyTitle><EmptyDescription>{props.description}</EmptyDescription></EmptyHeader></Empty>,
  Item: ({ props }) => <Item><ItemContent><ItemTitle>{props.title}</ItemTitle><ItemDescription>{props.description}</ItemDescription></ItemContent></Item>,
  Kbd: ({ props }) => <Kbd>{props.text}</Kbd>,
  Label: ({ props }) => <Label>{props.text}</Label>,
  Marker: ({ props }) => <Marker><MarkerContent>{props.text}</MarkerContent></Marker>,
  Message: ({ props }) => <Message><MessageContent><MessageHeader>{props.author}</MessageHeader><p>{props.text}</p></MessageContent></Message>,
  MessageScroller: ({ props }) => <div className="h-64"><MessageScrollerProvider><MessageScroller><MessageScrollerViewport aria-label="메시지 목록" tabIndex={0}><MessageScrollerContent className="p-4">{props.messages.map((message, index) => <MessageScrollerItem key={index}><Message><MessageContent><MessageHeader>{message.author}</MessageHeader><p>{message.text}</p></MessageContent></Message></MessageScrollerItem>)}</MessageScrollerContent></MessageScrollerViewport><MessageScrollerButton direction="end" /></MessageScroller></MessageScrollerProvider></div>,
  Progress: ({ props }) => <Progress value={Math.max(0, Math.min(100, props.value ?? 0))}><ProgressLabel>{props.label}</ProgressLabel><ProgressValue /></Progress>,
  Resizable: ({ props, children }) => <ResizablePanelGroup className="min-h-40"><ResizablePanel defaultSize="50%">{children(props.first)}</ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize="50%">{children(props.second)}</ResizablePanel></ResizablePanelGroup>,
  ScrollArea: ({ props, children }) => <ScrollArea style={{ height: props.height }}>{children(props.child)}</ScrollArea>,
  Separator: ({ props }) => <Separator orientation={props.orientation} />,
  Skeleton: ({ props }) => <Skeleton aria-label="불러오는 중" style={{ width: props.width, maxWidth: "100%", height: props.height }} />,
  Spinner: ({ props }) => <div role="status" className="flex items-center gap-2"><Spinner /><span>{props.label}</span></div>,
} satisfies Partial<AdapterMap>;
