import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import { useTranslation } from '@/shared/i18n'
import { Brand } from '@/shared/ui'
import type { CafeOrder, DrinkId, Temperature } from '../../model/cafeRitual'
import {
  PRINT_DURATION_MS,
  REDUCED_PRINT_DURATION_MS,
  RECEIPT_PAPER_BANDS,
  RECEIPT_PAPER_LENGTH,
  receiptPaperFrame,
} from '../../lib/receiptPaper'
import './receipt-printer.css'
export type ReceiptPrinterProps = {
  order: CafeOrder | null
  drinkId: DrinkId
  temperature: Temperature
  focus: number
  rest: number
  onComplete: () => void
  reducedMotion?: boolean
  targetRef?: RefObject<HTMLElement | null>
}
/** A bottom-up, progressively unrolling copy of the actual final receipt DOM. */
export default function ReceiptPrinter({
  order,
  drinkId,
  temperature,
  focus,
  rest,
  onComplete,
  reducedMotion,
  targetRef,
}: ReceiptPrinterProps) {
  const { t, i18n } = useTranslation('ritual')
  const preference = useReducedMotion()
  const reduced = Boolean(reducedMotion ?? preference)
  const progress = useMotionValue(0)
  const root = useRef<HTMLDivElement>(null)
  const bands = useRef<(HTMLDivElement | null)[]>([])
  const edge = useRef<HTMLDivElement>(null)
  const callback = useRef(onComplete)
  const completed = useRef(false)
  const layout = useRef({
    top: 0,
    bottom: 640,
    height: RECEIPT_PAPER_LENGTH,
    viewportTop: 0,
    scale: 1,
  })
  const [snapshot, setSnapshot] = useState('')
  callback.current = onComplete
  const apply = (value: number) => {
    const frame = receiptPaperFrame(value, layout.current)
    if (root.current) {
      root.current.dataset.progress = value.toFixed(4)
      root.current.dataset.phase = frame.phase
      root.current.dataset.feed = frame.feed.toFixed(4)
      root.current.dataset.leadingTop = (
        layout.current.viewportTop +
        frame.leadingY * layout.current.scale
      ).toFixed(3)
      root.current.dataset.targetTop = (
        layout.current.viewportTop +
        frame.targetTop * layout.current.scale
      ).toFixed(3)
      root.current.dataset.curl = frame.curl.toFixed(4)
      root.current.dataset.winding = frame.winding.toFixed(4)
      root.current.dataset.tailAnchored = String(frame.tailAnchored)
      root.current.dataset.tailY = frame.edge.y.toFixed(3)
    }
    for (const band of frame.bands) {
      const element = bands.current[band.index]
      if (!element) continue
      element.style.transform = `translate3d(0,${band.y.toFixed(3)}px,${band.z.toFixed(3)}px) rotateX(${band.rotation.toFixed(3)}deg)`
      element.style.height = `${Math.max(0, band.height + 0.35).toFixed(3)}px`
      element.style.visibility = band.visible ? 'visible' : 'hidden'
      element.style.setProperty('--receipt-shade', String(band.shade))
      element.style.setProperty('--receipt-band-offset', `${band.sourceY}px`)
      element.style.setProperty('--receipt-band-height', `${band.sourceHeight}px`)
      element.dataset.sourceY = band.sourceY.toFixed(3)
      element.dataset.y = band.y.toFixed(3)
      element.dataset.z = band.z.toFixed(3)
      element.dataset.rotation = band.rotation.toFixed(3)
      element.dataset.backVisible = String(band.backVisible)
    }
    if (edge.current) {
      edge.current.style.transform = `translate3d(0,${frame.edge.y.toFixed(3)}px,${frame.edge.z.toFixed(3)}px) rotateX(${frame.edge.rotation.toFixed(3)}deg)`
      edge.current.style.opacity = frame.feed > 0 ? '1' : '0'
    }
  }
  useEffect(() => {
    const measure = () => {
      const element = root.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const scale = rect.width > 0 && element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1
      const viewportHeight =
        (window.visualViewport?.offsetTop || 0) +
        (window.visualViewport?.height || window.innerHeight)
      const target = targetRef?.current
      const bounds = target?.getBoundingClientRect()
      const height = bounds?.height ? bounds.height / scale : RECEIPT_PAPER_LENGTH
      const top = bounds?.height
        ? (bounds.top - rect.top) / scale
        : Math.max(0, (viewportHeight - height) / 2 - rect.top) / scale
      const width = bounds?.width ? bounds.width / scale : Math.min(390, rect.width || 390)
      const left = bounds?.width
        ? (bounds.left - rect.left) / scale
        : Math.max(0, ((rect.width || width) - width) / 2)
      layout.current = {
        top,
        bottom: (viewportHeight - rect.top) / scale,
        height,
        viewportTop: rect.top,
        scale,
      }
      element.style.setProperty('--receipt-paper-width', `${width}px`)
      element.style.setProperty('--receipt-paper-height', `${height}px`)
      element.style.setProperty('--receipt-paper-left', `${left}px`)
      element.style.setProperty(
        '--receipt-visible-height',
        `${Math.max(0, (viewportHeight - rect.top) / scale)}px`,
      )
      if (target) {
        // Only our own React-rendered receipt is serialized, never external HTML.
        const clone = target.cloneNode(true) as HTMLElement
        const originals = [target, ...target.querySelectorAll<HTMLElement>('*')]
        const copies = [clone, ...clone.querySelectorAll<HTMLElement>('*')]
        for (let i = 0; i < copies.length; i++) {
          const copy = copies[i],
            original = originals[i]
          copy.classList.remove('ritual-receipt-print-target')
          for (const attribute of [...copy.attributes])
            if (
              attribute.name === 'id' ||
              attribute.name === 'for' ||
              attribute.name === 'data-print-hidden' ||
              attribute.name.startsWith('on') ||
              attribute.name.startsWith('data-radix-') ||
              [
                'aria-controls',
                'aria-labelledby',
                'aria-describedby',
                'aria-owns',
                'aria-activedescendant',
                'aria-details',
                'aria-errormessage',
              ].includes(attribute.name)
            )
              copy.removeAttribute(attribute.name)
          if (copy.matches('input,textarea,select,button,a,[tabindex]'))
            copy.setAttribute('tabindex', '-1')
          if (original instanceof HTMLInputElement) {
            copy.setAttribute('value', original.value)
            if (original.checked) copy.setAttribute('checked', '')
            else copy.removeAttribute('checked')
          }
        }
        Object.assign(clone.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          right: 'auto',
          bottom: 'auto',
          margin: '0',
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          transform: 'none',
          visibility: 'visible',
          opacity: '1',
          boxShadow: 'none',
        })
        setSnapshot((current) => (current === clone.outerHTML ? current : clone.outerHTML))
      }
      apply(progress.get())
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (targetRef?.current) observer?.observe(targetRef.current)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
    const unsubscribe = progress.on('change', apply)
    return () => {
      observer?.disconnect()
      unsubscribe()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
    }
  }, [progress, targetRef, order?.id, drinkId, temperature, focus, rest, i18n.resolvedLanguage])
  useEffect(() => {
    let disposed = false
    const finish = () => {
      if (!disposed && !completed.current) {
        completed.current = true
        callback.current()
      }
    }
    if (reduced) {
      progress.set(1)
      apply(1)
      const timer = window.setTimeout(finish, REDUCED_PRINT_DURATION_MS)
      return () => {
        disposed = true
        window.clearTimeout(timer)
      }
    }
    progress.set(0)
    apply(0)
    const animation = animate(progress, 1, {
      duration: PRINT_DURATION_MS / 1000,
      ease: 'linear',
      onComplete: finish,
    })
    return () => {
      disposed = true
      animation.stop()
    }
  }, [progress, reduced])
  const date = order
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage || 'ko', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(order.createdAt)
    : ''
  const ink = (
    <div className="receipt-print-ink">
      <Brand static />
      <div className="receipt-print-rule" />
      <div className="receipt-print-row">
        <span>{t('orderNumber')}</span>
        <strong>#{order?.id.slice(-6).toUpperCase() || '—'}</strong>
      </div>
      <p className="receipt-print-date">{date}</p>
      <h3>{t(`drinks.${drinkId}`)}</h3>
      <div className="receipt-print-row">
        <span>
          {t(temperature)} · {t('oneCup')}
        </span>
        <span>{t('free')}</span>
      </div>
      <div className="receipt-print-rule" />
      <div className="receipt-print-row">
        <span>{t('focus')}</span>
        <strong>{t('minutes', { count: focus })}</strong>
      </div>
      <div className="receipt-print-row">
        <span>{t('rest')}</span>
        <strong>{t('minutes', { count: rest })}</strong>
      </div>
      <p className="receipt-print-note">{t('receiptFootnote')}</p>
    </div>
  )
  return (
    <div
      ref={root}
      className="receipt-printer"
      data-phase={reduced ? 'complete' : 'waiting'}
      data-progress={reduced ? '1' : '0'}
      data-reduced={reduced}
      data-direction="up"
      inert
      aria-hidden="true"
    >
      <div className="receipt-printer-window">
        <div
          className="receipt-paper-mesh"
          style={{ '--receipt-band-count': RECEIPT_PAPER_BANDS } as CSSProperties}
        >
          {Array.from({ length: RECEIPT_PAPER_BANDS }, (_, index) => (
            <div
              key={index}
              ref={(element) => {
                bands.current[index] = element
              }}
              className="receipt-paper-band"
              data-band={index}
              style={
                {
                  '--receipt-band-offset': `${(index * RECEIPT_PAPER_LENGTH) / RECEIPT_PAPER_BANDS}px`,
                } as CSSProperties
              }
            >
              <div className="receipt-paper-front">
                <div className="receipt-paper-ink-crop">
                  {snapshot ? (
                    <div
                      className="receipt-paper-snapshot"
                      dangerouslySetInnerHTML={{ __html: snapshot }}
                    />
                  ) : (
                    ink
                  )}
                </div>
              </div>
              <div className="receipt-paper-back" />
            </div>
          ))}
          <div ref={edge} className="receipt-paper-free-edge" />
        </div>
      </div>
    </div>
  )
}
