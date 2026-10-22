# UI Components Catalog & AI Search Index

> **AI Agent Quick Reference & File Router**  
> 이 문서는 LLM 및 AI 에이전트가 `1-fe-host/src/components/ui` 하위의 컴포넌트들을 정확하고 빠르게 탐색하고, 기능별 의도(Intent), 키워드, exported 심볼 및 파일 경로를 즉시 매핑할 수 있도록 설계된 인덱싱 문서입니다.

---

## 1. Quick Decision Matrix (사용자 요구사항별 컴포넌트 매핑)

| 구현할 기능 / 사용자 요구사항 | 권장 UI 컴포넌트 | 메인 Export 심볼 | 파일 경로 |
|---|---|---|---|
| 일반 클릭 액션, 폼 제출, 버튼 그룹 | `button`, `button-group` | `Button`, `buttonVariants`, `ButtonGroup` | [button.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/button.tsx) |
| 단순 텍스트 입력, 검색 인풋 | `input`, `input-group` | `Input`, `InputGroup`, `InputGroupAddon` | [input.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input.tsx) |
| 장문 텍스트, 설명, 코멘트 입력 | `textarea` | `Textarea` | [textarea.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/textarea.tsx) |
| 단일 옵션 선택 (드롭다운) | `select`, `native-select` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | [select.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/select.tsx) |
| 자동완성 검색 드롭다운, 태그 선택 | `combobox` | `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxItem` | [combobox.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/combobox.tsx) |
| 키보드 단축키 검색창 (Cmd+K / Ctrl+K) | `command` | `Command`, `CommandDialog`, `CommandInput`, `CommandList` | [command.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/command.tsx) |
| 모달 팝업, 폼 입력 팝업 | `dialog` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader` | [dialog.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/dialog.tsx) |
| 삭제 확인, 비가역적 액션 경고 팝업 | `alert-dialog` | `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel` | [alert-dialog.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/alert-dialog.tsx) |
| 우측/좌측 슬라이드 오버 패널 | `sheet` | `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader` | [sheet.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/sheet.tsx) |
| 모바일 친화적 바텀 시트 (스마트폰용) | `drawer` | `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader` | [drawer.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/drawer.tsx) |
| 챗봇 대화창, 메시지 버블, 타임스탬프 | `message`, `bubble`, `message-scroller` | `Message`, `MessageContent`, `Bubble`, `MessageScroller` | [message.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/message.tsx) |
| 파일 첨부, 드래그앤드롭 업로드 카드 | `attachment` | `Attachment`, `AttachmentPreview`, `AttachmentRemove` | [attachment.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/attachment.tsx) |
| 설문 조사, 온보딩 질문 인터뷰 폼 | `questionnaire` | `Questionnaire`, `QuestionnaireStep`, `QuestionnaireItem` | [questionnaire.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/questionnaire.tsx) |
| 데이터 테이블, 그리드 뷰 | `table` | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` | [table.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/table.tsx) |
| 시각화 차트 (Line, Bar, Area 등) | `chart` | `ChartContainer`, `ChartTooltip`, `ChartLegend` | [chart.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/chart.tsx) |
| 데이터 로딩 플레이스홀더 (스켈레톤) | `skeleton`, `spinner` | `Skeleton`, `Spinner` | [skeleton.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/skeleton.tsx) |
| 결과 없음, 빈 목록 안내 화면 | `empty` | `Empty`, `EmptyImage`, `EmptyTitle`, `EmptyDescription` | [empty.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/empty.tsx) |
| 알림 메시지 (토스트 팝업) | `toast` | `Toast`, `ToastProvider`, `ToastViewport`, `ToastTitle` | [toast.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toast.tsx) |
| 페이지 전체 레이아웃 사이드바 내비게이션 | `sidebar` | `Sidebar`, `SidebarContent`, `SidebarProvider`, `SidebarTrigger` | [sidebar.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/sidebar.tsx) |

---

## 2. 전체 컴포넌트 인덱스 (Alphabetical Directory)

### A
- **accordion**
  - **Path**: [accordion.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/accordion.tsx) / [accordion.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/accordion.stories.tsx)
  - **Symbols**: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
  - **Keywords**: faq, collapsible list, expand, disclosure
- **alert**
  - **Path**: [alert.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/alert.tsx) / [alert.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/alert.stories.tsx)
  - **Symbols**: `Alert`, `AlertTitle`, `AlertDescription`
  - **Keywords**: banner, warning, info, notice, error box
