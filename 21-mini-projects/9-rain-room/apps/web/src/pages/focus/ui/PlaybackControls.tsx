import type { ReactNode } from 'react'
import { useTranslation } from '@/shared/i18n'
import { TooltipProvider } from '@/shared/ui'
import PlaybackAction from './PlaybackAction'
import { PLAYBACK_MODES, type PlaybackMode } from '../model/musicQueue'
const modes = PLAYBACK_MODES
function ModeIcon({ mode }: { mode: PlaybackMode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === 'repeat-one' ? (
        <>
          <path d="M17 3l4 4-4 4M3 10V7h18M7 21l-4-4 4-4m14 1v3H3" />
          <path d="m10 10 2-1v6m-2 0h4" />
        </>
      ) : mode === 'shuffle' ? (
        <>
          <path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4" />
        </>
      ) : (
        <>
          <path d="M4 5h1m3 0h12M4 12h1m3 0h8M4 19h1m3 0h12m-1-10 3 3-3 3" />
        </>
      )}
    </svg>
  )
}
export default function PlaybackControls({
  mode,
  onMode,
  onNext,
  fullscreen = false,
  compact = false,
  hidden = false,
  tooltipsDisabled = false,
  primaryAction,
}: {
  mode: PlaybackMode
  onMode: (mode: PlaybackMode) => void
  onNext: () => void
  fullscreen?: boolean
  compact?: boolean
  hidden?: boolean
  tooltipsDisabled?: boolean
  primaryAction?: ReactNode
}) {
  const { t } = useTranslation('sound')
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length]
  const cycleLabel = t('playback.cycle', {
    current: t(`playback.${mode}.name`),
    next: t(`playback.${nextMode}.name`),
  })
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={0}>
      <div
        className="playback-controls"
        role="group"
        aria-label={t(fullscreen ? 'playback.fullscreenGroup' : 'playback.group')}
        hidden={hidden}
      >
        {compact ? (
          <PlaybackAction
            className="playback-mode playback-mode-cycle"
            mode={mode}
            label={cycleLabel}
            description={cycleLabel}
            tooltipDisabled={hidden || tooltipsDisabled}
            onActivate={() => onMode(nextMode)}
          >
            <ModeIcon mode={mode} />
          </PlaybackAction>
        ) : (
          modes.map((item) => (
            <PlaybackAction
              key={item}
              className="playback-mode"
              mode={item}
              label={t(`playback.${item}.name`)}
              description={t(`playback.${item}.description`)}
              pressed={mode === item}
              tooltipDisabled={hidden || tooltipsDisabled}
              onActivate={() => onMode(item)}
            >
              <ModeIcon mode={item} />
            </PlaybackAction>
          ))
        )}
        {compact && primaryAction}
        <PlaybackAction
          className="next-track"
          label={t(fullscreen ? 'playback.fullscreenNext' : 'playback.next')}
          description={t('playback.nextDescription')}
          tooltipDisabled={hidden || tooltipsDisabled}
          onActivate={onNext}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="m5 5 10 7-10 7zM17 5h2v14h-2z" />
          </svg>
        </PlaybackAction>
      </div>
    </TooltipProvider>
  )
}
