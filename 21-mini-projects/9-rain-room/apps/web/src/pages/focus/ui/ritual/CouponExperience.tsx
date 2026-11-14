import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from '@/shared/i18n'
import { Brand, Button } from '@/shared/ui'
import { getDrink, type DrinkId } from '../../model/cafeRitual'
import DrinkCup from './DrinkCup'
import './coupon-experience.css'

export type CouponExperienceProps = {
  drinkId: DrinkId
  focusMs: number
  earned: number
  totalCoupons: number
  remainderMs: number
  confirmed: boolean
  error: string
  phase: 'coupon' | 'rest'
  restRemaining: number
  restComplete: boolean
  restMinutes: number
  onRetry(): void
  onRest(): void
  onReturn(): void
}
function Stamp({ filled, fresh }: { filled: boolean; fresh: boolean }) {
  return (
    <span
      className={`completion-stamp ${filled ? 'completion-stamp-filled' : ''}`}
      aria-hidden="true"
      data-new-stamp={fresh}
    >
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M8 12h14l-1 9q-1 4-6 4t-6-4Zm14 2h2c6 0 4 7-2 6M6 27h20M12 8q-2-3 0-5m5 5q-2-3 0-5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
export default function CouponExperience(props: CouponExperienceProps) {
  const { t } = useTranslation('ritual')
  const reduced = useReducedMotion()
  const heading = useRef<HTMLHeadingElement>(null)
  const restCallback = useRef(props.onRest)
  restCallback.current = props.onRest
  const restStarted = useRef(false)
  const restTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelAutoRest = () => {
    clearTimeout(restTimer.current)
    restTimer.current = undefined
  }
  const startRest = () => {
    if (restStarted.current || !props.confirmed || props.error || props.phase !== 'coupon') return
    restStarted.current = true
    cancelAutoRest()
    restCallback.current()
  }
  const returnToCounter = () => {
    restStarted.current = true
    cancelAutoRest()
    props.onReturn()
  }
  const [settled, setSettled] = useState(false)
  const [stamped, setStamped] = useState(false)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    setSettled(false)
    setStamped(false)
    if (!props.confirmed || props.error) return
    if (props.phase === 'rest') {
      setSettled(true)
      setStamped(true)
      return
    }
    const enter = setTimeout(() => setSettled(true), reduced ? 0 : 550)
    const stamp = setTimeout(() => setStamped(true), reduced ? 0 : 1250)
    if (!restStarted.current) {
      restTimer.current = setTimeout(
        () => {
          if (restStarted.current) return
          restStarted.current = true
          restTimer.current = undefined
          restCallback.current()
        },
        reduced ? 800 : 2100,
      )
    }
    return () => {
      clearTimeout(enter)
      clearTimeout(stamp)
      cancelAutoRest()
    }
  }, [props.confirmed, props.error, props.phase, reduced])
  const confirmed = props.confirmed && !props.error
  const earned = Math.max(0, Math.floor(props.earned))
  const total = Math.max(0, Math.floor(props.totalCoupons))
  const filled = total === 0 ? 0 : ((total - 1) % 10) + 1
  const progress = Math.min(25 * 60000, Math.max(0, props.remainderMs))
  const remainingSeconds = Math.max(0, Math.ceil(props.restRemaining / 1000))
  const restTime = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const resting = props.phase === 'rest'
  return (
    <main
      className="coupon-experience"
      data-phase={props.phase}
      data-confirmed={confirmed}
      data-reduced-motion={Boolean(reduced)}
    >
      <Brand static />
      <section
        className="completion-coupon"
        data-settled={settled}
        data-stamped={stamped}
        aria-labelledby="completion-heading"
      >
        <div className="completion-coupon-heading">
          <DrinkCup
            drinkId={props.drinkId}
            temperature={getDrink(props.drinkId).temperatures[0]}
            size={44}
          />
          <h1 id="completion-heading" ref={heading} tabIndex={-1}>
            {t(
              resting
                ? props.restComplete
                  ? 'completion.restFinished'
                  : 'completion.restHeading'
                : 'completion.heading',
            )}
          </h1>
        </div>
        {!resting && (
          <p className="completion-focus">
            {t('completion.focused', { minutes: Math.round(Math.max(0, props.focusMs) / 60000) })}
          </p>
        )}
        {confirmed ? (
          <>
            <p className="completion-result" role="status">
              {t(earned > 0 ? 'completion.earned' : 'completion.progressOnly', { count: earned })}
            </p>
            <div className="completion-stamps" aria-label={t('completion.total', { count: total })}>
              {Array.from({ length: 10 }, (_, i) => (
                <Stamp key={i} filled={i < filled} fresh={earned > 0 && i === filled - 1} />
              ))}
            </div>
            <div className="completion-coupon-totals">
              <strong>{t('completion.total', { count: total })}</strong>
              <span>{t('completion.carry', { minutes: Math.floor(progress / 60000) })}</span>
            </div>
            <progress
              className="completion-progress"
              value={progress}
              max={25 * 60000}
              aria-label={t('completion.nextProgress')}
            />
          </>
        ) : (
          <div className="completion-pending" role={props.error ? 'alert' : 'status'}>
            <p>{props.error || t('completion.saving')}</p>
            {props.error && (
              <Button variant="existing" className="completion-retry" onClick={props.onRetry}>
                {t('completion.retry')}
              </Button>
            )}
          </div>
        )}
        {resting && (
          <div className="completion-rest">
            <span>
              {t(props.restComplete ? 'completion.restFinished' : 'completion.restHeading')}
            </span>
            <time aria-label={t('completion.restRemaining')}>{restTime}</time>
          </div>
        )}
        <div className="completion-actions">
          {resting ? (
            <Button
              variant="existing"
              className="primary button-primary action-accent"
              onClick={returnToCounter}
            >
              {t(props.restComplete ? 'completion.newVisit' : 'completion.endRest')}
            </Button>
          ) : (
            <>
              <Button
                variant="existing"
                className="primary button-primary action-accent"
                disabled={!confirmed}
                onClick={startRest}
              >
                {t('completion.restAction', { minutes: props.restMinutes })}
              </Button>
              <Button variant="existing" className="completion-return" onClick={returnToCounter}>
                {t('completion.return')}
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export function DepartureTransition({ onComplete }: { onComplete(): void }) {
  const reduced = useReducedMotion()
  const callback = useRef(onComplete)
  callback.current = onComplete
  const finished = useRef(false)
  const complete = () => {
    if (!finished.current) {
      finished.current = true
      callback.current()
    }
  }
  useEffect(() => {
    finished.current = false
    const timer = setTimeout(complete, reduced ? 120 : 680)
    return () => clearTimeout(timer)
  }, [reduced])
  return (
    <div
      className="completion-departure"
      aria-hidden="true"
      data-reduced-motion={Boolean(reduced)}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) complete()
      }}
    />
  )
}
