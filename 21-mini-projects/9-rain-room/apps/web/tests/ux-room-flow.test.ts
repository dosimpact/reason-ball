import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { defaults, fresh } from '../src/pages/focus/model/timer.ts'
await build({
  publicDir: false,
  plugins: [
    {
      name: 'room-artwork-fixture',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('/ui/RuntimeCafe.tsx'))
          return `import {createElement} from 'react';export default function Cafe(p){return createElement('div',{'data-testid':'room-artwork','data-paused':String(p.paused),'data-fullscreen':String(p.fullscreen)})}`
      },
    },
  ],
  build: {
    ssr: 'src/pages/focus/ui/ritual/ImmersiveRoom.tsx',
    outDir: 'node_modules/.cache/ux-room-flow',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
// Only transition time is controlled here; Room markup and i18n resources are production.
await build({
  publicDir: false,
  plugins: [
    {
      name: 'recovery-clock-fixture',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('/ui/RuntimeCafe.tsx'))
          return `import {createElement} from 'react';export default function Cafe(){return createElement('div',{'data-testid':'recovery-artwork'})}`
        if (id.endsWith('/ritual/useSceneTransition.ts'))
          return `
      import {useState} from 'react';import {i18n} from '@/shared/i18n';
      export function useSceneTransition(id){
        const [state,setState]=useState({displayedId:id,generation:0,phase:'idle',timedOut:true,busy:false});
        globalThis.__roomRecovery={setState,language:language=>i18n.changeLanguage(language)};
        return {...state,reducedMotion:true,sceneStatus(){},retry(){setState(s=>({...s,generation:s.generation+1,phase:'loading',timedOut:false,busy:true}))}};
      }`
      },
    },
  ],
  build: {
    ssr: 'src/pages/focus/ui/ritual/ImmersiveRoom.tsx',
    outDir: 'node_modules/.cache/ux-room-recovery',
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
  'Element',
  'Node',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'getComputedStyle',
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value:
      name === 'window'
        ? window
        : typeof window[name] === 'function' && name === 'getComputedStyle'
          ? window[name].bind(window)
          : window[name],
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createElement, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: Room } = await import('../node_modules/.cache/ux-room-flow/ImmersiveRoom.js')

test('seating hands focus to the room once; folded errors and completion remain accessible', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const props = {
    backgroundId: 'cafe-rain',
    backgroundName: 'Rain',
    coffeeCount: 0,
    order: null,
    session: { ...fresh('focus', defaults), status: 'running' },
    settings: defaults,
    playing: true,
    ambientPlaying: false,
    trackTitle: 'Study',
    error: '',
    blocked: true,
    onSceneStatus() {},
    onMusicToggle() {},
    onNext() {},
    onMode() {},
    onOpenSettings() {},
    onRandomBackground() {},
  }
  const render = async () => {
    await act(async () => root.render(createElement(Room, props)))
  }
  await render()
  props.blocked = false
  await render()
  assert.equal(document.activeElement, host.querySelector('main'))
  await act(async () => host.querySelector('.ritual-room-close').click())
  const restore = host.querySelector('.ritual-room-restore')
  assert.equal(document.activeElement, restore)
  props.error = 'Music could not load'
  props.session = { ...props.session, status: 'complete', remaining: 0 }
  await render()
  assert.equal(document.activeElement, restore, 'timer/error update must not steal focus')
  assert.equal(host.querySelector('.ritual-room-folded-error').textContent, props.error)
  assert.equal(restore.getAttribute('aria-describedby'), 'ritual-room-folded-error')
  const announcement = host.querySelector('.ritual-room-completion')
  assert.ok(announcement.textContent)
  assert.equal(announcement.getAttribute('aria-live'), 'polite')
  const message = announcement.textContent
  props.settings = { ...props.settings, music: 0.3 }
  await render()
  assert.equal(host.querySelector('.ritual-room-completion'), announcement)
  assert.equal(announcement.textContent, message)
  await act(async () => restore.click())
  assert.equal(host.querySelector('.ritual-room-completion'), announcement)
  assert.equal(host.querySelectorAll('.ritual-room-error').length, 1)
  assert.equal(host.querySelectorAll('.ritual-room-folded-error').length, 0)
  props.session = { ...props.session, phase: 'rest', status: 'running' }
  props.error = ''
  props.settingsOpen = true
  const opener = host.querySelector('.ritual-room-close')
  opener.focus()
  await render()
  props.settingsOpen = false
  await render()
  assert.equal(document.activeElement, opener, 'settings changes do not refocus room root')
  assert.equal(announcement.textContent, '')
  act(() => root.unmount())
  host.remove()
  await window.happyDOM.abort()
})

test('actual timeout recovery UI uses existing localized retry labels and starts a fresh generation', async () => {
  const { default: RecoveryRoom } = await import(
    '../node_modules/.cache/ux-room-recovery/ImmersiveRoom.js'
  )
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const props = {
    backgroundId: 'cafe-rain',
    backgroundName: 'Rain',
    coffeeCount: 0,
    order: null,
    session: fresh('focus', defaults),
    settings: defaults,
    playing: false,
    ambientPlaying: false,
    trackTitle: 'Study',
    error: '',
    blocked: false,
    onSceneStatus() {},
    onMusicToggle() {},
    onNext() {},
    onMode() {},
    onOpenSettings() {},
    onRandomBackground() {},
  }
  await act(async () => root.render(createElement(RecoveryRoom, props)))
  const control = () => globalThis.__roomRecovery
  for (const [language, label] of [
    ['ko', '그래픽 다시 시도'],
    ['en', 'Retry scene'],
    ['zh', '重新加载场景'],
  ]) {
    await act(async () => control().language(language))
    const button = host.querySelector('.ritual-room-scene-recovery button')
    assert.equal(button.textContent, label)
    assert.equal(button.disabled, false)
    assert.ok(!button.textContent.includes('scene.retry'))
  }
  await act(async () => host.querySelector('.ritual-room-scene-recovery button').click())
  assert.equal(host.querySelector('.ritual-room-scene-recovery'), null)
  assert.equal(host.querySelector('.ritual-scene-transition').getAttribute('data-phase'), 'loading')
  assert.equal(host.querySelector('.ritual-room-random').disabled, true)
  assert.equal(host.querySelectorAll('[data-testid="recovery-artwork"]').length, 1)
  act(() => root.unmount())
  host.remove()
  delete globalThis.__roomRecovery
  await window.happyDOM.abort()
})
