import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CanvasComponent {
  componentId: string;
  _componentType: string;
  _inCanvas?: boolean;
  canvasId?: string;
  layout?: CanvasComponentLayout;
  [key: string]: unknown;
}

export interface CanvasComponentLayout {
  w: number;
  h: number;
}

export interface Canvas {
  id: string;
  name: string;
  components: CanvasComponent[];
}

export interface CanvasState {
  canvases: Canvas[];
  activeCanvasId: string | null;
  pendingOperations: Set<string>;
  getCanvases: () => Canvas[];
  getCanvas: (id: string) => Canvas | undefined;
  getComponents: (canvasId: string) => CanvasComponent[];
  createCanvas: (name?: string) => Canvas;
  updateCanvas: (id: string, name: string) => Canvas | null;
  removeCanvas: (id: string) => void;
  setActiveCanvas: (id: string | null) => void;
  reorderCanvas: (canvasId: string, newIndex: number) => void;
  clearCanvas: (id: string) => void;
  addComponent: (canvasId: string, component: CanvasComponent) => void;
  updateComponent: (
    canvasId: string,
    componentId: string,
    props: Record<string, unknown>,
  ) => CanvasComponent | null;
  removeComponent: (canvasId: string, componentId: string) => void;
  moveComponent: (
    sourceCanvasId: string,
    targetCanvasId: string,
    componentId: string,
  ) => CanvasComponent | null;
  reorderComponent: (
    canvasId: string,
    componentId: string,
    newIndex: number,
  ) => void;
}

export const STUDY_CANVAS_STORAGE_KEY = "study-canvas-storage";

export const CANVAS_GRID_COLUMNS = 12;
export const CANVAS_GRID_GAP = 16;
export const CANVAS_GRID_ROW_HEIGHT = 32;
export const CANVAS_GRID_MIN_W = 3;
export const CANVAS_GRID_MIN_H = 4;
export const CANVAS_GRID_MAX_W = CANVAS_GRID_COLUMNS;
export const CANVAS_GRID_MAX_H = 18;

