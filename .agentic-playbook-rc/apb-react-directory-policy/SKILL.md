---
name: apb-react-directory-policy
phase: gradate
description: |
  Guide for the canonical React `src/` directory layout. Explains the
  13 allowed top-level directories, each one's role and responsibility,
  and the `elements` vs `widget` distinction.
  Phases: Guide.
  Triggers: react directory, react structure, folder policy,
  리액트 디렉토리, 리액트 폴더 구조, React ディレクトリ, React 目录结构,
  estructura react, structure react, React Ordnerstruktur
  Do NOT use for: non-React projects (use language-specific skills),
  component-level code review (use $code-review),
  build tool configuration (edit vite/webpack config directly).
---

# React Directory Policy

> Canonical top-level layout under `src/`:
> `apis, log, constants, context, elements, experiment, hooks, i18n,
> layout, store, styles, utils, widget`.

## Usage

```
$apb-react-directory-policy guide    Explain the directory layout and each dir's role/responsibility (DEFAULT)
```

**Default action:** When invoked with no arguments
(`$apb-react-directory-policy`), run `guide`.

## Phase Flow

```
[Guide]
```

## Phase Progress Visualization

```
[Guide]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Guide

Explain the canonical directory layout and each directory's role and
responsibility. This is the **default action** when the skill is
invoked with no arguments.

### Prerequisites

- None. This phase is read-only and requires no project path.

### Steps

1. Print the `Canonical Layout` tree (the 13 top-level directories
   under `src/` with inline comments).
2. Print the `Directory Responsibilities` table (what each dir
   `Contains` and `Must NOT contain`).
3. Print the `elements vs widget` section verbatim:
   - Definition of `elements/` (reusable UI, no business logic).
   - Definition of `widget/` (finished, business-aware output).
   - The 4-step Decision rubric.
   - The Pairing pattern example.
4. Do not read or write any files.

### Output Path

```
Console output only (no files written, no repo access).
```

---

## Canonical Layout

Exactly these 13 directories are allowed at `src/` level. No other
top-level directories are permitted.

```
src/
├── apis/          # HTTP clients, request/response types, API adapters
├── log/           # logger setup, log sinks, telemetry helpers
├── constants/     # app-wide constants, enums, config keys
├── context/       # React Context providers and consumers
├── elements/      # reusable UI components with NO business logic (pure presentational)
├── experiment/    # A/B test flags, experiment wrappers
├── hooks/         # reusable custom hooks
├── i18n/          # translation resources, locale helpers
├── layout/        # page shells, header/footer/sidebar compositions
├── store/         # global state (redux/zustand/jotai) slices and selectors
├── styles/        # global CSS, theme tokens, mixins
├── utils/         # framework-agnostic pure helpers
└── widget/        # finished, business-aware output composed with business logic
```

### Directory Responsibilities

| Dir | Contains | Must NOT contain |
|---|---|---|
| `apis` | fetchers, DTOs, API clients | UI, React components |
| `log` | logger instance, transports | business logic |
| `constants` | primitives, enums | functions with side effects |
| `context` | `*.Context.tsx`, providers | pure utils |
| `elements` | stateless presentational components | API calls, store access |
| `experiment` | experiment configs, guards | UI primitives |
| `hooks` | `use*.ts` reusable hooks | components, JSX-only files |
| `i18n` | locale JSON, `t()` wrappers | components |
| `layout` | page-level compositions | element-level primitives |
| `store` | slices, selectors, middleware | React components |
| `styles` | global CSS, tokens, themes | TS logic |
| `utils` | pure functions | React imports, side effects |
| `widget` | business components composing elements/hooks/store | primitive-only components (belongs in `elements`) |

### `elements` vs `widget` (most important rule)

This is the single most common source of misplacement. Use these
definitions as the tie-breaker.

**`elements/` — reusable UI, NO business logic**

- Pure presentational. Renders whatever props it receives.
- Reusable across any feature / page / product.
- Does NOT know about domain concepts (user, campaign, order, ...).
- Does NOT call APIs, does NOT read from `store/`, does NOT read from
  `context/` that carries business state.
- Styling + interaction + a11y only.
- Examples: `Button`, `Input`, `Modal`, `Tooltip`, `Badge`, `Spinner`,
  `Tabs`, `Dropdown`, `Skeleton`.

**`widget/` — finished, business-aware output**

- A "completed" UI unit that a page can drop in and it just works.
- Composes `elements/` + `hooks/` + `store/` + `apis/` to deliver a
  domain feature end-to-end.
- Knows about domain concepts and owns its own data fetching / state
  wiring when appropriate.
- Typically NOT reusable outside its business context.
- Examples: `CampaignCreateForm`, `OrderSummaryCard`, `UserProfileHeader`,
  `DashboardKpiPanel`, `CheckoutButton` (the one that actually submits
  an order, not the generic `Button`).

**Decision rubric**

Ask in this order:

1. Does the component import from `apis/`, `store/`, or a
   business-state `context/`? -> **widget**
2. Does the component reference a domain noun in its name or props
   (e.g. `campaign`, `user`, `order`)? -> **widget**
3. Could you ship this component to a completely different product
   without changes? -> **elements**
4. Otherwise, default to **elements** and extract business wiring into
   a wrapping widget when needed.

**Pairing pattern**

It is common (and encouraged) to have a matching pair:

```
elements/Button.tsx              # generic, styled button
widget/CheckoutButton.tsx        # wraps <Button>, calls apis/checkout,
                                 # reads store/cart, handles loading/errors
```

## Reference: `tree -L 1` Expected Output

```
src
├── apis
├── log
├── constants
├── context
├── elements
├── experiment
├── hooks
├── i18n
├── layout
├── store
├── styles
├── utils
└── widget
```
