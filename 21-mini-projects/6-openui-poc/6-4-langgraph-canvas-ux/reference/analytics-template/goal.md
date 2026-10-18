# DnD Canvas UX 분석  

## 

  1. Tambo가 AI tools와 Graph component를 알고 있음
  2. AI가 필요하면 데이터 tool을 호출하고 Graph props를 생성
  3. Graph는 chat message 안에 먼저 렌더링
  4. 사용자가 버튼 또는 drag-drop으로 canvas에 저장
  5. canvas 상태는 Zustand + localStorage에 저장
  6. canvas 내부 정렬/이동은 @dnd-kit과 HTML5 drag/drop을 섞어서 처리
  7. 숨겨진 interactable을 통해 AI가 canvas tab과 기존 chart metadata를 일부 편집 가능

--- 
  1. AI chat이 차트를 만들 수 있게 등록
  src/lib/tambo.ts에서 Tambo에 두 가지를 등록합니다.

  - tools: AI가 호출할 수 있는 데이터 함수
      - getSalesData, getProducts, getUserData, getKPIs
  - components: AI가 렌더링할 수 있는 UI
      - Graph, SelectForm

  Graph 설명에 중요한 지시가 들어 있습니다. “차트는 먼저 chat 안에 생성하고, canvas/dashboard에 바로 넣지 말라. 
  사용자가 추가할지 결정하게 하라”는 정책입니다.

  1. AI가 Graph 컴포넌트를 chat message 안에 렌더링
  src/components/tambo/message.tsx의 MessageRenderedComponentArea가 assistant message 안의 Tambo component block을 읽
  습니다.

  여기서:

  - getComponentBlocks(message)로 AI가 생성한 컴포넌트 block 추출
  - extractComponentInfo()로 컴포넌트 이름과 props 추출
  - Graph일 경우 data, title, showLegend, variant, size, className만 정규화
  - isDraggableComponent()는 현재 Graph만 draggable 허용

  즉 AI가 만든 차트는 Tambo message content 안에 Graph component block으로 들어오고, UI에서는 이걸 “드래그 가능한 차
  트” 또는 “Add to dashboard” 버튼으로 노출합니다.

  3. Graph 실제 렌더링
  src/components/tambo/graph.tsx가 차트 렌더러입니다.

  - graphSchema로 AI가 넘겨야 하는 props 구조를 제한합니다.
  - 지원 타입은 bar, line, pie
  - 내부 렌더링은 Recharts 사용
  - 데이터 구조는 대략 아래 형태입니다.

  {
    title: string,
    data: {
      type: "bar" | "line" | "pie",
      labels: string[],
      datasets: [
        {
          label: string,
          data: number[],
          color?: string
        }
      ]
    }
  }

  렌더링 전에 데이터 유효성도 체크합니다. 데이터가 없거나 불완전하면 Awaiting data..., Building chart..., Preparing
  datasets... 같은 fallback UI를 보여줍니다.

  4. Chat에서 Canvas로 저장하는 방식
  저장 경로는 두 가지입니다.

  첫 번째는 버튼 방식입니다.
  message.tsx의 addToDashboard()가 현재 active canvas를 찾고, 없으면 새 canvas를 만든 뒤
  useCanvasStore.addComponent()를 호출합니다.

  두 번째는 drag-drop 방식입니다.
  chat 안의 Graph wrapper에 draggable={true}가 붙고, onDragStart에서 dataTransfer에 JSON을 심습니다.

  {
    component: "Graph",
    props: {
      ...componentProps,
      componentId,
      _inCanvas: false,
      _componentType: "Graph"
    }
  }

  Canvas 쪽에서는 src/components/ui/components-canvas.tsx의 handleDrop()이 이 JSON을 읽어서 active canvas에 추가합니
  다.

  5. Canvas 저장소
  src/lib/canvas-storage.ts가 Zustand store입니다. persist middleware로 localStorage에 저장합니다.

  저장 key는:

  tambo-canvas-storage

  상태 구조는 대략:

  {
    canvases: [
      {
        id,
        name,
        components: [
          {
            componentId,
            _componentType: "Graph",
            _inCanvas: true,
            canvasId,
            ...graphProps
          }
        ]
      }
    ],
    activeCanvasId
  }

  주요 액션은:

  - createCanvas
  - updateCanvas
  - removeCanvas
  - setActiveCanvas
  - clearCanvas
  - addComponent
  - updateComponent
  - removeComponent
  - moveComponent
  - reorderComponent
  - reorderCanvas

  즉 canvas는 서버 저장이 아니라 브라우저 localStorage 기반입니다.

  6. Canvas UI와 드래그 정렬
  src/components/ui/components-canvas.tsx가 실제 canvas 화면입니다.

  여기서 처리하는 것들:

  - 첫 진입 시 기본 canvas 생성
  - canvas tab 생성/이름 변경/삭제
  - active canvas 전환
  - canvas 비우기
  - 외부 chat chart drop 받아서 addComponent
  - canvas 간 component 이동
  - canvas 내부 component 순서 변경

  내부 정렬은 @dnd-kit을 사용합니다.

  - DndContext
  - SortableContext
  - useSortable
  - verticalListSortingStrategy

  같은 canvas 안에서 순서를 바꾸면 reorderComponent()가 호출됩니다. 다른 canvas로 옮기는 경우에는 HTML5 dataTransfer
  기반 drop에서 moveComponent()를 호출합니다.

  7. AI가 기존 Canvas 상태를 읽고 일부 편집 가능
  src/components/ui/interactable-tabs.tsx와 src/components/ui/interactable-canvas-details.tsx는 숨겨진 Tambo
  interactable입니다.

  역할은:

  - InteractableTabs
      - canvas tab 목록, 이름, activeCanvasId를 AI 쪽에 노출
      - AI가 tab 이름/순서/active canvas를 조정 가능

  - InteractableCanvasDetails
      - active canvas 안의 Graph 목록만 노출
      - AI가 기존 chart의 title, type만 수정 가능
      - 새 chart 생성용이 아니라 기존 canvas chart 편집용

  중요한 제한도 description에 명시되어 있습니다. 새 차트는 CanvasDetails로 만들지 말고, 먼저 chat에 Graph로 생성한 뒤
  사용자가 canvas에 추가하게 되어 있습니다.

  정리하면, 이 라이브러리의 핵심 로직은:




## QnA  


### 