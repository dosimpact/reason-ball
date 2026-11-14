import { useTranslation } from '@/shared/i18n'
import { useEffect, useRef, useState } from 'react'
import {
  coffeeTotals,
  coffeeCompletion,
  emptyCoffeeLedger,
  mergeCoffeeLedgers,
  observeCoffeeTimer,
  validCoffeeId,
  type CoffeeTimer,
  type CoffeeLedger,
} from './coffeeRewards'
import { LocalCoffeeRewardsStorage, type CoffeeRewardsStorage } from './coffeeRewardsStorage'
export function useCoffeeRewards(
  session: CoffeeTimer,
  initialRunId: unknown,
  providedStorage?: CoffeeRewardsStorage,
) {
  const { t } = useTranslation('extras')
  const [storage] = useState(() => providedStorage ?? new LocalCoffeeRewardsStorage())
  const [initial] = useState(() => storage.read())
  const [confirmed, setConfirmed] = useState<CoffeeLedger>(() =>
    initial.ok ? initial.ledger : emptyCoffeeLedger(),
  )
  const [error, setError] = useState(initial.ok ? '' : initial.error)
  const [available, setAvailable] = useState(initial.ok)
  const [earnedNotice, setEarnedNotice] = useState(0)
  const working = useRef(confirmed),
    confirmedRef = useRef(confirmed)
  const runId = useRef<string | null>(validCoffeeId(initialRunId) ? initialRunId : null)
  const current = useRef(session)
  current.current = session
  const sync = () => {
    const advance = (latest: CoffeeLedger) => {
      const base = mergeCoffeeLedgers(working.current, latest)
      const own = runId.current ? working.current.active[runId.current] : undefined
      if (own && !base.completed[own.id]) base.active[own.id] = own
      const observed = observeCoffeeTimer(base, runId.current, current.current, Date.now())
      working.current = observed.ledger
      runId.current = observed.runId
      return observed.ledger
    }
    const result = storage.update(advance)
    if (!result.ok) {
      advance(working.current)
      setError(result.error)
      return
    }
    const earned = coffeeTotals(result.ledger).coffees - coffeeTotals(confirmedRef.current).coffees
    working.current = result.ledger
    confirmedRef.current = result.ledger
    setConfirmed(result.ledger)
    setError('')
    setAvailable(true)
    if (earned > 0) setEarnedNotice(earned)
  }
  useEffect(() => {
    if (session.status === 'running') setEarnedNotice(0)
    sync()
  }, [
    session.phase,
    session.status,
    session.duration,
    session.deadline,
    session.status === 'paused' ? session.remaining : null,
  ])
  useEffect(() => {
    const unsubscribe = storage.subscribe(sync)
    const visible = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', visible)
    }
  }, [storage])
  const errors: Record<string, string> = {
    '커피 기록을 읽지 못했어요. 기존 기록은 덮어쓰지 않았어요.': 'coffee.readError',
    '커피 기록에 접근하지 못했어요. 브라우저 저장 설정을 확인해 주세요.': 'coffee.accessError',
    '커피 기록을 저장하지 못했어요. 기록 용량과 형식을 확인해 주세요.': 'coffee.formatError',
    '커피 기록 용량이 가득 찼어요. 기존 기록은 유지했어요.': 'coffee.fullError',
    '커피 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.': 'coffee.saveError',
  }
  return {
    ...coffeeTotals(confirmed),
    available,
    error: error ? t(errors[error] ?? 'coffee.saveError') : '',
    notice: earnedNotice ? t('coffee.earned', { count: earnedNotice }) : '',
    getRunId: () => runId.current,
    getCompletion: (id: string | null) => coffeeCompletion(confirmedRef.current, id),
    retry: sync,
  }
}
