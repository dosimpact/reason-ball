import { useEffect, useRef } from 'react'
import type { Session } from './timer'
import { TimerCompletionAudio } from '../lib/timerCompletionAudio'
/** Observe committed transitions, never side-effect a React state updater. */
export function useTimerCompletion(session: Session) {
  const player = useRef<TimerCompletionAudio | null>(null)
  const previous = useRef({ phase: session.phase, status: session.status })
  useEffect(() => {
    const audio = new TimerCompletionAudio()
    player.current = audio
    return () => {
      audio.dispose()
      if (player.current === audio) player.current = null
    }
  }, [])
  useEffect(() => {
    const before = previous.current
    previous.current = { phase: session.phase, status: session.status }
    if (
      before.status === 'running' &&
      session.status === 'complete' &&
      before.phase === session.phase
    )
      player.current?.play()
    else if (session.status !== 'complete') player.current?.cancel()
  }, [session.phase, session.status])
  useEffect(() => {
    if (session.status !== 'running' || player.current?.prepared) return
    const remove = () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
    }
    const unlock = () => {
      remove()
      player.current?.prepare()
    }
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('keydown', unlock, true)
    return remove
  }, [session.status])
  return () => player.current?.prepare()
}
