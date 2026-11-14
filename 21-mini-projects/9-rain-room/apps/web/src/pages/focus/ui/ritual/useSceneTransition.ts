import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SceneTransitionController,
  type SceneStatus,
  type SceneTransitionState,
} from '../../lib/sceneTransition'

export function useSceneTransition(backgroundId: string, onStatus: (status: SceneStatus) => void) {
  const [state, setState] = useState<SceneTransitionState>({
    displayedId: backgroundId,
    generation: 0,
    phase: 'idle',
    timedOut: false,
  })
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const controller = useRef<SceneTransitionController | null>(null)
  const statusCallback = useRef(onStatus)
  statusCallback.current = onStatus
  useLayoutEffect(() => {
    const instance = new SceneTransitionController({
      initialId: backgroundId,
      reducedMotion,
      onChange: setState,
      onStatus: (status) => statusCallback.current(status),
    })
    controller.current = instance
    return () => {
      instance.destroy()
      if (controller.current === instance) controller.current = null
    }
  }, [])
  useLayoutEffect(() => {
    controller.current?.request(backgroundId)
  }, [backgroundId])
  useLayoutEffect(() => {
    controller.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  const sceneStatus = useCallback(
    (status: SceneStatus) =>
      controller.current?.status(state.displayedId, state.generation, status),
    [state.displayedId, state.generation],
  )
  return {
    ...state,
    sceneStatus,
    retry: () => controller.current?.retry(),
    reducedMotion,
    busy: state.phase !== 'idle' || state.displayedId !== backgroundId,
  }
}
