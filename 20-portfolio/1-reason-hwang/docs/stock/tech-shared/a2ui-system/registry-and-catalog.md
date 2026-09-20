# Registry와 정적 카탈로그

A2UI-REG-001 / A2UI-CAT-001 / A2UI-VER-001. [전체 지도](INDEX.md).

## 원본과 생성물

- [definitions.ts](../../../../1-fe-host/src/lib/a2ui/definitions.ts): Zod props와 모드별 구성의 원본.
- [catalog.tsx](../../../../1-fe-host/src/lib/a2ui/catalog.tsx): SDK Catalog와 React 어댑터 연결.
- [생성기](../../../../1-fe-host/scripts/a2ui-contract.ts): JSON Schema 생성, 정렬, SHA-256, 설치 버전/원본 파일 대응 검사.
- [inventory.json](../../../../assets/a2ui/inventory.json): 실제 등록 목록.
- [manifest.json](../../../../assets/a2ui/manifest.json): 버전·프로필·해시 원본. 아래 표는 문서화 시점의 조회이며 자동 검사 원본을 대체하지 않는다.

생성물은 `assets/a2ui`, `1-fe-host/src/lib/a2ui/generated`, `3-langgraph-fast/src/graph/primary_graphs/a2ui_demo/contracts`에 배포한다. `pnpm a2ui:generate` 후 `pnpm a2ui:check`로 세 복사본의 drift를 검사한다. JSON을 직접 수정하지 않는다.

## 하위 카탈로그

| 프로필 | 컴포넌트 수 | catalogId |
| --- | ---: | --- |
| dynamic | 12 | `reason-hwang://a2ui/dynamic/1.0.0` |
| fixed | 8 | `reason-hwang://a2ui/fixed/1.0.0` |
| host | 66 | `reason-hwang://a2ui/host-ui/1.0.0` |
| sec | 13 | `reason-hwang://a2ui/sec/1.0.0` |

모든 props는 JSON으로 표현한다. child/children은 컴포넌트 ID이며 함수·ReactNode·ref는 wire에 없다. Dialog/Select 등의 내부 Trigger·Portal·Content는 조합형 어댑터가 소유한다. 하나의 UI 파일에 있는 모든 하위 export를 독립 생성 대상으로 등록하지 않는다. SEC Button은 SEC 전용 action enum을 사용하며 기존 프로필의 action 허용 목록을 확장하지 않는다.

## 전체 등록 목록

61개 원본 UI 파일 + Row/Column/Text/Metric/InfoRow = 66개 어댑터. 원본 열의 파일은 `1-fe-host/src/components/ui/` 기준이다.

