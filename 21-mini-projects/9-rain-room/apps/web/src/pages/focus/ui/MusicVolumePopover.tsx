import { useTranslation } from '@/shared/i18n'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/shared/ui'
type Props = { volume: number; onVolume: (volume: number) => void; dismiss: boolean }
export default function MusicVolumePopover({ volume, onVolume, dismiss }: Props) {
  const { t } = useTranslation('sound')
  const [open, setOpen] = useState(false)
  const slider = useRef<HTMLInputElement>(null)
  const id = `music-volume-${useId().replace(/:/g, '')}`
  useEffect(() => {
    if (dismiss) setOpen(false)
  }, [dismiss])
  return (
    <div className="sound-volume-control">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="existing"
            className="sound-more"
            aria-label={t('music.adjustVolume')}
            aria-controls={id}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m11 4-6 5H2v6h3l6 5zM15 8q5 4 0 8M18 5q8 7 0 14" />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          appearance="existing"
          id={id}
          className="music-volume-popover"
          aria-label={t('music.adjustVolume')}
          data-testid="music-volume-popover"
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={24}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            slider.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            if (dismiss) event.preventDefault()
          }}
        >
          <label>
            <span className="music-volume-popover-heading">
              {t('music.volume')}
              <span className="music-volume-percentage">{Math.round(volume * 100)}%</span>
            </span>
            <input
              ref={slider}
              aria-label={t('music.mainVolume')}
              type="range"
              min="0"
              max="1"
              step=".01"
              value={volume}
              onChange={(event) => onVolume(Number(event.target.value))}
            />
          </label>
        </PopoverContent>
      </Popover>
    </div>
  )
}
