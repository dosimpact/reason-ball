# Demo Gallery — Component Gallery with Download

## Context

The current template system (a drawer of raw HTML strings) doesn't communicate the value of agent-generated UI. We're replacing it with a **gallery of curated, saved conversation outputs** — each item is a snapshot: **1 user message → 1 generated component**. This lets visitors immediately see what the agent produces and interact with real outputs.

Relates to issues #49, #55. Depends on #14/#42 (download/copy-as-code) for the export utilities.

### Gallery items showcase two axes:

**1. Explainers & Visualizations** — Educational/explanatory generated components (e.g. "How a Plane Flies" interactive 3D explainer, binary search step-through, solar system model, neural network forward pass animation). Demonstrates the agent's ability to generate rich, interactive educational content from a simple prompt.

**2. Custom UI & Styled Components** — Generated components matching a specific design language or brand style (e.g. Clippy-style assistant UI, Spotify-inspired music dashboard, invoice card in a specific design system, themed dashboards). Demonstrates that generated UI isn't generic — the agent can produce components that feel intentionally designed.

### Each gallery item includes:
- The original user prompt (1 message)
- The generated component output (rendered, interactive)
- Ability to **download** the generated component (via `export-utils.ts` from #14/#42)

## Layout — Variant-style (reference: variant.com)

**Current:** Chat is the main view. Template drawer slides over from right.

**New:** Inspired by variant.com — a fixed left panel with hero text + chat input, and a scrollable masonry grid of generated components filling the rest of the viewport.

```
+--------------------+--------------------------------------------+
| Logo               |                                            |
|                    |  [Card]     [Card - tall]   [Card]         |
| Endless generated  |  [Card - wide]    [Card]                  |
| UIs for your       |  [Card]     [Card]   [Card - tall]        |
| ideas, just scroll.|  [Card]     [Card - wide]                 |
|                    |  [Card - tall]   [Card]    [Card]          |
| Description text   |            ... infinite scroll ...         |
|                    |                                            |
| [Sign up] [Surprise|                                            |
|  me]               |                                            |
|                    |                                            |
| +----------------+ |                                            |
| | Chat input...  | |                                            |
| +----------------+ |                                            |
+--------------------+--------------------------------------------+
```

### Key layout properties:
- **Left panel** (~340px, fixed): Logo, hero tagline, description, CTAs ("Sign up / Sign in", "Surprise me"), and a chat input pinned to the bottom. This panel does NOT scroll.
- **Right area** (fills remaining width): Masonry grid of gallery cards that scrolls independently. Cards vary in size based on their content aspect ratio.
- **Cards**: Dark themed, rounded corners, show live interactive iframe previews of generated components. Each card has a hover overlay with download button and "Try it" action.
- **No category filter pills**: The masonry grid itself communicates variety. Items from both axes (explainers + styled UI) are interleaved.
- **Chat input**: Lives at the bottom of the left panel (not a separate side panel). Typing a prompt generates a new component that appears in the grid.
- **Dark theme**: The overall page uses a dark background to make the component previews pop.

## Files to Create

### 1. `apps/app/src/components/demo-gallery/gallery-data.ts`
Gallery item definitions. Each item is a conversation snapshot: 1 user prompt → 1 generated component.

**Interface:**
```ts
export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  axis: "explainer" | "styled";  // which showcase axis
  prompt: string;                // the original user message
  html?: string;                 // generated HTML output (for live preview + download)
  component_type?: string;
  component_data?: Record<string, unknown>;
  size?: "normal" | "tall" | "wide";  // masonry size hint
}
```

**Curated items (~10), interleaved from both axes:**

*Explainers & Visualizations:*
- How a Plane Flies — interactive 3D explainer
- Binary Search — step-through visualization
- Solar System — orbiting planets
- Neural Network — animated forward pass
- Sorting Comparison — bubble sort vs quicksort

*Custom UI & Styled Components:*
- Weather Dashboard (reuse seed HTML)
- KPI Dashboard (reuse seed HTML)
- Invoice Card (reuse seed HTML)
- Pomodoro Timer
- Bike Battery Widget (like variant.com reference)

Items with pre-rendered `html` show live iframe previews. Items without show a styled placeholder with the prompt text.

### 2. `apps/app/src/components/demo-gallery/gallery-card.tsx`
Masonry card component. Dark themed, rounded corners.
- Shows live iframe preview (scaled down) of the generated component
- Hover overlay: download button (uses `export-utils.ts`), "Try it" button
- Card `size` prop controls CSS grid span (normal=1x1, tall=1x2, wide=2x1)

### 3. `apps/app/src/components/demo-gallery/index.tsx`
Main gallery layout: fixed left panel + scrollable masonry grid.
- Left panel: logo, hero text, CTAs, chat input at bottom
- Right area: CSS grid masonry of `GalleryCard` components
- No category filters — items from both axes interleaved for variety

## Files to Modify

### 4. `apps/app/src/app/page.tsx`
Major layout restructure:
- Replace current `ExampleLayout` + `CopilotChat` with the new gallery layout
- The gallery component (`demo-gallery/index.tsx`) becomes the full-page view
- Chat input is embedded in the left panel, not a separate component
- "Try it" on a card sends the prompt to the agent and scrolls to / highlights the new output
- "Surprise me" button picks a random prompt from gallery data and sends it

### 5. `apps/app/src/components/template-library/seed-templates.ts`
Keep this file — the HTML strings are reused by `gallery-data.ts` for items that have live previews. Import from here rather than duplicating.

### 6. `apps/app/src/hooks/use-example-suggestions.tsx`
May be replaced or simplified — the gallery itself serves as the suggestion surface now.

## Files to Remove

### 7. `apps/app/src/components/template-library/index.tsx` and `template-card.tsx`
The template drawer is replaced by the gallery. `save-template-overlay.tsx` stays (it serves the in-chat widget interaction and now includes download/copy buttons from #14/#42).

## Dependencies

### Download/export (prerequisite — issues #14/#42)
The gallery cards need download buttons. The `export-utils.ts` module (from the download PR) provides `assembleStandaloneHtml`, `triggerDownload`, and `slugify`. The gallery card hover overlay will import these directly.

### Sending messages programmatically
Need to verify the CopilotKit v2 API for programmatic message sending. Options:
1. `agent.sendMessage(text)` — if available in v2
2. `agent.addMessage({ role: "user", content: text }) + agent.runAgent()`
3. Fallback: programmatically set textarea value and dispatch submit

## Implementation Order

1. **(Prerequisite)** Land download/copy-as-code PR (#14/#42) — provides `export-utils.ts`
2. Create `gallery-data.ts` with curated items from both axes
3. Create `gallery-card.tsx` — dark card with iframe preview + hover overlay
4. Create `demo-gallery/index.tsx` — left panel + masonry grid layout
5. Restructure `page.tsx` — replace current layout with gallery
6. Wire up "Try it" → send prompt to agent
7. Wire up "Surprise me" → random prompt
8. Wire up download button on cards (reuse `export-utils.ts`)
9. Clean up old template drawer files

## Verification

1. `pnpm dev:app` — app builds and renders gallery as default view
2. Gallery shows masonry grid of ~10 cards with live iframe previews
3. Left panel has hero text, CTAs, and chat input
4. Hovering a card shows download + "Try it" overlay
5. Clicking "Try it" sends the prompt and generates a new component
6. Download button produces a standalone `.html` file with working animations
7. "Surprise me" picks a random prompt
8. Dark theme looks clean, cards pop against background
