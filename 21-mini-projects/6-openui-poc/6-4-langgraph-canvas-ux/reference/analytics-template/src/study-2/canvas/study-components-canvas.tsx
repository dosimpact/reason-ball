"use client";

import {
  CANVAS_GRID_COLUMNS,
  CANVAS_GRID_GAP,
  CANVAS_GRID_ROW_HEIGHT,
  CanvasComponent,
  STUDY_CANVAS_STORAGE_KEY,
  clampCanvasLayout,
  useStudyCanvasStore,
} from "@/study/canvas/canvas-storage";
import {
  getRenderableProps,
  getStudyComponentLabel,
  renderStudyComponent,
} from "@/study/renderers/component-registry";
import { cn } from "@/study/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

type CanvasComponentProps = CanvasComponent;

function getTestIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getResizeUnit(containerWidth: number) {
  const columnWidth =
    (containerWidth - CANVAS_GRID_GAP * (CANVAS_GRID_COLUMNS - 1)) /
    CANVAS_GRID_COLUMNS;

  return {
    column: columnWidth + CANVAS_GRID_GAP,
    row: CANVAS_GRID_ROW_HEIGHT + CANVAS_GRID_GAP,
  };
}

export const StudyComponentsCanvas: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className, ...props }) => {
  const {
    canvases,
    activeCanvasId,
    createCanvas,
    updateCanvas,
    removeCanvas,
    setActiveCanvas,
    clearCanvas,
    removeComponent,
    addComponent,
    moveComponent,
  } = useStudyCanvasStore();

  const [editingCanvasId, setEditingCanvasId] = React.useState<string | null>(
    null,
  );
  const [pendingDeleteCanvasId, setPendingDeleteCanvasId] = React.useState<
    string | null
  >(null);
  const [editingName, setEditingName] = React.useState("");
  const gridRef = React.useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  React.useEffect(() => {
    const existingStore = localStorage.getItem(STUDY_CANVAS_STORAGE_KEY);
    const hasExistingCanvases =
      existingStore && JSON.parse(existingStore)?.state?.canvases?.length > 0;

    if (!hasExistingCanvases && canvases.length === 0) {
      createCanvas("New Canvas 1");
    } else if (!activeCanvasId && canvases.length > 0) {
      setActiveCanvas(canvases[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!activeCanvasId) return;

      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      try {
        const parsed = JSON.parse(data);
        if (!parsed.component || !parsed.props) return;

        const componentProps = parsed.props as CanvasComponentProps;
        const isMovingExisting =
          componentProps._inCanvas &&
          componentProps.componentId &&
          componentProps.canvasId;
        const sourceCanvasId = componentProps.canvasId;
        const componentId =
          componentProps.componentId ||
          `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        if (isMovingExisting && sourceCanvasId === activeCanvasId) {
          return;
        }

        if (
          isMovingExisting &&
          sourceCanvasId &&
          sourceCanvasId !== activeCanvasId
        ) {
          moveComponent(sourceCanvasId, activeCanvasId, componentId);
          return;
        }

        addComponent(activeCanvasId, {
          ...componentProps,
          componentId,
          _inCanvas: true,
          _componentType: parsed.component,
        });
      } catch (err) {
        console.error("Invalid drop data", err);
      }
    },
    [activeCanvasId, addComponent, moveComponent],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect =
      e.dataTransfer.effectAllowed === "move" ? "move" : "copy";
  };

  const handleCreateCanvas = React.useCallback(() => {
    createCanvas();
  }, [createCanvas]);

  const startRenameCanvas = React.useCallback(
    (id: string) => {
      const canvas = canvases.find((c) => c.id === id);
      if (!canvas) return;
      setEditingCanvasId(id);
      setEditingName(canvas.name);
      setPendingDeleteCanvasId(null);
    },
    [canvases],
  );

  const saveRenameCanvas = React.useCallback(() => {
    if (!editingCanvasId) return;
    const name = editingName.trim();
    if (name) {
      updateCanvas(editingCanvasId, name);
    }
    setEditingCanvasId(null);
  }, [editingCanvasId, editingName, updateCanvas]);

  const handleDeleteCanvas = React.useCallback(
    (id: string, confirmed = false) => {
      if (confirmed) {
        removeCanvas(id);
        setPendingDeleteCanvasId(null);
      } else {
        setPendingDeleteCanvasId(id);
        setTimeout(() => {
          setPendingDeleteCanvasId((current) =>
            current === id ? null : current,
          );
        }, 10000);
      }
    },
    [removeCanvas],
  );

  const renderComponent = (componentProps: CanvasComponentProps) => {
    const componentType = componentProps._componentType;
    const renderableProps = getRenderableProps(componentProps);
    renderableProps.className = cn(
      typeof renderableProps.className === "string"
        ? renderableProps.className
        : undefined,
      "h-full",
    );
    const rendered = renderStudyComponent(
      componentType,
      renderableProps,
    );

    if (!rendered) {
      return (
        <div
          key={componentProps.componentId}
          className="border border-border rounded-md p-4 text-sm text-muted-foreground"
        >
          Unknown component type: {getStudyComponentLabel(componentType)}
        </div>
      );
    }

    return rendered;
  };

  const startResize = React.useCallback(
    (
      e: React.PointerEvent<HTMLButtonElement>,
      componentProps: CanvasComponentProps,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (!componentProps.canvasId || !componentProps.componentId) return;

      const grid = gridRef.current;
      if (!grid) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startLayout = clampCanvasLayout(componentProps.layout);
      const resizeUnit = getResizeUnit(grid.clientWidth);
      const canvasId = componentProps.canvasId;
      const componentId = componentProps.componentId;

      const handlePointerMove = (event: PointerEvent) => {
        const nextLayout = clampCanvasLayout({
          w: startLayout.w + Math.round((event.clientX - startX) / resizeUnit.column),
          h: startLayout.h + Math.round((event.clientY - startY) / resizeUnit.row),
        });

        useStudyCanvasStore
          .getState()
          .updateComponent(canvasId, componentId, { layout: nextLayout });
      };

      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [],
  );

  const SortableItem: React.FC<{ componentProps: CanvasComponentProps }> = ({
    componentProps,
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: componentProps.componentId });

    const layout = clampCanvasLayout(componentProps.layout);
    const itemTestIdPart = getTestIdPart(componentProps.componentId);
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      gridColumn: `span ${layout.w} / span ${layout.w}`,
      gridRow: `span ${layout.h} / span ${layout.h}`,
    };

    const { canvasId, componentId, _componentType } = componentProps;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative group min-w-0 min-h-0"
        data-testid="canvas-item"
        data-component-id={componentId}
        data-component-type={_componentType}
        data-grid-w={layout.w}
        data-grid-h={layout.h}
      >
        <div className="absolute -top-2 -right-2 z-50">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canvasId && componentId) {
                removeComponent(canvasId, componentId);
              }
            }}
            className="bg-background border border-border rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove"
            data-testid={`canvas-item-remove-${itemTestIdPart}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>

        <div
          {...attributes}
          {...listeners}
          draggable={true}
          onDragStart={(e) => {
            const dragData = {
              component: _componentType,
              props: {
                ...componentProps,
                _inCanvas: true,
                componentId,
                canvasId,
              },
            };
            e.dataTransfer.setData(
              "application/json",
              JSON.stringify(dragData),
            );
            e.dataTransfer.effectAllowed = "move";
          }}
          className="cursor-move h-full min-h-0 overflow-auto rounded-lg border border-transparent"
          data-testid={`canvas-item-content-${itemTestIdPart}`}
        >
          {renderComponent(componentProps)}
        </div>
        <button
          type="button"
          aria-label="Resize canvas item"
          className="absolute bottom-1 right-1 z-40 h-4 w-4 cursor-nwse-resize rounded-sm border border-border bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          onPointerDown={(e) => startResize(e, componentProps)}
          data-testid={`canvas-item-resize-${itemTestIdPart}`}
        />
      </div>
    );
  };

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !activeCanvasId) return;

      if (active.id !== over.id) {
        const overIndex = useStudyCanvasStore
          .getState()
          .getComponents(activeCanvasId)
          .findIndex((c) => c.componentId === over.id);
        if (overIndex === -1) return;
        useStudyCanvasStore
          .getState()
          .reorderComponent(activeCanvasId, active.id as string, overIndex);
      }
    },
    [activeCanvasId],
  );

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={cn("w-full h-full flex flex-col relative bg-background", className)}
      data-testid="dashboard-canvas"
      {...props}
    >
      <div
        className={cn(
          "flex items-center overflow-x-auto p-2 pr-10 gap-1 border-b border-border",
          "[&::-webkit-scrollbar]:w-[6px]",
          "[&::-webkit-scrollbar-thumb]:bg-gray-300",
          "[&::-webkit-scrollbar:horizontal]:h-[4px]",
        )}
        data-testid="canvas-tabs"
      >
        {canvases.map((c) => (
          <div
            key={c.id}
            data-canvas-id={c.id}
            data-testid={`canvas-tab-${getTestIdPart(c.id)}`}
            onClick={() => {
              setActiveCanvas(c.id);
              setPendingDeleteCanvasId(null);
            }}
            className={cn(
              "px-3 py-1 text-sm cursor-pointer whitespace-nowrap flex items-center gap-1 border-b-2",
              activeCanvasId === c.id
                ? "border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {editingCanvasId === c.id ? (
              <>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="bg-transparent border-b border-border/50 focus:outline-none text-sm w-24"
                  data-testid={`canvas-tab-name-input-${getTestIdPart(c.id)}`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveRenameCanvas();
                  }}
                  className="ml-1 p-0.5 hover:text-foreground"
                  title="Save"
                  data-testid={`canvas-tab-save-${getTestIdPart(c.id)}`}
                >
                  <CheckIcon className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <span>{c.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRenameCanvas(c.id);
                  }}
                  className="ml-1 p-0.5 hover:text-foreground"
                  title="Rename"
                  data-testid={`canvas-tab-rename-${getTestIdPart(c.id)}`}
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
                {canvases.length > 1 &&
                  (pendingDeleteCanvasId === c.id ? (
                    <div className="ml-1 flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-400/30 rounded text-xs text-destructive dark:text-red-300">
                      <span>Delete?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCanvas(c.id, true);
                        }}
                        className="p-0.5 hover:text-red-900 dark:hover:text-red-100"
                        title="Confirm delete"
                        data-testid={`canvas-tab-delete-confirm-${getTestIdPart(c.id)}`}
                      >
                        <CheckIcon className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteCanvasId(null);
                        }}
                        className="p-0.5 hover:text-red-900 dark:hover:text-red-100"
                        title="Cancel delete"
                        data-testid={`canvas-tab-delete-cancel-${getTestIdPart(c.id)}`}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCanvas(c.id);
                      }}
                      className="ml-1 p-0.5 hover:text-foreground"
                      title="Delete canvas"
                      data-testid={`canvas-tab-delete-${getTestIdPart(c.id)}`}
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  ))}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="absolute top-2 right-2">
        <button
          onClick={handleCreateCanvas}
          className="p-1 hover:text-foreground bg-background/80 backdrop-blur-sm rounded"
          title="New canvas"
          data-testid="canvas-create-button"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-50 bg-background rounded-md">
        {activeCanvasId && (
          <button
            onClick={() => activeCanvasId && clearCanvas(activeCanvasId)}
            className="px-3 py-1.5 border border-gray-200 text-primary hover:text-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 rounded-md shadow-sm flex items-center gap-1.5 text-sm cursor-pointer"
            title="Clear canvas"
            data-testid="canvas-clear-button"
          >
            <XIcon className="h-4 w-4" />
            <span>Clear Canvas</span>
          </button>
        )}
      </div>

      <div
        className={cn(
          "flex-1 overflow-auto p-4",
          "[&::-webkit-scrollbar]:w-[6px]",
          "[&::-webkit-scrollbar-thumb]:bg-gray-300",
          "[&::-webkit-scrollbar:horizontal]:h-[4px]",
        )}
        data-testid="canvas-drop-zone"
      >
        {!activeCanvas || activeCanvas.components.length === 0 ? (
          <div
            className="h-full flex items-center justify-center text-sm text-muted-foreground"
            data-testid="canvas-empty-state"
          >
            Drag components here
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={activeCanvas.components.map((c) => c.componentId)}
              strategy={rectSortingStrategy}
            >
              <div
                ref={gridRef}
                className="grid auto-rows-[32px] gap-4"
                style={{
                  gridTemplateColumns: `repeat(${CANVAS_GRID_COLUMNS}, minmax(0, 1fr))`,
                }}
                data-testid="canvas-item-grid"
              >
                {activeCanvas.components.map((c) => (
                  <SortableItem key={c.componentId} componentProps={c} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};

export default StudyComponentsCanvas;