- **alert-dialog**
  - **Path**: [alert-dialog.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/alert-dialog.tsx) / [alert-dialog.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/alert-dialog.stories.tsx)
  - **Symbols**: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`
  - **Keywords**: confirm modal, destructive warning, confirmation dialog
- **aspect-ratio**
  - **Path**: [aspect-ratio.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/aspect-ratio.tsx) / [aspect-ratio.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/aspect-ratio.stories.tsx)
  - **Symbols**: `AspectRatio`
  - **Keywords**: image ratio, 16:9, video wrapper
- **attachment**
  - **Path**: [attachment.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/attachment.tsx) / [attachment.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/attachment.stories.tsx)
  - **Symbols**: `Attachment`, `AttachmentPreview`, `AttachmentInfo`, `AttachmentRemove`
  - **Keywords**: file upload, preview card, chat attachments
- **avatar**
  - **Path**: [avatar.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/avatar.tsx) / [avatar.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/avatar.stories.tsx)
  - **Symbols**: `Avatar`, `AvatarImage`, `AvatarFallback`
  - **Keywords**: user profile, picture, initial circle

### B
- **badge**
  - **Path**: [badge.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/badge.tsx) / [badge.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/badge.stories.tsx)
  - **Symbols**: `Badge`, `badgeVariants`
  - **Keywords**: tag, pill, status indicator, chip
- **breadcrumb**
  - **Path**: [breadcrumb.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/breadcrumb.tsx) / [breadcrumb.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/breadcrumb.stories.tsx)
  - **Symbols**: `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`
  - **Keywords**: navigation path, hierarchy, trail
- **bubble**
  - **Path**: [bubble.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/bubble.tsx) / [bubble.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/bubble.stories.tsx)
  - **Symbols**: `Bubble`
  - **Keywords**: chat bubble, message cloud, conversation item
- **button**
  - **Path**: [button.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/button.tsx) / [button.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/button.stories.tsx)
  - **Symbols**: `Button`, `buttonVariants`
  - **Keywords**: action, cta, trigger, click
- **button-group**
  - **Path**: [button-group.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/button-group.tsx) / [button-group.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/button-group.stories.tsx)
  - **Symbols**: `ButtonGroup`
  - **Keywords**: segmented buttons, button bar

### C
- **calendar**
  - **Path**: [calendar.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/calendar.tsx) / [calendar.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/calendar.stories.tsx)
  - **Symbols**: `Calendar`
  - **Keywords**: date picker, month view, day selector
- **card**
  - **Path**: [card.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/card.tsx) / [card.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/card.stories.tsx)
  - **Symbols**: `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`
  - **Keywords**: container, tile, panel, box
- **carousel**
  - **Path**: [carousel.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/carousel.tsx) / [carousel.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/carousel.stories.tsx)
  - **Symbols**: `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`
  - **Keywords**: slider, swiper, image gallery
- **chart**
  - **Path**: [chart.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/chart.tsx) / [chart.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/chart.stories.tsx)
  - **Symbols**: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`
  - **Keywords**: recharts, visualization, graph, analytics
- **checkbox**
  - **Path**: [checkbox.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/checkbox.tsx) / [checkbox.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/checkbox.stories.tsx)
  - **Symbols**: `Checkbox`
  - **Keywords**: check, multiselect, boolean input
- **collapsible**
  - **Path**: [collapsible.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/collapsible.tsx) / [collapsible.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/collapsible.stories.tsx)
  - **Symbols**: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
  - **Keywords**: toggle show/hide, foldable
- **combobox**
  - **Path**: [combobox.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/combobox.tsx) / [combobox.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/combobox.stories.tsx)
  - **Symbols**: `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxItem`, `ComboboxEmpty`, `ComboboxList`
  - **Keywords**: autocomplete, searchable select, filtered dropdown
- **command**
  - **Path**: [command.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/command.tsx) / [command.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/command.stories.tsx)
  - **Symbols**: `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator`
  - **Keywords**: spotlight, cmd+k, command palette, fast menu
- **context-menu**
  - **Path**: [context-menu.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/context-menu.tsx) / [context-menu.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/context-menu.stories.tsx)
  - **Symbols**: `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`
  - **Keywords**: right click menu, secondary click menu

### D
- **dialog**
  - **Path**: [dialog.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/dialog.tsx) / [dialog.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/dialog.stories.tsx)
  - **Symbols**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`
  - **Keywords**: modal, popup, lightbox
- **direction**
  - **Path**: [direction.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/direction.tsx) / [direction.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/direction.stories.tsx)
  - **Symbols**: `DirectionProvider`
  - **Keywords**: rtl, ltr, reading direction
- **drawer**
  - **Path**: [drawer.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/drawer.tsx) / [drawer.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/drawer.stories.tsx)
  - **Symbols**: `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`
  - **Keywords**: bottom sheet, mobile swipe drawer
- **dropdown-menu**
  - **Path**: [dropdown-menu.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/dropdown-menu.tsx) / [dropdown-menu.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/dropdown-menu.stories.tsx)
  - **Symbols**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`
  - **Keywords**: actions menu, kebab menu, option list

