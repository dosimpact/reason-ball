import { useTranslation } from '@/shared/i18n'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Progress } from '@/shared/ui'
import { COFFEE_INTERVAL_MS } from '../model/coffeeRewards'
import './coffee-coupons.css'
function CupStamp() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M28 13c12-4 12 12 0 11" stroke="currentColor" strokeWidth="2.5" />
      <path d="M7 12h23l-3 16q-9 5-17 0Z" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="18.5" cy="12" rx="11.5" ry="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 33q13 4 28 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
export default function CoffeeCollection({
  coffees,
  remainderMs,
  error,
  notice,
  available = true,
}: {
  coffees: number
  remainderMs: number
  error: string
  notice: string
  available?: boolean
}) {
  const { t, i18n } = useTranslation('extras')
  const lastPage = Math.floor(coffees / 10)
  const [page, setPage] = useState(lastPage)
  const previousLast = useRef(lastPage)
  useEffect(() => {
    const previous = previousLast.current
    setPage((current) => (current === previous ? lastPage : Math.min(current, lastPage)))
    previousLast.current = lastPage
  }, [lastPage])
  const minutes = Math.floor(remainderMs / 60_000),
    remaining = Math.ceil((COFFEE_INTERVAL_MS - remainderMs) / 60_000)
  return (
    <section className="coffee-coupons" aria-label={t('coffee.label')}>
      <div className="coffee-coupon-heading">
        <span>{t('coffee.heading')}</span>
        <strong>
          {available ? coffees.toLocaleString(i18n.resolvedLanguage) : '—'}
          {available && <small>{t('coffee.cups')}</small>}
        </strong>
      </div>
      <Card appearance="existing" className="coffee-coupon-card">
        <div className="coffee-coupon-title">
          <CupStamp />
          <div>
            <h3>{t('coffee.title')}</h3>
            <p>{t('coffee.subtitle')}</p>
          </div>
          <span>{t('coffee.history')}</span>
        </div>
        {available ? (
          <>
            <ol
              className="coffee-stamps"
              role="list"
              aria-label={t('coffee.stamps', { page: page + 1 })}
            >
              {Array.from({ length: 10 }, (_, index) => {
                const number = page * 10 + index + 1,
                  filled = number <= coffees
                return (
                  <li
                    key={number}
                    className={`coffee-stamp${filled ? ' is-filled' : ''}`}
                    data-filled={filled}
                    aria-label={t('coffee.stamp', {
                      number,
                      state: t(filled ? 'coffee.filled' : 'coffee.empty'),
                    })}
                    style={
                      filled ? { transform: `rotate(${[-7, 5, -3][index % 3]}deg)` } : undefined
                    }
                  >
                    {filled ? <CupStamp /> : <span aria-hidden="true">{index + 1}</span>}
                  </li>
                )
              })}
            </ol>
            <div className="coffee-coupon-page" aria-live="polite">
              {t('coffee.page', {
                page: page + 1,
                total: lastPage + 1,
                cups: Math.min(10, Math.max(0, coffees - page * 10)),
              })}
            </div>
          </>
        ) : (
          <p className="coffee-coupon-unknown">{t('coffee.unknown')}</p>
        )}
      </Card>
      {available && (
        <>
          <nav className="coffee-coupon-pagination" aria-label={t('coffee.pagination')}>
            <Button
              variant="existing"
              aria-label={t('coffee.previous')}
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              ← {t('coffee.previous')}
            </Button>
            <Button
              variant="existing"
              aria-label={t('coffee.next')}
              disabled={page === lastPage}
              onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
            >
              {t('coffee.next')} →
            </Button>
          </nav>
          <div className="coffee-coupon-progress-copy">
            <span>{t('coffee.remaining', { minutes: remaining })}</span>
            <span>{t('coffee.progress', { minutes })}</span>
          </div>
          <Progress
            appearance="existing"
            className="coffee-coupon-progress"
            value={(remainderMs / COFFEE_INTERVAL_MS) * 100}
            aria-label={t('coffee.progressLabel')}
            aria-valuetext={t('coffee.progressValue', { minutes })}
          />
        </>
      )}
      {notice && (
        <p className="coffee-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="coffee-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