export const generateId = () =>
  `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function clampCanvasLayout(
  layout: Partial<CanvasComponentLayout> | undefined,
): CanvasComponentLayout {
  return {
    w: Math.max(
      CANVAS_GRID_MIN_W,
      Math.min(CANVAS_GRID_MAX_W, Math.round(layout?.w ?? 6)),
    ),
    h: Math.max(
      CANVAS_GRID_MIN_H,
      Math.min(CANVAS_GRID_MAX_H, Math.round(layout?.h ?? 8)),
    ),
  };
}

export function getDefaultCanvasLayout(
  componentType: string,
): CanvasComponentLayout {
  if (componentType === "Markdown") {
    return { w: 4, h: 6 };
  }

  return { w: 6, h: 8 };
}

export const useStudyCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      canvases: [],
      activeCanvasId: null,
      pendingOperations: new Set<string>(),

      getCanvases: () => get().canvases,

      getCanvas: (id: string) => get().canvases.find((c) => c.id === id),

      getComponents: (canvasId: string) => {
        const canvas = get().canvases.find((c) => c.id === canvasId);
        return canvas?.components || [];
      },

      createCanvas: (name?: string) => {
        const id = generateId();
        const canvases = get().canvases;
        const canvasName = name || `New Canvas ${canvases.length + 1}`;
        const newCanvas: Canvas = { id, name: canvasName, components: [] };

        set((state) => ({
          canvases: [...state.canvases, newCanvas],
          activeCanvasId: id,
        }));

        return newCanvas;
      },

      updateCanvas: (id: string, name: string) => {
        const updatedName = name.trim();
        if (!updatedName) return null;

        let updatedCanvas: Canvas | null = null;

        set((state) => {
          const updatedCanvases = state.canvases.map((c) => {
            if (c.id === id) {
              updatedCanvas = { ...c, name: updatedName };
              return updatedCanvas;
            }
            return c;
          });

          return { canvases: updatedCanvases };
        });

        return updatedCanvas;
      },

      removeCanvas: (id: string) => {
        set((state) => {
          const updatedCanvases = state.canvases.filter((c) => c.id !== id);
          let activeId = state.activeCanvasId;

          if (activeId === id) {
            activeId = updatedCanvases[0]?.id || null;
          }

          return {
            canvases: updatedCanvases,
            activeCanvasId: activeId,
          };
        });
      },

      setActiveCanvas: (id: string | null) => {
        set({ activeCanvasId: id });
      },

      reorderCanvas: (canvasId: string, newIndex: number) => {
        set((state) => {
          const currentIndex = state.canvases.findIndex(
            (c) => c.id === canvasId,
          );
          if (currentIndex === -1) return state;

          const canvasesCopy = [...state.canvases];
          const [moving] = canvasesCopy.splice(currentIndex, 1);
          const boundedIndex = Math.max(
            0,
            Math.min(canvasesCopy.length, newIndex),
          );
          canvasesCopy.splice(boundedIndex, 0, moving);

          return { canvases: canvasesCopy };
        });
      },

      clearCanvas: (id: string) => {
        set((state) => ({
          canvases: state.canvases.map((c) =>
            c.id === id ? { ...c, components: [] } : c,
          ),
        }));
      },

      addComponent: (canvasId: string, componentProps: CanvasComponent) => {
        const componentId = componentProps.componentId || generateId();

        const operationKey = `add-${componentId}-${canvasId}`;
        const pendingOps = get().pendingOperations;

        if (pendingOps.has(operationKey)) {
          console.log(`[STUDY CANVAS] Skipping duplicate operation: ${operationKey}`);
          return;
        }

        pendingOps.add(operationKey);
        set({ pendingOperations: new Set(pendingOps) });

        set((state) => {
          const targetCanvas = state.canvases.find((c) => c.id === canvasId);
          if (
            targetCanvas &&
            targetCanvas.components.some((c) => c.componentId === componentId)
          ) {
            console.log(
              `[STUDY CANVAS] Component ${componentId} already exists in canvas ${canvasId}`,
            );
            setTimeout(() => {
              const ops = get().pendingOperations;
              ops.delete(operationKey);
              set({ pendingOperations: new Set(ops) });
            }, 100);
            return state;
          }

          const updatedCanvases = state.canvases.map((c) =>
            c.id === canvasId
              ? {
                  ...c,
                  components: [
                    ...c.components,
                    {
                      ...componentProps,
                      componentId,
                      _inCanvas: true,
                      canvasId,
                      layout: clampCanvasLayout(
                        componentProps.layout ??
                          getDefaultCanvasLayout(componentProps._componentType),
                      ),
                    },
                  ],
                }
              : c,
          );

          setTimeout(() => {
            const ops = get().pendingOperations;
            ops.delete(operationKey);
            set({ pendingOperations: new Set(ops) });
          }, 100);

          return { canvases: updatedCanvases };
        });
      },

      updateComponent: (
        canvasId: string,
        componentId: string,
        props: Record<string, unknown>,
      ) => {
        let updatedComponent: CanvasComponent | null = null;

        set((state) => {
          const updatedCanvases = state.canvases.map((c) => {
            if (c.id !== canvasId) return c;

            const updatedComponents = c.components.map((comp) => {
              if (comp.componentId !== componentId) return comp;

              updatedComponent = { ...comp, ...props };
              return updatedComponent;
            });

            return { ...c, components: updatedComponents };
          });

          return { canvases: updatedCanvases };
        });

        return updatedComponent;
      },

      removeComponent: (canvasId: string, componentId: string) => {
        set((state) => ({
          canvases: state.canvases.map((c) =>
            c.id === canvasId
              ? {
                  ...c,
                  components: c.components.filter(
                    (comp) => comp.componentId !== componentId,
                  ),
                }
              : c,
          ),
        }));
      },

      moveComponent: (
        sourceCanvasId: string,
        targetCanvasId: string,
        componentId: string,
      ) => {
        if (sourceCanvasId === targetCanvasId) return null;

        const operationKey = `move-${componentId}-${sourceCanvasId}-${targetCanvasId}`;
        const pendingOps = get().pendingOperations;

        if (pendingOps.has(operationKey)) {
          console.log(
            `[STUDY CANVAS] Skipping duplicate move operation: ${operationKey}`,
          );
          return null;
        }

        pendingOps.add(operationKey);
        set({ pendingOperations: new Set(pendingOps) });

        let movedComponent: CanvasComponent | null = null;

        set((state) => {
          const sourceCanvas = state.canvases.find(
            (c) => c.id === sourceCanvasId,
          );
          if (!sourceCanvas) return state;

          const component = sourceCanvas.components.find(
            (c) => c.componentId === componentId,
          );
          if (!component) return state;

          const targetCanvas = state.canvases.find(
            (c) => c.id === targetCanvasId,
          );
          if (
            targetCanvas &&
            targetCanvas.components.some((c) => c.componentId === componentId)
          ) {
            console.log(
              `[STUDY CANVAS] Component ${componentId} already exists in target canvas ${targetCanvasId}`,
            );
            return state;
          }

          movedComponent = {
            ...component,
            canvasId: targetCanvasId,
          };

          const updatedCanvases = state.canvases.map((c) => {
            if (c.id === sourceCanvasId) {
              return {
                ...c,
                components: c.components.filter(
                  (comp) => comp.componentId !== componentId,
                ),
              };
            }
            if (c.id === targetCanvasId) {
              return {
                ...c,
                components: [...c.components, movedComponent!],
              };
            }
            return c;
          });

          setTimeout(() => {
            const ops = get().pendingOperations;
            ops.delete(operationKey);
            set({ pendingOperations: new Set(ops) });
          }, 100);

          return { canvases: updatedCanvases };
        });

        return movedComponent;
      },

      reorderComponent: (
        canvasId: string,
        componentId: string,
        newIndex: number,
      ) => {
        set((state) => {
          const updatedCanvases = state.canvases.map((c) => {
            if (c.id !== canvasId) return c;

            const componentIndex = c.components.findIndex(
              (comp) => comp.componentId === componentId,
            );
            if (componentIndex === -1) return c;

            const newComponents = [...c.components];
            const [component] = newComponents.splice(componentIndex, 1);
            const boundedIndex = Math.max(
              0,
              Math.min(newComponents.length, newIndex),
            );

            newComponents.splice(boundedIndex, 0, component);

            return {
              ...c,
              components: newComponents,
            };
          });

          return { canvases: updatedCanvases };
        });
      },
    }),
    {
      name: STUDY_CANVAS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        canvases: state.canvases,
        activeCanvasId: state.activeCanvasId,
      }),
    },
  ),
);