### E ~ I
- **empty**
  - **Path**: [empty.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/empty.tsx) / [empty.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/empty.stories.tsx)
  - **Symbols**: `Empty`, `EmptyImage`, `EmptyTitle`, `EmptyDescription`, `EmptyAction`
  - **Keywords**: no results, empty state, zero data
- **field**
  - **Path**: [field.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/field.tsx) / [field.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/field.stories.tsx)
  - **Symbols**: `Field`, `FieldLabel`, `FieldDescription`, `FieldError`
  - **Keywords**: form control wrapper, validation error label
- **hover-card**
  - **Path**: [hover-card.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/hover-card.tsx) / [hover-card.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/hover-card.stories.tsx)
  - **Symbols**: `HoverCard`, `HoverCardTrigger`, `HoverCardContent`
  - **Keywords**: preview on hover, user bio preview
- **input**
  - **Path**: [input.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input.tsx) / [input.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input.stories.tsx)
  - **Symbols**: `Input`
  - **Keywords**: textfield, text input
- **input-group**
  - **Path**: [input-group.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input-group.tsx) / [input-group.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input-group.stories.tsx)
  - **Symbols**: `InputGroup`, `InputGroupAddon`, `InputGroupButton`
  - **Keywords**: input with icon, prefix suffix input
- **input-otp**
  - **Path**: [input-otp.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input-otp.tsx) / [input-otp.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/input-otp.stories.tsx)
  - **Symbols**: `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`
  - **Keywords**: 2fa code, pin code, verification input
- **item**
  - **Path**: [item.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/item.tsx) / [item.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/item.stories.tsx)
  - **Symbols**: `Item`, `ItemContent`, `ItemActions`
  - **Keywords**: list row, card item, layout cell

### K ~ P
- **kbd**
  - **Path**: [kbd.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/kbd.tsx) / [kbd.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/kbd.stories.tsx)
  - **Symbols**: `Kbd`
  - **Keywords**: key shortcut badge, keyboard cap
- **label**
  - **Path**: [label.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/label.tsx) / [label.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/label.stories.tsx)
  - **Symbols**: `Label`
  - **Keywords**: input title, accessible form label
- **marker**
  - **Path**: [marker.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/marker.tsx) / [marker.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/marker.stories.tsx)
  - **Symbols**: `Marker`
  - **Keywords**: text highlighter, marker pen, callout
- **menubar**
  - **Path**: [menubar.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/menubar.tsx) / [menubar.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/menubar.stories.tsx)
  - **Symbols**: `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`
  - **Keywords**: top desktop menu, file edit view menu
- **message**
  - **Path**: [message.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/message.tsx) / [message.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/message.stories.tsx)
  - **Symbols**: `Message`, `MessageGroup`, `MessageAvatar`, `MessageContent`, `MessageFooter`
  - **Keywords**: chat message, ai response, user prompt
- **message-scroller**
  - **Path**: [message-scroller.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/message-scroller.tsx) / [message-scroller.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/message-scroller.stories.tsx)
  - **Symbols**: `MessageScroller`
  - **Keywords**: auto scroll to bottom, chat stream scroll
- **native-select**
  - **Path**: [native-select.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/native-select.tsx) / [native-select.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/native-select.stories.tsx)
  - **Symbols**: `NativeSelect`
  - **Keywords**: html select, standard select, mobile picker
- **navigation-menu**
  - **Path**: [navigation-menu.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/navigation-menu.tsx) / [navigation-menu.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/navigation-menu.stories.tsx)
  - **Symbols**: `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuTrigger`, `NavigationMenuContent`, `NavigationMenuLink`
  - **Keywords**: global header menu, mega menu
- **pagination**
  - **Path**: [pagination.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/pagination.tsx) / [pagination.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/pagination.stories.tsx)
  - **Symbols**: `Pagination`, `PaginationContent`, `PaginationLink`, `PaginationItem`, `PaginationPrevious`, `PaginationNext`
  - **Keywords**: page numbers, next prev, list pagination
- **popover**
  - **Path**: [popover.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/popover.tsx) / [popover.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/popover.stories.tsx)
  - **Symbols**: `Popover`, `PopoverTrigger`, `PopoverContent`
  - **Keywords**: floating card, dropdown content, anchor popup
