import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from '@/shared/i18n'
import {
  Brand,
  Button,
  Input,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/shared/ui'
import { DRINKS, type DrinkId, type Temperature, type RitualState } from '../../model/cafeRitual'
import DrinkCup from './DrinkCup'
import ReceiptPrinter from './ReceiptPrinter'
import { ActionIcon } from '../HeaderActions'
import './ritual.css'

function ReceiptBarcode({ orderId }: { orderId: string }) {
  let seed = 2166136261
  for (const char of orderId) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  const bars = Array.from({ length: 32 }, (_, index) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return <rect key={index} x={index * 3} y="0" width={1 + (seed % 2)} height="12" />
  })
  return (
    <svg
      className="ritual-receipt-barcode"
      viewBox="0 0 96 12"
      aria-hidden="true"
      focusable="false"
    >
      {bars}
    </svg>
  )
}

function RitualIcon({ kind }: { kind: 'arrow' | 'back' | 'check' }) {
  return (
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
      {kind === 'arrow' ? (
        <path d="M5 19 19 5M5 5h14v14" />
      ) : kind === 'back' ? (
        <path d="M19 12H5m7-7-7 7 7 7" />
      ) : (
        <path d="m5 12 4 4L19 6" />
      )}
    </svg>
  )
}

export interface KioskExperienceProps {
  state: RitualState
  focus: number
  rest: number
  backgroundName: string
  onSelectDrink(id: DrinkId): void
  onCheckout(): void
  onBack(): void
  onOrder(): void
  onPrinted(): void
  onTimeChange(kind: 'focus' | 'rest', minutes: number): void
  customTimeOpen: boolean
  onCustomTimeOpenChange(open: boolean): void
  onCustomTimeApply(focus: number, rest: number): void
  onSeat(): void
  error?: string
  muted: boolean
  onMute(): void
  onLanguage?(): void
}

