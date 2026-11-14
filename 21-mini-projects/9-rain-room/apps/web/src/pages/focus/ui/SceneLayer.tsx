import { createContext, useContext, type ReactNode } from 'react'
export type SceneLayerMode = 'all' | 'rear' | 'foreground'
export const SceneLayerContext = createContext<SceneLayerMode>('all')
export function useSceneLayer() {
  return useContext(SceneLayerContext)
}
export function Rear({ children }: { children: ReactNode }) {
  return useSceneLayer() === 'foreground' ? null : <g data-scene-layer="rear">{children}</g>
}
export function Foreground({ children }: { children: ReactNode }) {
  return useSceneLayer() === 'rear' ? null : <g data-scene-layer="foreground">{children}</g>
}
