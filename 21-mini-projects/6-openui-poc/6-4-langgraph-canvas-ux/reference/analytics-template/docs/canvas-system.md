# Dynamic Canvas System  

- [Dynamic Canvas System](#dynamic-canvas-system)
  - [Canvas State](#canvas-state)
  - [Canvas Command](#canvas-command)
  - [Canvas Renderer](#canvas-renderer)
  - [Canvas Item Grid System](#canvas-item-grid-system)
  - [Canvas Item resize](#canvas-item-resize)
  - [Drag Drop Layer](#drag-drop-layer)
    - [Drag Payload](#drag-payload)
    - [Drop Handling](#drop-handling)
    - [DnD Responsibilities](#dnd-responsibilities)
    - [Validation Rules](#validation-rules)
  - [새 renderer를 추가할 때 권장 구조](#새-renderer를-추가할-때-권장-구조)
  - [Tool Payload 정의 및 로직 부분](#tool-payload-정의-및-로직-부분)


## Canvas State

>참조 : src/lib/canvas-storage.ts

Canvas state는 dashboard/canvas tab 목록, 각 canvas에 들어간 item 순서, item 상세 데이터, 현재 선택된 canvas를 관리합니다.

권장 구조는 canvas와 item을 분리하는 방식입니다.

```ts
type CanvasState = {
  canvases: Array<{
    id: string;
    name: string;
    itemIds: string[];
  }>;
  itemsById: Record<string, CanvasItem>;
  activeCanvasId: string | null;
};
```

각 필드의 역할은 다음과 같습니다.

| Field | Role |
| --- | --- |
| `canvases` | canvas tab 목록입니다. 각 canvas는 이름과 내부 item 순서만 가집니다. |
| `canvases[].itemIds` | 해당 canvas 안에 배치된 item/chart의 순서입니다. |
| `itemsById` | 실제 chart/item 데이터를 `id` 기준으로 저장합니다. |
| `activeCanvasId` | 현재 사용자가 보고 있거나 편집 중인 canvas id입니다. |

이 구조에서는 canvas가 item 데이터를 직접 소유하지 않고 `itemIds`만 가집니다. 그래서 chart 수정, 삭제, 이동, 정렬을 할 때 중복 데이터를 찾아서 갱신할 필요가 줄어듭니다.

```ts
type ChartArtifact = {
  kind: "chart";
  id: string;
  title: string;
  chartType: "bar" | "line" | "pie";
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>;
  };
  display?: {
    showLegend?: boolean;
    size?: "sm" | "md" | "lg";
  };
  source?: {
    messageId?: string;
    runId?: string;
    toolCallId?: string;
  };
};

type CanvasItem =
  | {
      id: string;
      kind: "chart";
      canvasId: string;
      artifact: ChartArtifact;
      layout?: {
        width?: number;
        height?: number;
      };
      createdAt: string;
      updatedAt: string;
    };
```




## Canvas Command  

Canvas 상태를 바꾸기 위한 명령 목록  

```ts
  type CanvasCommand =
    | { type: "createCanvas"; name?: string }
    | { type: "renameCanvas"; canvasId: string; name: string }
    | { type: "removeCanvas"; canvasId: string }
    | { type: "setActiveCanvas"; canvasId: string | null }
    | { type: "reorderCanvas"; canvasId: string; index: number }
    | { type: "addChart"; canvasId: string; artifact: ChartArtifact }
    | { type: "updateChart"; itemId: string; patch: Partial<ChartArtifact> }
    | { type: "removeItem"; itemId: string }
    | { type: "moveItem"; itemId: string; targetCanvasId: string; index?: number }
    | { type: "reorderItem"; canvasId: string; itemId: string; index: number };
```



상태 변경은 `CanvasCommand`로 표현합니다.

| Command | State change |
| --- | --- |
| `createCanvas` | 새 canvas를 `canvases`에 추가하고 필요하면 active canvas로 설정합니다. |
| `renameCanvas` | `canvasId`에 해당하는 canvas의 `name`을 변경합니다. |
| `removeCanvas` | canvas를 삭제하고, 그 canvas의 `itemIds`에 연결된 item도 정리합니다. |
| `setActiveCanvas` | `activeCanvasId`를 지정한 canvas id 또는 `null`로 변경합니다. |
| `reorderCanvas` | `canvases` 배열에서 특정 canvas tab의 위치를 변경합니다. |
| `addChart` | `artifact`를 `itemsById`에 추가하고 대상 canvas의 `itemIds`에 item id를 넣습니다. |
| `updateChart` | `itemsById[itemId]`의 chart 데이터를 `patch`로 부분 업데이트합니다. |
| `removeItem` | `itemsById`에서 item을 삭제하고 모든 canvas의 `itemIds`에서 해당 id를 제거합니다. |
| `moveItem` | item id를 기존 canvas의 `itemIds`에서 제거하고 target canvas의 `itemIds`에 삽입합니다. |
| `reorderItem` | 같은 canvas 안에서 `itemIds` 순서를 변경합니다. |

핵심은 UI, drag/drop, AI patch가 store를 직접 수정하지 않고 같은 command path를 사용하게 만드는 것입니다. 이렇게 하면 canvas 동작의 business rule이 `applyCanvasCommand(command)` 한 곳에 모입니다.

```text
UI action / AI patch / Drag and drop
  -> CanvasCommand
  -> applyCanvasCommand(command)
  -> CanvasState update
  -> Persistence
```

## Canvas Renderer
예를 들어 ChartArtifact가 이렇게 있으면:

```ts
  const artifact: ChartArtifact = {
    kind: "chart",
    id: "chart-1",
    title: "Monthly Sales",
    chartType: "bar",
    data: {
      labels: ["Jan", "Feb", "Mar"],
      datasets: [
        {
          label: "Sales",
          data: [100, 200, 300],
          color: "#3b82f6"
        }
      ]
    },
    display: {
      showLegend: true,
      size: "md"
    }
  };
```

## Canvas Item Grid System

canvas item은 자유 픽셀 좌표가 아니라 grid unit으로 배치합니다. 핵심은 각 item이 `layout.w`, `layout.h`를 가지고, canvas renderer가 이를 CSS grid의 column/row span으로 변환하는 것입니다.

현재 구현의 grid 상수는 다음과 같습니다.

```ts
export const CANVAS_GRID_COLUMNS = 12;
export const CANVAS_GRID_GAP = 16;
export const CANVAS_GRID_ROW_HEIGHT = 32;
export const CANVAS_GRID_MIN_W = 3;
export const CANVAS_GRID_MIN_H = 4;
export const CANVAS_GRID_MAX_W = CANVAS_GRID_COLUMNS;
export const CANVAS_GRID_MAX_H = 18;
```

각 canvas component는 layout을 가집니다.

```ts
type CanvasComponentLayout = {
  w: number; // grid column span
  h: number; // grid row span
};

type CanvasComponent = {
  componentId: string;
  _componentType: string;
  canvasId?: string;
  layout?: CanvasComponentLayout;
};
```

새 item이 canvas에 들어올 때 layout이 없으면 component type별 기본값을 부여합니다.

```ts
function getDefaultCanvasLayout(componentType: string): CanvasComponentLayout {
  if (componentType === "Markdown") {
    return { w: 4, h: 6 };
  }

  return { w: 6, h: 8 };
}
```

layout은 항상 clamp합니다. 이렇게 해야 item이 12-column grid 밖으로 커지거나 너무 작아지는 것을 막을 수 있습니다.

```ts
function clampCanvasLayout(
  layout: Partial<CanvasComponentLayout> | undefined,
): CanvasComponentLayout {
  return {
    w: Math.max(3, Math.min(12, Math.round(layout?.w ?? 6))),
    h: Math.max(4, Math.min(18, Math.round(layout?.h ?? 8))),
  };
}
```

canvas renderer는 grid container를 다음처럼 구성합니다.

```tsx
<div
  className="grid auto-rows-[32px] gap-4"
  style={{
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  }}
>
  {components.map((component) => (
    <CanvasItem component={component} />
  ))}
</div>
```

각 item은 자기 layout을 CSS grid span으로 변환합니다.

```tsx
const layout = clampCanvasLayout(component.layout);

const style = {
  gridColumn: `span ${layout.w} / span ${layout.w}`,
  gridRow: `span ${layout.h} / span ${layout.h}`,
};
```

이 구조는 Grafana dashboard와 비슷하게 item 크기를 grid 단위로 관리합니다. item의 실제 pixel width/height를 state에 저장하지 않고, `w/h` grid unit만 저장하는 것이 핵심입니다.

## Canvas Item resize  

resize는 자유 픽셀 값으로 저장하지 않습니다. pointer movement를 grid unit delta로 변환하고, 최종 결과를 `layout.w`, `layout.h`로 저장합니다.

resize 시작 시점에 필요한 값은 다음입니다.

```ts
const startX = event.clientX;
const startY = event.clientY;
const startLayout = clampCanvasLayout(component.layout);
const gridWidth = gridElement.clientWidth;
```

grid column 하나의 pixel 크기는 container width와 gap으로 계산합니다.

```ts
function getResizeUnit(containerWidth: number) {
  const columnWidth = (containerWidth - 16 * (12 - 1)) / 12;

  return {
    column: columnWidth + 16,
    row: 32 + 16,
  };
}
```

pointer가 움직이면 pixel delta를 grid unit delta로 바꿉니다.

```ts
const nextLayout = clampCanvasLayout({
  w: startLayout.w + Math.round((event.clientX - startX) / resizeUnit.column),
  h: startLayout.h + Math.round((event.clientY - startY) / resizeUnit.row),
});
```

그리고 store에는 pixel 값이 아니라 grid layout만 저장합니다.

```ts
useCanvasStore.getState().updateComponent(canvasId, componentId, {
  layout: nextLayout,
});
```

resize handle은 item 우하단에 두고, pointer event는 drag/reorder 이벤트로 전파되지 않게 막아야 합니다.

```tsx
<button
  type="button"
  aria-label="Resize canvas item"
  className="cursor-nwse-resize"
  onPointerDown={(event) => {
    event.preventDefault();
    event.stopPropagation();
    startResize(event, component);
  }}
/>
```

정리하면 resize 흐름은 다음과 같습니다.

```text
pointerdown resize handle
  -> 시작 pointer 좌표와 시작 layout 저장
  -> pointermove pixel delta 계산
  -> pixel delta를 grid delta로 변환
  -> clampCanvasLayout()
  -> updateComponent({ layout })
  -> CSS grid span 재렌더링
```

이 방식은 resize 결과가 항상 grid에 snap되므로 사용자가 임의 픽셀 단위로 item을 깨뜨릴 수 없습니다.

## Drag Drop Layer


- 왼쪽 preview의 component props는 canvas component로 들어갈 때 깊은 복사해야 합니다.

Drag drop layer는 pointer interaction을 canvas domain command로 변환하는 얇은 adapter입니다. 이 layer는 chart 데이터를 직접 수정하지 않고, drag source와 drop target을 해석한 뒤 `CanvasCommand`만 만들어야 합니다.

주요 drag/drop 흐름은 세 가지입니다.

| Flow | Source | Target | Command |
| --- | --- | --- | --- |
| Chat chart 추가 | chat preview | canvas | `addChart` |
| Canvas 간 이동 | canvas item | 다른 canvas | `moveItem` |
| Canvas 내부 정렬 | canvas item | 같은 canvas의 새 위치 | `reorderItem` |

### Drag Payload

drag payload는 UI component props가 아니라 app-level data를 담아야 합니다. `_componentType`, `_inCanvas` 같은 UI 내부 플래그는 payload 밖으로 새지 않게 하고, canvas store에는 `ChartArtifact`와 `CanvasItem`만 저장합니다.

```ts
type CanvasDragPayload =
  | {
      kind: "chart";
      source: "chat";
      artifact: ChartArtifact;
    }
  | {
      kind: "chart";
      source: "canvas";
      itemId: string;
      sourceCanvasId: string;
    };
```

chat에서 생성된 chart를 canvas로 끌어올 때는 아직 canvas item이 아니므로 `artifact`를 payload에 넣습니다.

```ts
const payload: CanvasDragPayload = {
  kind: "chart",
  source: "chat",
  artifact,
};
```

이미 canvas에 있는 item을 이동하거나 정렬할 때는 실제 chart data를 다시 싣지 않고 `itemId`와 `sourceCanvasId`만 전달합니다.

```ts
const payload: CanvasDragPayload = {
  kind: "chart",
  source: "canvas",
  itemId,
  sourceCanvasId,
};
```

### Drop Handling

drop handler는 payload와 target 정보를 보고 command를 결정합니다.

```ts
type CanvasDropTarget = {
  canvasId: string;
  index?: number;
};

function toCanvasCommand(
  payload: CanvasDragPayload,
  target: CanvasDropTarget,
): CanvasCommand {
  if (payload.source === "chat") {
    return {
      type: "addChart",
      canvasId: target.canvasId,
      artifact: payload.artifact,
    };
  }

  if (payload.sourceCanvasId !== target.canvasId) {
    return {
      type: "moveItem",
      itemId: payload.itemId,
      targetCanvasId: target.canvasId,
      index: target.index,
    };
  }

  return {
    type: "reorderItem",
    canvasId: target.canvasId,
    itemId: payload.itemId,
    index: target.index ?? 0,
  };
}
```

그 다음 실제 state 변경은 drag/drop handler가 아니라 command 처리기가 담당합니다.

```text
onDrop
  -> parse CanvasDragPayload
  -> resolve CanvasDropTarget
  -> toCanvasCommand(payload, target)
  -> applyCanvasCommand(command)
```

### DnD Responsibilities

`@dnd-kit`은 같은 canvas 안에서 item 순서를 바꾸는 interaction에 적합합니다. 이 경우 drag start/end에서 source index와 target index를 계산하고 `reorderItem` command로 변환합니다.

HTML5 `dataTransfer`는 chat preview에서 canvas로 넘어오는 외부 drag에 적합합니다. chat 영역과 canvas 영역이 서로 다른 component tree에 있거나, native drag payload가 필요할 때 사용합니다.

권장 책임 분리는 다음과 같습니다.

| Layer | Responsibility |
| --- | --- |
| Chat preview | `ChartArtifact`를 drag payload로 serialize |
| Drop zone | payload parse, target canvas/index 계산 |
| DnD adapter | drag/drop event를 `CanvasCommand`로 변환 |
| Canvas command handler | state update와 validation 수행 |
| Canvas renderer | `CanvasState`를 읽어 실제 UI 렌더링 |

### Validation Rules

drop 처리 전에는 최소한 다음을 검증해야 합니다.

- payload가 JSON으로 parse 가능한지 확인합니다.
- `payload.kind === "chart"`인지 확인합니다.
- chat source라면 `artifact.kind === "chart"`이고 chart data가 유효한지 확인합니다.
- canvas source라면 `itemId`가 `itemsById`에 존재하는지 확인합니다.
- target `canvasId`가 존재하는지 확인합니다.
- `index`가 있으면 target canvas의 `itemIds` 범위 안으로 clamp합니다.

이 검증은 drag/drop event handler에 흩어두기보다 `parseCanvasDragPayload()`와 `applyCanvasCommand()`에 나누어 두는 편이 좋습니다.


## 새 renderer를 추가할 때 권장 구조

권장 파일 구조는 다음과 같습니다.

```text
src/study/
  <renderer-name>/
    <renderer-name>-renderer.tsx
  renderers/
    component-registry.tsx
  bridge/
    canvas-bridge.ts
  demo/
    sample-artifacts.ts
```

- renderer가 `chart`, `markdown` 외에 추가될 때는 canvas 본체가 새 renderer의 세부 구현을 직접 알지 않도록 해야 합니다. 
- 새 renderer는 독립 폴더에 구현하고, canvas는 registry를 통해 `_componentType`에 맞는 renderer를 선택하는 구조를 유지합니다.



예를 들어 `Table` renderer를 추가한다면 다음 파일을 만듭니다.

```text
src/study/table/
  table-renderer.tsx
```

renderer 파일은 props type과 실제 renderer를 함께 export합니다.

```tsx
export type TableRendererProps = {
  title?: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

export function TableRenderer(props: TableRendererProps) {
  return (
    <section>
      {/* render table */}
    </section>
  );
}
```

그 다음 `component-registry.tsx`에 component type, artifact type, renderer 등록을 추가합니다.

```tsx
import {
  TableRenderer,
  type TableRendererProps,
} from "@/study/table/table-renderer";

export type StudyComponentType = "Graph" | "Markdown" | "Table";

export type StudyComponentArtifact =
  | { component: "Graph"; props: StudyGraphProps }
  | { component: "Markdown"; props: MarkdownRendererProps }
  | { component: "Table"; props: TableRendererProps };

const rendererRegistry = {
  Graph: {
    label: "Chart",
    render: (props: StudyGraphProps) => <ChartRenderer {...props} />,
  },
  Markdown: {
    label: "Markdown",
    render: (props: MarkdownRendererProps) => <MarkdownRenderer {...props} />,
  },
  Table: {
    label: "Table",
    render: (props: TableRendererProps) => <TableRenderer {...props} />,
  },
};
```

canvas UI는 renderer별 분기를 추가하지 않습니다. 계속 registry만 사용해야 합니다.

```tsx
const rendered = renderStudyComponent(
  componentProps._componentType,
  getRenderableProps(componentProps),
);
```

즉 새 renderer를 추가할 때 `study-components-canvas.tsx`를 수정해야 한다면 구조가 잘못된 것입니다. canvas는 다음 책임만 가져야 합니다.

```text
_componentType 확인
  -> renderer registry 조회
  -> canvas 전용 metadata 제거
  -> renderer에 props 전달
```

AI bridge도 component type별로 snapshot과 patch 정책을 명시해야 합니다.

```ts
type CanvasSnapshotComponent =
  | {
      id: string;
      componentType: "Graph";
      title: string;
      chartType: "bar" | "line" | "pie";
      order: number;
    }
  | {
      id: string;
      componentType: "Markdown";
      title: string;
      contentPreview: string;
      order: number;
    }
  | {
      id: string;
      componentType: "Table";
      title: string;
      columnCount: number;
      rowCount: number;
      order: number;
    };
```

patch schema도 `componentType`을 discriminant로 사용합니다.

```ts
const tablePatchSchema = z.object({
  componentType: z.literal("Table"),
  id: z.string().min(1),
  title: z.string().optional(),
  rows: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
});

const canvasPatchSchema = z.object({
  components: z.array(
    z.discriminatedUnion("componentType", [
      graphPatchSchema,
      markdownPatchSchema,
      tablePatchSchema,
    ]),
  ),
});
```

새 renderer 추가 checklist는 다음 순서로 처리합니다.

1. `src/study/<renderer-name>/<renderer-name>-renderer.tsx` 추가
2. `src/study/renderers/component-registry.tsx`에 type과 renderer 등록
3. `src/study/bridge/canvas-bridge.ts`에 snapshot/patch 정책 추가
4. preview 확인이 필요하면 `src/study/demo/sample-artifacts.ts`에 sample artifact 추가
5. `study-components-canvas.tsx`는 수정하지 않는지 확인

이 구조를 지키면 `Graph`, `Markdown`, `Table`, `KPI`, `Image`, `Form` 같은 renderer가 늘어나도 canvas는 generic dashboard editor로 유지됩니다.



## Tool Payload 정의 및 로직 부분  

1, Tool Payload는 json으로 정의되고 valid한 스키마가 내려오는것 까지 agent의 몫이다. 
2, messages객체에서 getComponentBlocks (payload)을 추출한다. 아래와 같은 형태 

```js
//  즉 파일이 아니라, message payload 안에 이런 구조가 들어오는 개념입니다.
  {
    component: "Graph",
    props: {
      title: "Monthly Revenue",
      data: {
        type: "bar",
        labels: ["Jan", "Feb", "Mar"],
        datasets: [
          {
            label: "Revenue",
            data: [100, 200, 300]
          }
        ]
      }
    }
  }
```

3, props을 정규화?
```
  if (componentType === "Graph") {
    const { data, title, showLegend, variant, size, className } = rawProps;
    return {
      componentType,
      componentProps: { data, title, showLegend, variant, size, className },
    };
  }
```

4, canvas에 추가할 때는 이 payloadprops를 Zustand store에 저장
