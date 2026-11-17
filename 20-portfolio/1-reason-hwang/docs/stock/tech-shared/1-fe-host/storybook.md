# Host Storybook Design

> Scope: shared frontend UI. Decisions: `UI-STORY-001`, `UI-STORY-002`.

## Purpose and behavior

The host Storybook presents reusable UI components independently of backend services. Default UI stories must show meaningful fixture content or a visible trigger; container components alone are not useful examples. Skeletons and separators require explicit dimensions or a sized parent.

## Implementation

- Stories live in `1-fe-host/src/shared/ui/*.stories.tsx` and use types from the declared `@storybook/nextjs-vite` dependency.
- Compound components include their content, triggers, and required providers. Base UI composition uses `render`, not Radix-style `asChild`.
- Sidebar includes navigation and a toggle. Its Docs example uses an isolated iframe to contain fixed positioning.
- The existing preview imports application `globals.css`; stories use the application theme and Tailwind styles.
- Collapsible, DropdownMenu, Sheet, and Tooltip expose separate Interaction stories with `play` checks. Portal queries use the canvas owner document; assertions wait for transitions. Tooltip checks exercise keyboard focus and Escape.
- Fixtures do not require authentication or API services. Stateful examples update story-local React state only; no data is persisted or sent to a backend.
- `UI-STORY-002`: the original 19 UI component files provide the initial rich-story collection spanning variants, sizes, content, empty/loading/error/disabled states, and composed application examples. Existing Default story IDs remain stable.
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

Evidence: [2026-09-20 rendering correction](../../../flow/2026-09-20-storybook-rendering.md).

## Example coverage

| Family | Examples |
| --- | --- |
| Button / Badge / Avatar | variants, sizes, icons, loading/disabled, workflow status, team, image fallback |
| Input / Textarea | filled, invalid, disabled, read-only, password, search, long text, composer |
| Card / Skeleton / Separator | project overview, metrics, empty/loading, content placeholders, horizontal/vertical sections |
| Bubble / Message / MessageScroller | conversation, reactions, long content, attachments, errors, generation, scrolling, empty/compact/add-message |
| Attachment / Marker / Breadcrumb | upload lifecycle, sizes, file collection, long filenames, activity timeline, collapsed/long paths |
| Collapsible / DropdownMenu / Sheet / Tooltip / Sidebar | FAQ/files, menu groups/submenus/preferences, placements/edit form, toolbar help, workspace layouts |

Expansion evidence: [2026-09-20 rich examples](../../../flow/2026-09-20-storybook-rich-examples.md).

## Installed component catalog

See [shadcn UI catalog](ui-catalog.md) for the preinstalled components, dependency requirements, and entries that are composition guides. `UI-STORY-003` adds individual stories for all 42 newly installed components, completing coverage for all 61 standalone files. Data Table, Date Picker, and Typography have composed examples under `src/stories/`. The built index now contains 192 UI cases and 201 total stories. Twenty new interaction stories verify visible state changes; calendar, chart, menu, form, layout, and overlay examples cover representative states. Vitest prebundles catalog dependencies so cold discovery does not reload browser-test iframes.

The `Installation/Registry smoke check` remains as an installation-level check. Evidence: [2026-09-20 catalog stories](../../../flow/2026-09-20-shadcn-catalog-stories.md).

## OPENUI-FIN-STORY-002: Lib Story 금융 v2 예제

앱 내부 `/open-ui/catalog`의 OpenUI Lib Story와 개발용 Storybook은 별도 목록이다. Lib Story는 기존 금융 조합 5개에 v2 SMA 다중 설정, BBANDS·PSAR, 준비 구간·부분 오류 예제와 `IndicatorControls`를 추가해 총 9개 금융 예제를 제공한다. 금융 항목은 기본 components와 분리한 `financial · 금융` 탭에 표시한다. 기존 FinancialChart 기본 예제를 포함해 총 10개이며, 탭 내부는 금융 컴포넌트(FinancialChart·IndicatorControls)와 금융 차트 쇼케이스로 묶는다. 기존 hash 링크는 유지하며 해당 금융 탭을 자동으로 연다. 검색은 이름·설명·signature·id를 포함하므로 `financial`로 금융 예제를 찾을 수 있다.

모든 시세·지표 수치는 표시 검증용 가상 값이다. 지표 설정 예제는 SMA만 포함한 축소 가상 catalog를 사용하고 추가·복제·제거·기간 편집·초안 적용을 로컬 상태에서 실행한다. 서버 조회와 지표 계산은 수행하지 않는다. 실제 20개 지표 catalog 및 Query 계약은 [OpenUI 설계](open-ui.md#ta-indicators-002-20개-지표와-다중-인스턴스)를 따른다.

`Generative UI/Catalog`의 `FinancialV2Showcases` story는 다중 설정·밴드·PSAR·부분 오류 렌더링, 검색에서의 발견, 지표 초안과 적용 상태를 검증한다. [변경·검증 기록](../../../flow/2026-11-17-openui-financial-lib-stories.md).
