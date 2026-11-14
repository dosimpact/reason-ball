import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '@/shared/i18n'
import { Button, Dialog, DialogContent, DialogTitle, DialogClose, Input } from '@/shared/ui'
import { ActionIcon } from '../HeaderActions'
import LanguageSettings from '../LanguageSettings'
import CoffeeCollection from '../CoffeeCollection'
import BackgroundPicker from '../BackgroundPicker'
import { MusicSettings, AmbientSettings } from '../SoundPanels'
import type { Settings } from '../../model/timer'
import type { useSound } from '../../model/useSound'
import type { useCoffeeRewards } from '../../model/useCoffeeRewards'
import type { AmbientId } from '../../model/ambient'
import '../header-actions.css'
import './settings.css'
export type RitualSheet =
  | 'settings'
  | 'time'
  | 'music'
  | 'ambient'
  | 'background'
  | 'coffee'
  | 'collection'
  | 'language'
  | 'return'
type Props = {
  sheet: RitualSheet | null
  onSheet: (sheet: RitualSheet | null) => void
  settings: Settings
  sound: ReturnType<typeof useSound>
  rewards: ReturnType<typeof useCoffeeRewards>
  opener: HTMLElement | null
  onSettings: (patch: Partial<Settings>) => void
  onTime: (focus: number, rest: number) => void
  onAmbient: (id: AmbientId, patch: Partial<{ enabled: boolean; volume: number }>) => void
  onReorder: () => void
  sessionActive: boolean
  collection?: ReactNode
}
function TimeSettings({
  settings,
  onSave,
}: {
  settings: Settings
  onSave: (focus: number, rest: number) => void
}) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState({ focus: settings.focus, rest: settings.rest })
  const focusInput = useRef<HTMLInputElement>(null)
  const valid = (kind: 'focus' | 'rest') =>
    Number.isInteger(draft[kind]) &&
    draft[kind] >= 1 &&
    draft[kind] <= (kind === 'focus' ? 180 : 60)
  const validTimes = valid('focus') && valid('rest')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (validTimes) onSave(draft.focus, draft.rest)
      }}
    >
      <p className="sheet-description">
        {t('time.description1')}
        <br />
        {t('time.description2')}
      </p>
      {(['focus', 'rest'] as const).map((kind) => (
        <fieldset key={kind}>
          <legend>{t(`time.${kind}`)}</legend>
          <div className={`presets ${kind === 'focus' ? 'ritual-settings-focus-presets' : ''}`}>
            {(kind === 'focus' ? [25, 55] : [5, 10, 15]).map((value) => (
              <Button
                variant="existing"
                type="button"
                key={value}
                className={draft[kind] === value ? 'selected' : ''}
                aria-pressed={draft[kind] === value}
                onClick={() => setDraft((current) => ({ ...current, [kind]: value }))}
              >
                {t('session.minutes', { count: value })}
              </Button>
            ))}
            {kind === 'focus' && (
              <Button
                variant="existing"
                type="button"
                className={![25, 55].includes(draft.focus) ? 'selected' : ''}
                aria-label={t('time.focusCustom')}
                aria-pressed={![25, 55].includes(draft.focus)}
                onClick={() => focusInput.current?.focus({ preventScroll: true })}
              >
                {t('ritual:mobile.customInput')}
              </Button>
            )}
          </div>
          <label className="custom-time">
            {t('time.custom')}
            <span>
              <Input
                ref={kind === 'focus' ? focusInput : undefined}
                appearance="existing"
                aria-label={t(kind === 'focus' ? 'time.focusCustom' : 'time.restCustom')}
                type="number"
                min="1"
                max={kind === 'focus' ? 180 : 60}
                step="1"
                required
                aria-invalid={!valid(kind)}
                value={draft[kind] || ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [kind]: Number(event.target.value) }))
                }
              />{' '}
              {t('session.unitMinute')}
            </span>
          </label>
        </fieldset>
      ))}
      {!validTimes && (
        <p className="sheet-description" role="status">
          {t('ritual:invalidTime')}
        </p>
      )}
      <Button variant="existing" className="primary save" type="submit" disabled={!validTimes}>
        {t('time.save')}
      </Button>
    </form>
  )
}
export default function RitualSettings(props: Props) {
  const { t } = useTranslation(['common', 'ritual'])
  const title = useRef<HTMLHeadingElement>(null)
  const prior = useRef(props.sheet)
  const overviewOrigin = useRef(false)
  if (props.sheet === 'settings') overviewOrigin.current = true
  else if (props.sheet === null) overviewOrigin.current = false
  useEffect(() => {
    if (props.sheet && prior.current && props.sheet !== prior.current) title.current?.focus()
    prior.current = props.sheet
  }, [props.sheet])
  const label =
    props.sheet === 'settings'
      ? t('ritual:room.settings')
      : props.sheet === 'return'
        ? t('ritual:room.returnToCounter')
        : props.sheet === 'language'
          ? t('language.title')
          : t(`sheets.${props.sheet ?? 'time'}`)
  return (
    <Dialog
      open={props.sheet !== null}
      onOpenChange={(value) => {
        if (!value) props.onSheet(null)
      }}
    >
      <DialogContent
        appearance="existing"
        className="settings-dialog ritual-settings-dialog"
        overlayClassName="settings-overlay"
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={() => props.onSheet(null)}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          props.opener?.focus({ preventScroll: true })
        }}
      >
        <div className="sheet">
          <div className="sheet-header">
            <div className="ritual-settings-title">
              {overviewOrigin.current && props.sheet !== 'settings' && (
                <Button
                  variant="existing"
                  className="close ritual-settings-back"
                  aria-label={t('ritual:room.backSettings')}
                  onClick={() => props.onSheet('settings')}
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
                    <path d="m12 5-7 7 7 7M5 12h14" />
                  </svg>
                </Button>
              )}
              <DialogTitle appearance="existing" ref={title} tabIndex={-1}>
                {label}
              </DialogTitle>
            </div>
            <DialogClose asChild>
              <Button variant="existing" className="close" aria-label={t('sheets.close')}>
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
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </Button>
            </DialogClose>
          </div>
          {props.sheet === 'settings' ? (
            <div className="ritual-settings-menu">
              {(
                [
                  'time',
                  'music',
                  'ambient',
                  'background',
                  'coffee',
                  'collection',
                  'language',
                  'return',
                ] as const
              ).map((action) => {
                const actionLabel =
                  action === 'return'
                    ? t('ritual:room.returnToCounter')
                    : action === 'background'
                      ? t('sheets.background')
                      : t(`header.actions.${action}.label`)
                return (
                  <Button
                    key={action}
                    variant="existing"
                    className="header-setting-action"
                    onClick={() => {
                      if (action === 'return' && !props.sessionActive) props.onReorder()
                      else props.onSheet(action)
                    }}
                  >
                    <ActionIcon kind={action === 'return' ? 'coffee' : action} />
                    <span>{actionLabel}</span>
                  </Button>
                )
              })}
            </div>
          ) : props.sheet === 'return' ? (
            <div className="ritual-return-confirm">
              <p className="sheet-description">{t('ritual:room.returnConfirm')}</p>
              <Button variant="existing" className="primary save" onClick={props.onReorder}>
                {t('ritual:room.returnToCounter')}
              </Button>
              <Button
                variant="existing"
                className="header-setting-action"
                onClick={() => props.onSheet(null)}
              >
                {t('ritual:room.stay')}
              </Button>
            </div>
          ) : props.sheet === 'language' ? (
            <LanguageSettings />
          ) : props.sheet === 'time' ? (
            <TimeSettings settings={props.settings} onSave={props.onTime} />
          ) : props.sheet === 'background' ? (
            <BackgroundPicker
              selectedId={props.settings.background}
              onSelect={(background) => {
                props.onSettings({ background })
                props.onSheet(null)
              }}
            />
          ) : props.sheet === 'collection' ? (
            props.collection
          ) : props.sheet === 'coffee' ? (
            <CoffeeCollection
              available={props.rewards.available}
              coffees={props.rewards.coffees}
              remainderMs={props.rewards.remainderMs}
              error={props.rewards.error}
              notice={props.rewards.notice}
            />
          ) : props.sheet === 'music' ? (
            <MusicSettings
              queue={props.sound.queue}
              category={props.settings.musicCategory}
              onShuffle={(ids, criteria, category, preferred) => {
                void props.sound.shuffle(ids, criteria, category, preferred)
              }}
              selectedId={props.settings.track}
              volume={props.settings.music}
              onVolume={(music) => props.onSettings({ music })}
              error={props.sound.error}
            />
          ) : props.sheet === 'ambient' ? (
            <AmbientSettings
              mix={props.settings.ambient}
              playing={props.sound.ambientPlaying}
              error={props.sound.ambientError}
              onUpdate={props.onAmbient}
              onToggle={() =>
                props.sound.ambientPlaying
                  ? props.sound.stopAmbient()
                  : void props.sound.startAmbient()
              }
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