| 컴포넌트 | 원본 | 역할 |
| --- | --- | --- |
| Accordion | accordion.tsx | Expandable titled sections; adapter owns triggers and content. |
| Alert | alert.tsx | An inline notice with a heading and description. |
| AlertDialog | alert-dialog.tsx | Explicit confirmation dialog. Confirmation dispatches the declared action. |
| AspectRatio | aspect-ratio.tsx | Keeps its child at a fixed aspect ratio. |
| Attachment | attachment.tsx | Displays file name and description; no upload or filesystem access. |
| Avatar | avatar.tsx | Initials avatar with an accessible name. |
| Badge | badge.tsx | A short status label. |
| Breadcrumb | breadcrumb.tsx | A non-navigating location trail. |
| Bubble | bubble.tsx | A conversation bubble. |
| Button | button.tsx | An action button. Use disabled when no workflow is available. |
| ButtonGroup | button-group.tsx | A group of independently declared action buttons. |
| Calendar | calendar.tsx | Select one date. Value uses YYYY-MM-DD, empty string means no selection. |
| Card | card.tsx | Titled content card containing one child. |
| Carousel | carousel.tsx | Navigable slides with previous and next controls. |
| Chart | chart.tsx | Bar or pie chart of numeric data. Data can be an inline series or a data-model path to a series. |
| Checkbox | checkbox.tsx | Boolean selection written to its bound data model path. |
| Collapsible | collapsible.tsx | Show or hide a content section. |
| Column | A2UI 전용 | Vertical layout of component IDs. |
| Combobox | combobox.tsx | Searchable single-value selection. |
| Command | command.tsx | Searchable command list; selected command is dispatched as context.value. |
| ContextMenu | context-menu.tsx | Context menu opened by right click or keyboard. |
| Dialog | dialog.tsx | Modal dialog with composed trigger, accessible title, description and close control. |
| Direction | direction.tsx | Apply text direction to a child tree. |
| Drawer | drawer.tsx | A drawer with an accessible trigger and title. |
| DropdownMenu | dropdown-menu.tsx | A dropdown menu of commands. |
| Empty | empty.tsx | An empty-state explanation. |
| Field | field.tsx | A labeled input field with optional help text. |
| HoverCard | hover-card.tsx | A preview card shown on hover or focus. |
| InfoRow | A2UI 전용 | Compact label and value pair. |
| Input | input.tsx | Single-line input. Bind value to a data path to submit the current value. |
| InputGroup | input-group.tsx | Input with prefix text and optional submit action. |
| InputOtp | input-otp.tsx | One-time code entry, a presentation demo only. |
| Item | item.tsx | A titled list item with supporting text. |
| Kbd | kbd.tsx | Display a keyboard shortcut. |
| Label | label.tsx | A standalone text label. |
| Marker | marker.tsx | Compact contextual marker. |
| Menubar | menubar.tsx | A menu bar containing commands. |
| Message | message.tsx | A message with author and body. |
| MessageScroller | message-scroller.tsx | Scrollable messages with a scroll-to-end control. |
| Metric | A2UI 전용 | Numeric KPI display with a label. |
| NativeSelect | native-select.tsx | Native HTML single selection. |
| NavigationMenu | navigation-menu.tsx | Navigation choices restricted to local A2UI pages. |
| Pagination | pagination.tsx | Select a page locally; value is a one-based page number. |
| Popover | popover.tsx | An anchored interactive popover. |
| Progress | progress.tsx | Progress from zero to 100. |
| Questionnaire | questionnaire.tsx | A composed multi-step choice form. Submit dispatches demo_submit with answers. |
| RadioGroup | radio-group.tsx | Single selection presented as radio buttons. |
| Resizable | resizable.tsx | Two resizable panels. Children remain within this surface. |
| Row | A2UI 전용 | Horizontal wrapping layout of component IDs. |
| ScrollArea | scroll-area.tsx | Scrollable bounded content. |
| Select | select.tsx | Single selection with an accessible composed popup. |
| Separator | separator.tsx | Visual divider. |
| Sheet | sheet.tsx | Side sheet with trigger and accessible heading. |
| Sidebar | sidebar.tsx | An isolated in-surface sidebar; never replaces the application navigation. |
| Skeleton | skeleton.tsx | Loading placeholder with explicit dimensions. |
| Slider | slider.tsx | A numeric input written to the data model. |
| Spinner | spinner.tsx | A loading indicator with descriptive text. |
| Switch | switch.tsx | Boolean switch written to the data model. |
| Table | table.tsx | A data table; rows can be inline or a data-model path. Column keys select row fields. |
| Tabs | tabs.tsx | Locally selectable titled panels. |
| Text | A2UI 전용 | Plain text, never HTML. |
| Textarea | textarea.tsx | Multi-line bound text input. |
| Toast | toast.tsx | Explicitly triggered notification; rerendering never creates a notification. |
| Toggle | toggle.tsx | Toggle button with a boolean data binding. |
| ToggleGroup | toggle-group.tsx | Single-selection toggle group. |
| Tooltip | tooltip.tsx | Help text shown on hover or keyboard focus. |

## 확장 절차

1. 기존 UI 파일을 재사용하는 JSON props를 definitions에 정의한다.
2. 적절한 `*-adapters.tsx`에 렌더·입력 쓰기·action 연결을 구현한다.
3. catalog 등록, fixture 및 A2UI 경유 story를 추가한다.
4. 필요한 하위 프로필에만 추가하고 정적 계약을 재생성한다.
5. 공식 프로토콜/Zod 수용·거절 검사, Storybook, 영향받는 action API·브라우저 검증을 순차 수행한다.
6. 호환성이 깨지는 경우 catalogVersion/ID와 소비자 배포를 함께 갱신한다. 단순히 검사를 끄거나 해시만 수동 교체하지 않는다.

## 설치 버전과 계약 해시

| 계층 | 패키지 | 고정 버전 |
| --- | --- | --- |
| javascript | `@a2ui/web_core` | 0.10.4 |
| javascript | `@ag-ui/a2ui-middleware` | 0.0.10 |
| javascript | `@ag-ui/client` | 0.0.59 |
| javascript | `@copilotkit/a2ui-renderer` | 1.73.0 |
| javascript | `@copilotkit/react-core` | 1.73.0 |
| javascript | `@copilotkit/runtime` | 1.73.0 |
| javascript | `zod` | 3.25.76 |
| python | `ag-ui-a2ui-toolkit` | 0.0.4 |
| python | `ag-ui-langgraph` | 0.0.45 |
| python | `ag-ui-protocol` | 1.0.0 |
| python | `copilotkit` | 0.1.96 |
| python | `langchain` | 1.4.2 |
| python | `langgraph` | 1.2.11 |

wire는 `v0.9`, JSON Schema는 Draft2020-12, 카탈로그 버전은 `1.0.0`다. 공식 규격 commit은 `2d2a714dafd22590e705c32a47cd5390ab96fdc5`이며 `assets/a2ui/specification/v0_9`에 고정한다.

| 프로필 | SHA-256 |
| --- | --- |
| dynamic | `cf11181fe88bace6520d0fe7987ccb609a435b6f1c6ce30f853128695084a6a7` |
| fixed | `4a7eb083b137257d66bf030a8c26d20a313c536f0eb955308f144ca89531aff2` |
| host | `7ddf17aea2bcbe8d36475d26a5d41c25a14c10e56dbf3d19fa338729a267f921` |
| sec | `55e5a1866347d2ae9c3bbdf43cfb8b28669e3f6bababda3a2c85f5f7a9ca9ded` |