- **progress**
  - **Path**: [progress.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/progress.tsx) / [progress.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/progress.stories.tsx)
  - **Symbols**: `Progress`
  - **Keywords**: loading bar, completion percent, gauge

### Q ~ S
- **questionnaire**
  - **Path**: [questionnaire.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/questionnaire.tsx) / [questionnaire.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/questionnaire.stories.tsx)
  - **Symbols**: `Questionnaire`, `QuestionnaireStep`, `QuestionnaireContent`, `QuestionnaireActions`
  - **Keywords**: wizard, survey, multi-step form, prompt questionnaire
- **radio-group**
  - **Path**: [radio-group.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/radio-group.tsx) / [radio-group.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/radio-group.stories.tsx)
  - **Symbols**: `RadioGroup`, `RadioGroupItem`
  - **Keywords**: single choice radio, option circle
- **resizable**
  - **Path**: [resizable.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/resizable.tsx) / [resizable.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/resizable.stories.tsx)
  - **Symbols**: `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
  - **Keywords**: split screen, draggable divider, panel resize
- **scroll-area**
  - **Path**: [scroll-area.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/scroll-area.tsx) / [scroll-area.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/scroll-area.stories.tsx)
  - **Symbols**: `ScrollArea`, `ScrollBar`
  - **Keywords**: custom scrollbar, overflow container
- **select**
  - **Path**: [select.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/select.tsx) / [select.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/select.stories.tsx)
  - **Symbols**: `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectItem`
  - **Keywords**: dropdown picker, custom select
- **separator**
  - **Path**: [separator.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/separator.tsx) / [separator.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/separator.stories.tsx)
  - **Symbols**: `Separator`
  - **Keywords**: hr, divider line, vertical horizontal split
- **sheet**
  - **Path**: [sheet.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/sheet.tsx) / [sheet.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/sheet.stories.tsx)
  - **Symbols**: `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`
  - **Keywords**: offcanvas, side drawer, flyout
- **sidebar**
  - **Path**: [sidebar.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/sidebar.tsx) / [sidebar.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/sidebar.stories.tsx)
  - **Symbols**: `Sidebar`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarHeader`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarProvider`, `SidebarTrigger`
  - **Keywords**: app sidebar, navigation drawer, collapsible menu
- **skeleton**
  - **Path**: [skeleton.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/skeleton.tsx) / [skeleton.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/skeleton.stories.tsx)
  - **Symbols**: `Skeleton`
  - **Keywords**: shimmer placeholder, content skeleton
- **slider**
  - **Path**: [slider.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/slider.tsx) / [slider.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/slider.stories.tsx)
  - **Symbols**: `Slider`
  - **Keywords**: range input, volume bar, value scrubber
- **spinner**
  - **Path**: [spinner.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/spinner.tsx) / [spinner.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/spinner.stories.tsx)
  - **Symbols**: `Spinner`
  - **Keywords**: loader, rotating wheel, wait indicator
- **switch**
  - **Path**: [switch.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/switch.tsx) / [switch.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/switch.stories.tsx)
  - **Symbols**: `Switch`
  - **Keywords**: toggle switch, boolean flag, on/off control

### T
- **table**
  - **Path**: [table.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/table.tsx) / [table.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/table.stories.tsx)
  - **Symbols**: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`
  - **Keywords**: data grid, row column view
- **tabs**
  - **Path**: [tabs.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/tabs.tsx) / [tabs.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/tabs.stories.tsx)
  - **Symbols**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - **Keywords**: tab bar, switchable panel
- **textarea**
  - **Path**: [textarea.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/textarea.tsx) / [textarea.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/textarea.stories.tsx)
  - **Symbols**: `Textarea`
  - **Keywords**: multiline text, message box
- **toast**
  - **Path**: [toast.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toast.tsx) / [toast.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toast.stories.tsx)
  - **Symbols**: `Toast`, `ToastProvider`, `ToastViewport`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction`
  - **Keywords**: snackbar, popup notification, alert notification
- **toggle**
  - **Path**: [toggle.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toggle.tsx) / [toggle.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toggle.stories.tsx)
  - **Symbols**: `Toggle`, `toggleVariants`
  - **Keywords**: press button, on/off state button
- **toggle-group**
  - **Path**: [toggle-group.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toggle-group.tsx) / [toggle-group.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/toggle-group.stories.tsx)
  - **Symbols**: `ToggleGroup`, `ToggleGroupItem`
  - **Keywords**: multi-select buttons, text align options
- **tooltip**
  - **Path**: [tooltip.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/tooltip.tsx) / [tooltip.stories.tsx](file:///Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/src/components/ui/tooltip.stories.tsx)
  - **Symbols**: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
  - **Keywords**: hint on hover, mouseover info