export default function KioskExperience(props: KioskExperienceProps) {
  const {
    state,
    focus,
    rest,
    backgroundName,
    onSelectDrink,
    onCheckout,
    onBack,
    onOrder,
    onPrinted,
    onTimeChange,
    customTimeOpen,
    onCustomTimeOpenChange,
    onCustomTimeApply,
    onSeat,
    error,
    muted,
    onMute,
    onLanguage,
  } = props
  const { t, i18n } = useTranslation('ritual')
  const reduced = useReducedMotion()
  const receipt = state.stage === 'receipt' || state.stage === 'seating'
  const printing = state.stage === 'printing'
  const receiptTarget = useRef<HTMLElement>(null)
  const root = useRef<HTMLElement>(null)
  const checkoutHeading = useRef<HTMLHeadingElement>(null)
  const selectedDrink = useRef(state.drinkId)
  selectedDrink.current = state.drinkId
  const order = state.order
  const [menuPage, setMenuPage] = useState(() =>
    Math.floor(
      Math.max(
        0,
        DRINKS.findIndex((drink) => drink.id === state.drinkId),
      ) / 12,
    ),
  )
  const [menuPageSize, setMenuPageSize] = useState(12)
  useEffect(() => {
    const media = window.matchMedia('(max-height: 480px) and (orientation: landscape)')
    const resize = () => {
      const size = media.matches ? 8 : 12
      setMenuPageSize(size)
      setMenuPage(
        Math.floor(
          Math.max(
            0,
            DRINKS.findIndex((drink) => drink.id === selectedDrink.current),
          ) / size,
        ),
      )
    }
    resize()
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])
  const pageCount = Math.ceil(DRINKS.length / menuPageSize)
  const pageDrinks = DRINKS.slice(menuPage * menuPageSize, (menuPage + 1) * menuPageSize)
  const [timeDraft, setTimeDraft] = useState({ focus: String(focus), rest: String(rest) })
  const lastValidDraft = useRef({ focus: String(focus), rest: String(rest) })
  useEffect(() => {
    if (!customTimeOpen) {
      const values = { focus: String(focus), rest: String(rest) }
      lastValidDraft.current = values
      setTimeDraft(values)
    }
  }, [customTimeOpen, focus, rest])
  useEffect(() => {
    const target =
      state.stage === 'checkout'
        ? checkoutHeading.current
        : state.stage === 'receipt'
          ? receiptTarget.current
          : state.stage === 'menu'
            ? (root.current?.querySelector<HTMLButtonElement>(
                '.ritual-menu-item[aria-pressed="true"]',
              ) ?? root.current?.querySelector<HTMLButtonElement>('.ritual-menu-item'))
            : null
    target?.focus({ preventScroll: true })
  }, [state.stage])
  const validTime = (kind: 'focus' | 'rest', raw: string) => {
    const value = Number(raw)
    return (
      raw.trim() !== '' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= (kind === 'focus' ? 180 : 60)
    )
  }
  const validTimes = validTime('focus', timeDraft.focus) && validTime('rest', timeDraft.rest)
  return (
    <main
      ref={root}
      className={`ritual-experience ${receipt ? 'ritual-show-receipt' : ''}`}
      data-ritual-stage={state.stage}
    >
      <div className="ritual-heading">
        <h1>{t(receipt ? 'receiptHeading' : 'heading')}</h1>
        <p>{t(receipt ? 'receiptIntro' : 'intro')}</p>
      </div>
      <div className="ritual-counter-stage">
        <div className="ritual-counter-light" aria-hidden="true" />
        <section className="ritual-pos" aria-label={t('kiosk')}>
          <div className="ritual-device-bezel">
            <div className="ritual-device-camera" aria-hidden="true" />
            <div className="ritual-screen">
              <div className="ritual-screen-heading">
                <Brand static />
                <div className="ritual-top-actions">
                  {onLanguage && (
                    <Button
                      variant="existing"
                      type="button"
                      onClick={onLanguage}
                      aria-label={t('language')}
                    >
                      <ActionIcon kind="language" />{' '}
                      <span>{i18n.resolvedLanguage?.toUpperCase()}</span>
                    </Button>
                  )}
                  <Button
                    variant="existing"
                    type="button"
                    onClick={onMute}
                    aria-label={t(muted ? 'unmute' : 'mute')}
                    aria-pressed={muted}
                  >
                    <span className={`ritual-sound-icon ${muted ? 'ritual-sound-muted' : ''}`}>
                      <ActionIcon kind="ambient" />
                    </span>
                  </Button>
                </div>
              </div>
              {state.stage === 'menu' ? (
                <>
                  <div className="ritual-menu" role="group" aria-label={t('menu')}>
                    {pageDrinks.map((drink) => (
                      <Button
                        variant="existing"
                        className="ritual-menu-item"
                        type="button"
                        key={drink.id}
                        data-drink-id={drink.id}
                        aria-label={t(`drinks.${drink.id}`)}
                        onClick={() => onSelectDrink(drink.id)}
                        aria-pressed={state.drinkId === drink.id}
                      >
                        <DrinkCup
                          drinkId={drink.id}
                          temperature={drink.id === 'cold-brew' ? 'iced' : 'hot'}
                          size={100}
                        />
                      </Button>
                    ))}
                  </div>
                  {pageCount > 1 && (
                    <nav
                      className="ritual-menu-page"
                      data-menu-page={menuPage}
                      aria-label={t('mobile.menuPages')}
                    >
                      <Button
                        variant="existing"
                        type="button"
                        className="ritual-menu-prev"
                        disabled={menuPage === 0}
                        onClick={() => setMenuPage((page) => Math.max(0, page - 1))}
                        aria-label={t('mobile.previousPage')}
                      >
                        <RitualIcon kind="back" />
                      </Button>
                      <span aria-live="polite">
                        {t('mobile.page', { current: menuPage + 1, total: pageCount })}
                      </span>
                      <Button
                        variant="existing"
                        type="button"
                        className="ritual-menu-next"
                        disabled={menuPage >= pageCount - 1}
                        onClick={() => setMenuPage((page) => Math.min(pageCount - 1, page + 1))}
                        aria-label={t('mobile.nextPage')}
                      >
                        <RitualIcon kind="arrow" />
                      </Button>
                    </nav>
                  )}
                  <div className="ritual-order-draft">
                    <Button
                      variant="existing"
                      type="button"
                      className="ritual-primary primary button-primary"
                      onClick={onCheckout}
                    >
                      {t('mobile.checkout')}
                      <RitualIcon kind="arrow" />
                    </Button>
                  </div>
                </>
              ) : state.stage === 'checkout' ? (
                <div className="ritual-checkout">
                  <Button variant="existing" type="button" className="ritual-back" onClick={onBack}>
                    <RitualIcon kind="back" /> {t('back')}
                  </Button>
                  <DrinkCup
                    drinkId={state.drinkId}
                    temperature={state.temperature}
                    size={156}
                    steam
                  />
                  <h2 ref={checkoutHeading} tabIndex={-1}>
                    {t(`drinks.${state.drinkId}`)}
                  </h2>
                  <span className="ritual-temperature-label">{t(state.temperature)}</span>
                  <div className="ritual-bill">
                    <span>{t('todayCup')}</span>
                    <strong>{t('free')}</strong>
                  </div>
                  <Button
                    variant="existing"
                    type="button"
                    className="ritual-primary primary button-primary"
                    onClick={onOrder}
                  >
                    {t('order')}
                    <RitualIcon kind="arrow" />
                  </Button>
                </div>
              ) : (
                <div className="ritual-print-confirm" role="status">
                  <span className="ritual-confirm-check" aria-hidden="true">
                    <RitualIcon kind="check" />
                  </span>
                  <h2>{t('orderAccepted')}</h2>
                  <p>{t('printing')}</p>
                  <DrinkCup
                    drinkId={state.drinkId}
                    temperature={state.temperature}
                    size={100}
                    steam
                  />
                </div>
              )}
            </div>
            <div className="ritual-device-bottom">
              <span>RR—01</span>
              <span aria-hidden="true">● ● ●</span>
            </div>
          </div>
          <div className="ritual-printer">
            <span className="ritual-printer-light" />
            <div className="ritual-printer-slot" />
          </div>
          <div className="ritual-device-foot" aria-hidden="true" />
        </section>
        {(receipt || printing) && (
          <section
            ref={receiptTarget}
            tabIndex={-1}
            className={`ritual-receipt ${printing ? 'ritual-receipt-print-target' : ''} ${error ? 'ritual-receipt-has-error' : ''}`}
            aria-label={t('receipt')}
            aria-hidden={printing || undefined}
            inert={printing}
          >
            <div className="ritual-receipt-summary">
              <div className="ritual-receipt-brand">
                <Brand static className="ritual-paper-brand" />
              </div>
              <p className="ritual-receipt-subtitle">{t('receiptDetails.subtitle')}</p>
              <div className="ritual-receipt-meta">
                <span>{t('orderNumber')}</span>
                <span>#{order?.id.slice(-6).toUpperCase() || '—'}</span>
              </div>
              {order && (
                <time
                  className="ritual-order-date"
                  dateTime={new Date(order.createdAt).toISOString()}
                >
                  {new Intl.DateTimeFormat(i18n.resolvedLanguage || 'ko', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(order.createdAt))}
                </time>
              )}
              <ReceiptBarcode orderId={order?.id || 'pending'} />
              <div
                className="ritual-receipt-items"
                role="table"
                aria-label={t('receiptDetails.items')}
              >
                <div className="ritual-receipt-columns" role="row">
                  <span role="columnheader">{t('receiptDetails.item')}</span>
                  <span role="columnheader">{t('receiptDetails.quantity')}</span>
                  <span role="columnheader">{t('receiptDetails.amount')}</span>
                </div>
                <div className="ritual-receipt-drink" role="row">
                  <div role="cell">
                    <DrinkCup drinkId={state.drinkId} temperature={state.temperature} size={36} />
                    <div>
                      <strong>{t(`drinks.${state.drinkId}`)}</strong>
                      <span>{t(state.temperature)}</span>
                    </div>
                  </div>
                  <span role="cell">1</span>
                  <span role="cell">₩0</span>
                </div>
              </div>
              <div className="ritual-receipt-total">
                <span>{t('receiptDetails.total')}</span>
                <strong>₩0</strong>
              </div>
              <p className="ritual-receipt-complimentary">{t('receiptDetails.complimentary')}</p>
            </div>
            <div className="ritual-receipt-content">
              <h3>{t('todayFocus')}</h3>
              <Dialog
                open={customTimeOpen}
                onOpenChange={(open) => {
                  const values = { focus: String(focus), rest: String(rest) }
                  lastValidDraft.current = values
                  setTimeDraft(values)
                  onCustomTimeOpenChange(open)
                }}
              >
                {(['focus', 'rest'] as const).map((kind) => (
                  <fieldset className="ritual-time-field" key={kind}>
                    <legend>
                      {t(kind)}
                      {kind === 'rest' && ![5, 10, 15].includes(rest) && (
                        <span className="ritual-current-time">{t('minutes', { count: rest })}</span>
                      )}
                    </legend>
                    <div
                      className={`ritual-time-presets presets ${kind === 'focus' ? 'ritual-focus-presets' : ''}`}
                    >
                      {(kind === 'focus' ? [25, 55] : [5, 10, 15]).map((minutes) => (
                        <Button
                          variant="existing"
                          type="button"
                          key={minutes}
                          className={
                            (kind === 'focus' ? focus : rest) === minutes ? 'selected' : ''
                          }
                          aria-pressed={(kind === 'focus' ? focus : rest) === minutes}
                          onClick={() => {
                            setTimeDraft((draft) => ({ ...draft, [kind]: String(minutes) }))
                            onTimeChange(kind, minutes)
                          }}
                        >
                          {t('minutes', { count: minutes })}
                        </Button>
                      ))}
                      {kind === 'focus' && (
                        <DialogTrigger asChild>
                          <Button
                            variant="existing"
                            type="button"
                            className={`ritual-custom-time-open ${![25, 55].includes(focus) ? 'selected' : ''}`}
                            aria-label={t('focusCustom')}
                            aria-pressed={![25, 55].includes(focus)}
                          >
                            {t('mobile.customInput')}
                            {![25, 55].includes(focus) && (
                              <small>{t('minutes', { count: focus })}</small>
                            )}
                          </Button>
                        </DialogTrigger>
                      )}
                    </div>
                  </fieldset>
                ))}
                <DialogContent
                  appearance="existing"
                  className="settings-dialog ritual-custom-dialog ritual-custom-time-dialog"
                  overlayClassName="settings-overlay"
                  showCloseButton={false}
                  aria-describedby={undefined}
                >
                  <div className="sheet">
                    <div className="sheet-header">
                      <DialogTitle appearance="existing">{t('mobile.customTimes')}</DialogTitle>
                      <DialogClose asChild>
                        <Button
                          variant="existing"
                          type="button"
                          className="close"
                          aria-label={t('mobile.close')}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                          >
                            <path d="m6 6 12 12M18 6 6 18" />
                          </svg>
                        </Button>
                      </DialogClose>
                    </div>
                    {(['focus', 'rest'] as const).map((kind) => (
                      <label className="custom-time" key={kind}>
                        <span>{t(kind)}</span>
                        <Input
                          appearance="existing"
                          type="number"
                          min="1"
                          max={kind === 'focus' ? 180 : 60}
                          step="1"
                          aria-label={t(kind === 'focus' ? 'focusCustom' : 'restCustom')}
                          value={timeDraft[kind]}
                          aria-invalid={!validTime(kind, timeDraft[kind])}
                          onChange={(event) => {
                            const raw = event.currentTarget.value
                            setTimeDraft((draft) => ({ ...draft, [kind]: raw }))
                            if (validTime(kind, raw))
                              lastValidDraft.current = { ...lastValidDraft.current, [kind]: raw }
                          }}
                          onBlur={() => {
                            if (!validTime(kind, timeDraft[kind]))
                              setTimeDraft((draft) => ({
                                ...draft,
                                [kind]: lastValidDraft.current[kind],
                              }))
                          }}
                        />
                      </label>
                    ))}
                    {!validTimes && (
                      <p className="ritual-error" role="status">
                        {t('invalidTime')}
                      </p>
                    )}
                    <Button
                      variant="existing"
                      type="button"
                      className="primary button-primary save"
                      disabled={!validTimes}
                      onClick={() => {
                        if (validTimes)
                          onCustomTimeApply(Number(timeDraft.focus), Number(timeDraft.rest))
                      }}
                    >
                      {t('mobile.apply')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              {!validTimes && (
                <p className="ritual-error" role="status">
                  {t('invalidTime')}
                </p>
              )}
            </div>
            <div className="ritual-receipt-actions">
              <div className="ritual-seat-place">
                <span>{t('yourSeat')}</span>
                <strong>{backgroundName}</strong>
              </div>
              {error && (
                <p role="alert" className="ritual-error">
                  {error}
                </p>
              )}
              <Button
                variant="existing"
                type="button"
                className="ritual-seat-button primary action-accent"
                onClick={() => {
                  if (validTimes) onSeat()
                }}
                disabled={state.stage === 'seating' || !validTimes}
              >
                <span>{t('seat')}</span>
                <RitualIcon kind="arrow" />
              </Button>
              <p className="ritual-receipt-footnote">{t('receiptFootnote')}</p>
            </div>
          </section>
        )}
        {printing && order && (
          <ReceiptPrinter
            order={order}
            drinkId={state.drinkId}
            temperature={state.temperature}
            focus={focus}
            rest={rest}
            targetRef={receiptTarget}
            onComplete={onPrinted}
            reducedMotion={Boolean(reduced)}
          />
        )}
      </div>
    </main>
  )
}

export function SeatingTransition({
  drinkId,
  temperature,
  reduced = false,
  ready = true,
  onComplete,
}: {
  drinkId: DrinkId
  temperature: Temperature
  reduced?: boolean
  ready?: boolean
  onComplete?: () => void
}) {
  const preference = useReducedMotion()
  const callback = useRef(onComplete)
  callback.current = onComplete
  const minimal = Boolean(reduced || preference)
  const [covered, setCovered] = useState(false)
  const [fading, setFading] = useState(false)
  const fadeGeneration = useRef(0)
  const completed = useRef(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setCovered(true), minimal ? 120 : 700)
    return () => window.clearTimeout(timer)
  }, [minimal])
  useEffect(() => {
    const generation = ++fadeGeneration.current
    if (!covered || !ready) {
      setFading(false)
      return
    }
    if (completed.current) return
    setFading(true)
    const timer = window.setTimeout(
      () => {
        if (fadeGeneration.current !== generation || completed.current) return
        completed.current = true
        callback.current?.()
      },
      minimal ? 120 : 400,
    )
    return () => {
      fadeGeneration.current++
      window.clearTimeout(timer)
    }
  }, [covered, ready, minimal])
  const { t } = useTranslation('ritual')
  return (
    <motion.div
      className={`ritual-seating ${temperature === 'iced' ? 'ritual-seating-iced' : ''}`}
      role="status"
      data-fading={fading}
      aria-label={t('seating')}
      initial={{ opacity: 0 }}
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: minimal ? 0.12 : fading ? 0.4 : 0.7 }}
    >
      <div className="ritual-scent" />
      <motion.div
        initial={{ y: 40, scale: 0.8 }}
        animate={{ y: -12, scale: 1 }}
        transition={{ duration: minimal ? 0.15 : 0.9 }}
      >
        <DrinkCup drinkId={drinkId} temperature={temperature} size={180} steam />
        {!ready && <p className="ritual-seating-copy">{t('preparingSeat')}</p>}
      </motion.div>
    </motion.div>
  )
}
