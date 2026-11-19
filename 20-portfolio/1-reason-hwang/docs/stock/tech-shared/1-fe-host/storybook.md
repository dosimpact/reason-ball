# Host Storybook Design

> Scope: shared frontend UI. Decisions: `UI-STORY-001`, `UI-STORY-002`.

## Purpose and behavior

The host Storybook presents reusable UI components independently of backend services. Default UI stories must show meaningful fixture content or a visible trigger; container components alone are not useful examples. Skeletons and separators require explicit dimensions or a sized parent.

## Implementation

- Stories are colocated with components under `1-fe-host/src/` and use `@storybook/nextjs-vite`. Composed shared examples live in `src/shared/ui/storybook/`.
- Compound components include their content, triggers, and required providers. Base UI composition uses `render`, not Radix-style `asChild`.
- Sidebar includes navigation and a toggle. Its Docs example uses an isolated iframe to contain fixed positioning.
- The existing preview imports application `globals.css`; stories use the application theme and Tailwind styles.
- Collapsible, DropdownMenu, Sheet, and Tooltip expose separate Interaction stories with `play` checks. Portal queries use the canvas owner document; assertions wait for transitions. Tooltip checks exercise keyboard focus and Escape.
- Fixtures do not require authentication or API services. Stateful examples update story-local React state only; no data is persisted or sent to a backend.
- `UI-STORY-002` covers shared component variants, sizes, content, empty/loading/error/disabled states, and composed application examples. Default story IDs are stable.
- `src/shared/ui/storybook/ui-gallery.tsx` provides story-only, labeled comparison galleries. They use two columns on wider screens and one column on narrow screens, with application theme tokens.
- Default stories for Button, Badge, Bubble, Attachment, Avatar, Input, and Textarea expose explicit Controls. Fixed comparison/composition stories disable irrelevant controls.
- Project cards include metadata, empty and skeleton states; messaging examples include conversation alignment, attachments, generation and delivery errors; MessageScroller supports local message insertion and an empty conversation.
- DropdownMenu Preferences, Sheet EditProject, and MessageScroller AddMessage have interaction assertions for visible state changes. Sidebar includes icon/offcanvas collapse and floating/inset layouts with local navigation selection.
- ESLint excludes `storybook-static/**` so a static build does not cause lint to inspect generated bundles.

## Commands and acceptance

Run from `1-reason-hwang`:

```sh
pnpm --filter @reason-hwang/fe-host storybook
pnpm --filter @reason-hwang/fe-host build-storybook
pnpm --filter @reason-hwang/fe-host exec vitest run --project storybook
pnpm --filter @reason-hwang/fe-host typecheck
pnpm --filter @reason-hwang/fe-host lint
```

The development default is port 6006. Validation may use a separate owned port. Follow [VAL-VIEW-001](../../../validation/pure-view.md): verify content and interaction in the browser in addition to build and automated story tests.

## Example coverage

| Family | Examples |
| --- | --- |
| Button / Badge / Avatar | variants, sizes, icons, loading/disabled, workflow status, team, image fallback |
| Input / Textarea | filled, invalid, disabled, read-only, password, search, long text, composer |
| Card / Skeleton / Separator | project overview, metrics, empty/loading, content placeholders, horizontal/vertical sections |
| Bubble / Message / MessageScroller | conversation, reactions, long content, attachments, errors, generation, scrolling, empty/compact/add-message |
| Attachment / Marker / Breadcrumb | upload lifecycle, sizes, file collection, long filenames, activity timeline, collapsed/long paths |
| Collapsible / DropdownMenu / Sheet / Tooltip / Sidebar | FAQ/files, menu groups/submenus/preferences, placements/edit form, toolbar help, workspace layouts |

## Installed component catalog

See the [shadcn UI catalog](ui-catalog.md) for installed components and dependencies. `UI-STORY-003` covers standalone components and composed Data Table, Date Picker, and Typography examples. Vitest prebundles catalog dependencies to avoid iframe reloads during cold discovery.

The `Installation/Registry smoke check` covers registry installation.

## OPENUI-FIN-STORY-002: Lib Story 금융 v2 예제

앱 내부 `/open-ui/catalog`의 OpenUI Lib Story와 개발용 Storybook은 별도 목록이다. `financial · 금융` 탭은 가격·거래량·SMA·RSI·MACD 조합, 복수 SMA 설정, BBANDS·PSAR, 준비 구간·부분 오류, 지표 컨트롤과 일반 시리즈 차트를 제공한다. 기존 hash 링크가 해당 금융 탭을 연다. 검색에는 이름·설명·signature·ID가 포함된다.

모든 시세·지표 수치는 표시 검증용 가상 값이다. 지표 설정 예제는 SMA만 포함한 축소 가상 catalog를 사용하고 추가·복제·제거·기간 편집·초안 적용을 로컬 상태에서 실행한다. 서버 조회와 지표 계산은 수행하지 않는다. 실제 20개 지표 catalog 및 Query 계약은 [OpenUI 설계](open-ui.md#ta-indicators-002-20개-지표와-다중-인스턴스)를 따른다.

## OPENUI-FIN-SERIES-001: 일반 시리즈 차트

[일반 금융 시리즈 차트](financial-series-chart.md)는 기존 snapshot 중심 UI와 함께 사용하는 구성형 컴포넌트다. `OpenUI/FinancialSeriesChart`에서 5개 기본 유형, 좌우 축, 마커·가격선, 가격 없는 지표, 오류·빈 상태·테마를 실행한다. 앱 Lib Story 금융 탭도 기본 차트 유형 / 축·마커·기준선 / 시리즈 조합으로 나누며 범용 컴포넌트 항목과 예제를 제공한다.
