import { useEffect, useMemo, useRef } from 'react'
import type { SceneInteractiveObject } from '../../model/sceneInteractiveTypes'
import type { SceneWorldFrame } from '../../model/sceneWorldCamera'
import {
  projectSceneObjectTarget,
  SceneObjectPointerGesture,
} from '../../lib/pixiSceneInteractions'
import './scene-interactive.css'

function SceneObjectTarget({
  object,
  frame,
  language,
  onActivate,
}: {
  object: SceneInteractiveObject
  frame: SceneWorldFrame
  language: string
  onActivate: (id: string) => void
}) {
  const gesture = useRef(new SceneObjectPointerGesture())
  useEffect(() => {
    const cancel = () => gesture.current.cancel()
    // A native scroll can start without a final pointermove reaching the button.
    window.addEventListener('scroll', cancel, true)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('scroll', cancel, true)
      window.removeEventListener('blur', cancel)
    }
  }, [])
  const target = projectSceneObjectTarget(object, frame)
  if (!target) return null
  const lang = language.startsWith('ko') ? 'ko' : language.startsWith('zh') ? 'zh' : 'en'
  return (
    <button
      type="button"
      className="scene-interactive-target"
      data-scene-interactive={object.id}
      aria-label={object.label[lang]}
      style={{ left: target.left, top: target.top, width: target.width, height: target.height }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) {
          gesture.current.cancel()
          return
        }
        gesture.current.down(event.clientX, event.clientY, event.pointerId)
      }}
      onPointerMove={(event) => gesture.current.move(event.clientX, event.clientY, event.pointerId)}
      onPointerUp={(event) => gesture.current.up(event.pointerId)}
      onPointerCancel={() => gesture.current.cancel()}
      onPointerLeave={() => gesture.current.leave()}
      onDragStart={(event) => {
        event.preventDefault()
        gesture.current.cancel()
      }}
      onClick={(event) => {
        if (!gesture.current.click(event.detail === 0)) return
        onActivate(object.id)
      }}
    />
  )
}
export default function SceneInteractiveTargets({
  objects,
  frame,
  language,
  enabled,
  onActivate,
}: {
  objects: readonly SceneInteractiveObject[]
  frame: SceneWorldFrame
  language: string
  enabled: boolean
  onActivate: (id: string) => void
}) {
  const visible = useMemo(
    () => (enabled ? objects.filter((object) => projectSceneObjectTarget(object, frame)) : []),
    [objects, frame, enabled],
  )
  if (!visible.length) return null
  return (
    <div className="scene-interactive-targets">
      {visible.map((object) => (
        <SceneObjectTarget
          key={object.id}
          object={object}
          frame={frame}
          language={language}
          onActivate={onActivate}
        />
      ))}
    </div>
  )
}
