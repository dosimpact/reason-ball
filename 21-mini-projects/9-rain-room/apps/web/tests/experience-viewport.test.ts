import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { installExperienceViewport } from '../src/pages/focus/lib/experienceViewport.ts'

const property = (element: HTMLElement, key: string) =>
  element.style.getPropertyValue(`--rain-room-viewport-${key}`)

test('visible viewport resize, pan and rotation update root and portal coordinates once', () => {
  const window = new Window({ width: 390, height: 844 })
  const root = window.document.createElement('main')
  window.document.body.append(root)
  const viewport = new window.EventTarget() as EventTarget & {
    width: number
    height: number
    offsetLeft: number
    offsetTop: number
  }
  Object.assign(viewport, { width: 390, height: 700, offsetLeft: 0, offsetTop: 12 })
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
  const dispose = installExperienceViewport(root as unknown as HTMLElement)
  const check = (width: string, height: string, left: string, top: string) => {
    for (const target of [root, window.document.documentElement]) {
      assert.equal(property(target as unknown as HTMLElement, 'width'), width)
      assert.equal(property(target as unknown as HTMLElement, 'height'), height)
      assert.equal(property(target as unknown as HTMLElement, 'left'), left)
      assert.equal(property(target as unknown as HTMLElement, 'top'), top)
    }
  }
  check('390px', '700px', '0px', '12px')
  viewport.height = 360
  viewport.offsetTop = 35
  viewport.dispatchEvent(new window.Event('resize') as unknown as Event)
  check('390px', '360px', '0px', '35px')
  viewport.offsetLeft = 18
  viewport.dispatchEvent(new window.Event('scroll') as unknown as Event)
  check('390px', '360px', '18px', '35px')
  Object.assign(viewport, { width: 667, height: 320, offsetLeft: 0, offsetTop: 0 })
  window.dispatchEvent(new window.Event('orientationchange'))
  check('667px', '320px', '0px', '0px')
  dispose()
})

test('cleanup restores root/document styles and overflow priorities and removes every listener', () => {
  const window = new Window({ width: 320, height: 568 })
  const root = window.document.createElement('main')
  const document = window.document
  root.style.setProperty('--rain-room-viewport-top', '3px', 'important')
  document.documentElement.style.setProperty('--rain-room-viewport-height', '90vh')
  document.body.style.setProperty('overflow', 'auto', 'important')
  document.documentElement.style.overflow = 'clip'
  const viewport = new window.EventTarget()
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
  const added: string[] = [],
    removed: string[] = []
  for (const [target, name] of [
    [window, 'window'],
    [viewport, 'visual'],
  ] as const) {
    const add = target.addEventListener.bind(target),
      remove = target.removeEventListener.bind(target)
    target.addEventListener = ((type: string, ...args: unknown[]) => {
      added.push(`${name}:${type}`)
      return add(type, ...(args as [never]))
    }) as typeof target.addEventListener
    target.removeEventListener = ((type: string, ...args: unknown[]) => {
      removed.push(`${name}:${type}`)
      return remove(type, ...(args as [never]))
    }) as typeof target.removeEventListener
  }
  const dispose = installExperienceViewport(root as unknown as HTMLElement)
  assert.equal(document.body.style.overflow, 'hidden')
  dispose()
  dispose()
  assert.deepEqual(removed.sort(), added.sort())
  assert.equal(property(root as unknown as HTMLElement, 'top'), '3px')
  assert.equal(root.style.getPropertyPriority('--rain-room-viewport-top'), 'important')
  assert.equal(property(root as unknown as HTMLElement, 'width'), '')
  assert.equal(property(document.documentElement as unknown as HTMLElement, 'height'), '90vh')
  assert.equal(document.body.style.overflow, 'auto')
  assert.equal(document.body.style.getPropertyPriority('overflow'), 'important')
  assert.equal(document.documentElement.style.overflow, 'clip')
  window.dispatchEvent(new window.Event('resize'))
  viewport.dispatchEvent(new window.Event('scroll'))
  assert.equal(
    property(root as unknown as HTMLElement, 'top'),
    '3px',
    'disposed listeners cannot write styles',
  )
})

test('missing or invalid visual viewport values safely use the owning window dimensions', () => {
  const window = new Window({ width: 360, height: 640 })
  const root = window.document.createElement('main')
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
  let dispose = installExperienceViewport(root as unknown as HTMLElement)
  assert.equal(property(root as unknown as HTMLElement, 'width'), '360px')
  assert.equal(property(root as unknown as HTMLElement, 'height'), '640px')
  dispose()
  Object.defineProperty(window, 'visualViewport', {
    value: {
      width: NaN,
      height: 0,
      offsetTop: NaN,
      offsetLeft: -10,
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  })
  dispose = installExperienceViewport(root as unknown as HTMLElement)
  assert.equal(property(root as unknown as HTMLElement, 'height'), '640px')
  assert.equal(property(root as unknown as HTMLElement, 'left'), '0px')
  assert.equal(property(root as unknown as HTMLElement, 'top'), '0px')
  dispose()
})
