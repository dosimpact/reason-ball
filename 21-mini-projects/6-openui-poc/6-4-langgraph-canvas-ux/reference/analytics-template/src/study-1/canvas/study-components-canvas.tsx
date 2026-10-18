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
  useSortable,
  verticalListSortingStrategy,
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
    const rendered = renderStudyComponent(
      componentType,
      getRenderableProps(componentProps),
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

  const SortableItem: React.FC<{ componentProps: CanvasComponentProps }> = ({
    componentProps,
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: componentProps.componentId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const { canvasId, componentId, _componentType } = componentProps;

    return (
      <div className="relative group">
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
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>

        <div
          ref={setNodeRef}
          style={style}
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
          className="cursor-move"
        >
          {renderComponent(componentProps)}
        </div>
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
      {...props}
    >
      <div
        className={cn(
          "flex items-center overflow-x-auto p-2 pr-10 gap-1 border-b border-border",
          "[&::-webkit-scrollbar]:w-[6px]",
          "[&::-webkit-scrollbar-thumb]:bg-gray-300",
          "[&::-webkit-scrollbar:horizontal]:h-[4px]",
        )}
      >
        {canvases.map((c) => (
          <div
            key={c.id}
            data-canvas-id={c.id}
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
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveRenameCanvas();
                  }}
                  className="ml-1 p-0.5 hover:text-foreground"
                  title="Save"
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
      >
        {!activeCanvas || activeCanvas.components.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Drag components here
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={activeCanvas.components.map((c) => c.componentId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-4">
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
