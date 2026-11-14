import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { RECEIPT_PAPER_BANDS } from '../src/pages/focus/lib/receiptPaper.ts'
await build({
  publicDir: false,
  build: {
    ssr: 'src/pages/focus/ui/ritual/ReceiptPrinter.tsx',
    outDir: 'node_modules/.cache/receipt-printer',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000' })
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'SVGElement',
  'Node',
  'MutationObserver',
  'ResizeObserver',
  'Event',
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: name === 'window' ? window : window[name],
  })
for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: window[name].bind(window),
  })
Object.defineProperty(window.Element.prototype, 'animate', { configurable: true, value: undefined })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  writable: true,
  value: true,
})
const { createElement, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: Printer } = await import(
  '../node_modules/.cache/receipt-printer/ReceiptPrinter.js'
)
const props = {
  order: { id: 'order-ABC123', drinkId: 'cold-brew', temperature: 'iced', createdAt: 1000 },
  drinkId: 'cold-brew',
  temperature: 'iced',
  focus: 25,
  rest: 5,
}
const wait = async (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
test('real Motion controller bends front/back band surfaces, then completes once with actual order ink', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let completed = 0
  try {
    await act(async () =>
      root.render(
        createElement(Printer, {
          ...props,
          reducedMotion: false,
          onComplete() {
            completed++
          },
        }),
      ),
    )
    assert.equal(host.querySelectorAll('.receipt-paper-band').length, RECEIPT_PAPER_BANDS)
    assert.equal(host.querySelectorAll('.receipt-paper-front').length, RECEIPT_PAPER_BANDS)
    assert.equal(host.querySelectorAll('.receipt-paper-back').length, RECEIPT_PAPER_BANDS)
    assert.ok(host.textContent!.includes('#ABC123'))
    assert.ok(host.querySelector('.brand')!.textContent!.includes('Rain Room'))
    await wait(900)
    const paper = host.querySelector<HTMLElement>('.receipt-printer')!
    assert.equal(paper.dataset.phase, 'feeding')
    assert.equal(completed, 0)
    assert.ok(
      [...host.querySelectorAll<HTMLElement>('.receipt-paper-band')].some(
        (b) => Number(b.dataset.z) < -5,
      ),
    )
    assert.ok(host.querySelector('[data-back-visible="true"]'))
    assert.ok(Number(paper.dataset.winding) > 1, 'actual band geometry makes a complete roll')
    assert.equal(paper.dataset.tailAnchored, 'true')
    const leadingTop = Number(paper.dataset.leadingTop)
    assert.ok(leadingTop > window.innerHeight / 2)
    await wait(750)
    assert.ok(Number(paper.dataset.leadingTop) < leadingTop)
    await wait(1950)
    assert.equal(completed, 1)
    assert.equal(paper.dataset.phase, 'complete')
    await act(async () =>
      root.render(
        createElement(Printer, {
          ...props,
          reducedMotion: false,
          onComplete() {
            completed++
          },
        }),
      ),
    )
    await wait(30)
    assert.equal(completed, 1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
test('reduced motion shows the finished paper, completes in 180ms, and cancels safely on unmount', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  let root = createRoot(host),
    completed = 0
  await act(async () =>
    root.render(
      createElement(Printer, {
        ...props,
        reducedMotion: true,
        onComplete() {
          completed++
        },
      }),
    ),
  )
  assert.equal(host.querySelector<HTMLElement>('.receipt-printer')!.dataset.progress, '1.0000')
  await wait(220)
  assert.equal(completed, 1)
  await act(async () => root.unmount())
  host.remove()
  const second = document.createElement('div')
  document.body.append(second)
  root = createRoot(second)
  completed = 0
  await act(async () =>
    root.render(
      createElement(Printer, {
        ...props,
        reducedMotion: true,
        onComplete() {
          completed++
        },
      }),
    ),
  )
  await act(async () => root.unmount())
  await wait(220)
  assert.equal(completed, 0)
  second.remove()
})
test.after(async () => {
  await window.happyDOM.abort()
})

test('actual receipt target is cropped at its measured final dimensions without hidden classes or duplicate IDs', async () => {
  const target = document.createElement('section')
  target.id = 'actual-receipt'
  target.className = 'ritual-receipt ritual-receipt-print-target'
  target.style.visibility = 'hidden'
  target.style.boxShadow = '0 22px 55px #0007'
  target.setAttribute('data-print-hidden', 'true')
  target.innerHTML =
    '<h2 id="receipt-title">Exact receipt</h2><label for="receipt-time">Focus<input id="receipt-time" value="25" aria-labelledby="receipt-title" aria-controls="receipt-extra"></label>'
  const originalInput = target.querySelector('input')!
  originalInput.value = '29'
  target.getBoundingClientRect = () => ({
    left: 40,
    top: 36,
    width: 360,
    height: 560,
    right: 400,
    bottom: 596,
    x: 40,
    y: 36,
    toJSON() {
      return {}
    },
  })
  document.body.append(target)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let completed = 0
  const targetRef = { current: target }
  try {
    await act(async () =>
      root.render(
        createElement(Printer, {
          ...props,
          targetRef,
          reducedMotion: true,
          onComplete() {
            completed++
          },
        }),
      ),
    )
    const paper = host.querySelector<HTMLElement>('.receipt-printer')!
    assert.equal(paper.inert, true)
    assert.equal(paper.style.getPropertyValue('--receipt-paper-width'), '360px')
    assert.equal(paper.style.getPropertyValue('--receipt-paper-height'), '560px')
    assert.equal(paper.dataset.leadingTop, '36.000')
    const copies = host.querySelectorAll<HTMLElement>('.receipt-paper-snapshot > section')
    assert.equal(copies.length, RECEIPT_PAPER_BANDS)
    for (const copy of copies) {
      assert.equal(copy.classList.contains('ritual-receipt-print-target'), false)
      assert.equal(copy.querySelector('[id],[for],[aria-controls],[aria-labelledby]'), null)
      assert.equal(copy.id, '')
      assert.equal(copy.hasAttribute('data-print-hidden'), false)
      assert.equal(copy.style.position, 'absolute')
      assert.equal(copy.style.visibility, 'visible')
      assert.equal(copy.style.width, '360px')
      assert.equal(copy.style.height, '560px')
      assert.equal(copy.style.boxShadow, 'none')
      assert.equal(copy.querySelector('input')!.getAttribute('value'), '29')
      assert.equal(
        copy.querySelector('input')!.disabled,
        false,
        'snapshot must not introduce disabled appearance',
      )
      assert.equal(copy.querySelector('input')!.tabIndex, -1)
    }
    assert.equal(target.id, 'actual-receipt')
    assert.equal(target.style.visibility, 'hidden')
    await wait(220)
    assert.equal(completed, 1)
    target.querySelector('h2')!.textContent = 'Updated localized receipt'
    await act(async () =>
      root.render(
        createElement(Printer, {
          ...props,
          focus: 30,
          targetRef,
          reducedMotion: true,
          onComplete() {
            completed++
          },
        }),
      ),
    )
    assert.ok(host.textContent!.includes('Updated localized receipt'))
    assert.equal(completed, 1, 'resnapshotting content must not restart the completion controller')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    target.remove()
  }
})

test('visual viewport panning moves the emergence origin to offsetTop plus height without restarting feed', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const viewport = Object.assign(new window.EventTarget(), { height: 500, offsetTop: 80 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(createElement(Printer, { ...props, reducedMotion: false, onComplete() {} })),
    )
    const paper = host.querySelector<HTMLElement>('.receipt-printer')!
    assert.equal(paper.dataset.leadingTop, '580.000')
    viewport.offsetTop = 100
    await act(async () => viewport.dispatchEvent(new window.Event('scroll')))
    assert.equal(paper.dataset.leadingTop, '600.000')
    assert.equal(paper.dataset.phase, 'waiting')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    if (previous) Object.defineProperty(window, 'visualViewport', previous)
    else Reflect.deleteProperty(window, 'visualViewport')
  }
})
