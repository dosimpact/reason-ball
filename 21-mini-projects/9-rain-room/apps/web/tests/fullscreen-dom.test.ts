import { ALL_BACKGROUNDS, getBackground } from '../src/pages/focus/model/backgrounds.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { MUSIC_TRACKS, MUSIC_CATEGORIES } from '../src/pages/focus/model/music.ts'
import { AMBIENT_SOUNDS } from '../src/pages/focus/model/ambient.ts'

// Compiles the real App, including its portals and hooks, without a browser binary.
await build({
  publicDir: false,
  build: {
    ssr: 'src/app/App.tsx',
    outDir: 'node_modules/.cache/fullscreen-dom',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000/legacy' })
Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['ko-KR'] })
Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'ko-KR' })
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'Element',
  'SVGElement',
  'NodeFilter',
  'MutationObserver',
  'ResizeObserver',
  'CustomEvent',
  'FocusEvent',
  'Node',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'localStorage',
  'Audio',
] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: name === 'window' ? window : window[name],
  })
}
for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: window[name].bind(window),
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  writable: true,
  value: true,
})
const { createElement, StrictMode, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: App } = await import('../node_modules/.cache/fullscreen-dom/App.js')
const document = window.document

async function fixture(
  mode: 'unsupported' | 'rejected' | 'native',
  run: (host: HTMLElement, native: { entries: number; exits: number }) => Promise<void>,
  path = '/legacy',
  saved?: unknown,
) {
  window.history.replaceState(null, '', path)
  document.body.innerHTML = '<div id="root"></div>'
  localStorage.clear()
  localStorage.setItem('rain-room.language', 'ko')
  await act(async () =>
    window.dispatchEvent(
      new window.StorageEvent('storage', { key: 'rain-room.language', newValue: 'ko' }),
    ),
  )
  if (saved) localStorage.setItem('rain-room.v1', JSON.stringify(saved))
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Desktop Chrome',
  })
  Object.defineProperty(window.navigator, 'platform', { configurable: true, value: 'MacIntel' })
  Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 0 })
  const native = { entries: 0, exits: 0 }
  let fullscreenElement: HTMLElement | null = null
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  })
  Object.defineProperty(window.HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value:
      mode === 'unsupported'
        ? undefined
        : async function (this: HTMLElement) {
            native.entries++
            if (mode === 'rejected') throw new Error('Fullscreen denied')
            fullscreenElement = this
            document.dispatchEvent(new window.Event('fullscreenchange'))
          },
  })
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: async () => {
      native.exits++
      fullscreenElement = null
      document.dispatchEvent(new window.Event('fullscreenchange'))
    },
  })
  const host = document.getElementById('root')!
  const root = createRoot(host)
  await act(async () => root.render(createElement(StrictMode, null, createElement(App))))
  try {
    await run(host as unknown as HTMLElement, native)
  } finally {
    await act(async () => root.unmount())
    await window.happyDOM.abort()
  }
}
function entry() {
  return document.querySelector<HTMLButtonElement>('[aria-label="배경 전체화면"]')!
}
async function click(button: Element) {
  // Header actions now require the same disclosure step as a real user.
  if (button.closest('.header-settings-panel')?.hasAttribute('hidden'))
    await click(document.querySelector('.settings-gear')!)
  await act(async () => {
    button.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }))
    button.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }))
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
for (const mode of ['unsupported', 'rejected', 'native'] as const) {
  test(`real App UI fullscreen does not call browser APIs even when ${mode}`, async () => {
    await fixture(mode, async (host, native) => {
      const button = entry()
      button.focus()
      await click(button)
      const overlay = document.querySelector('[data-testid="scene-fullscreen"]')
      assert.ok(overlay, 'click must mount the portal')
      assert.ok(
        overlay.parentElement === document.body,
        'DOM identity must match the expected element or absence',
      )
      assert.equal(host.inert, true)
      assert.equal(document.querySelectorAll('[data-testid="cafe-scene"]').length, 1)
      assert.equal(document.body.style.overflow, 'hidden')
      assert.ok(overlay.querySelector('[aria-label="전체화면 음악 재생"]'))
      assert.equal(native.entries, 0)
      assert.equal(document.fullscreenElement, null)
      await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
      assert.ok(
        document.querySelector('[data-testid="scene-fullscreen"]') === null,
        'DOM identity must match the expected element or absence',
      )
      assert.equal(host.inert, false)
      assert.equal(document.body.style.overflow, '')
      assert.ok(
        document.activeElement === button,
        'DOM identity must match the expected element or absence',
      )
      assert.equal(document.querySelectorAll('[data-testid="cafe-scene"]').length, 1)
      assert.equal(native.exits, 0)
    })
  })
}

test('legacy comparison: iOS Chrome uses the same explicitly sized layered scene as desktop without native fullscreen', async () => {
  await fixture(
    'native',
    async (_host, native) => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/142.0 Mobile Safari/604.1',
      })
      await click(entry())
      const overlay = document.querySelector<HTMLElement>('[data-testid="scene-fullscreen"]')!
      assert.equal(overlay.dataset.renderMode, 'layered-viewport')
      assert.equal(native.entries, 0)
      assert.equal(
        overlay.style.getPropertyValue('--scene-viewport-height'),
        `${window.innerHeight}px`,
      )
      const image = overlay.querySelector<HTMLImageElement>(
        '[data-testid="cafe-scene"] img.scene-artwork',
      )!
      assert.ok(image)
      assert.equal(image.getAttribute('src'), '/backgrounds/rear/fullscreen/cafe-rain.png')
      assert.equal(image.width, 1200)
      assert.equal(image.height, 1230)
      assert.equal(overlay.querySelector('.cafe')?.getAttribute('data-resolution'), 'fullscreen')
      assert.ok(overlay.querySelector('[data-testid="rain-overlay"]'))
      assert.ok(
        overlay.querySelector('[data-testid="rain-overlay"] filter') === null,
        'DOM identity must match the expected element or absence',
      )
      await act(async () => image.dispatchEvent(new window.Event('load')))
      assert.ok(
        overlay.querySelector('.fullscreen-loading') === null,
        'DOM identity must match the expected element or absence',
      )
      await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
      assert.ok(
        document.querySelector('[data-testid="scene-fullscreen"]') === null,
        'DOM identity must match the expected element or absence',
      )
    },
    '/legacy?renderer=legacy',
  )
})

test('legacy comparison: rear PNG error restores the complete original SVG scene', async () => {
  await fixture(
    'native',
    async () => {
      Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'iPad' })
      await click(entry())
      const image = document.querySelector('[data-testid="cafe-scene"] img.scene-artwork')!
      await act(async () => image.dispatchEvent(new window.Event('error')))
      assert.ok(
        document.querySelector('[data-testid="cafe-scene"] img.scene-artwork') === null,
        'DOM identity must match the expected element or absence',
      )
      assert.ok(document.querySelector('[data-testid="cafe-scene"] svg'))
      assert.ok(
        document.querySelector('[data-testid="cafe-scene"] img.scene-artwork') === null,
        'DOM identity must match the expected element or absence',
      )
    },
    '/legacy?renderer=legacy',
  )
})

test('actual controls hide, reveal safely on the first tap, and support keyboard focus and Escape', async () => {
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  let job: (() => void) | null = null
  const token = {} as ReturnType<typeof setTimeout>
  globalThis.setTimeout = ((
    fn: (...args: unknown[]) => void,
    delay: number,
    ...args: unknown[]
  ) => {
    if (delay === 2500) {
      job = () => fn(...args)
      return token
    }
    return originalSetTimeout(fn, delay, ...args)
  }) as typeof setTimeout
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    if (id === token) job = null
    else originalClearTimeout(id)
  }) as typeof clearTimeout
  try {
    await fixture('unsupported', async (host) => {
      const button = entry()
      button.focus()
      await click(button)
      const overlay = document.querySelector<HTMLElement>('[data-testid="scene-fullscreen"]')!
      const controls = document.querySelector<HTMLElement>('[data-testid="fullscreen-controls"]')!
      await act(async () =>
        overlay.querySelector<HTMLButtonElement>('[data-mode=repeat-one]')!.focus(),
      )
      assert.ok(document.querySelector('.playback-tooltip'))
      await act(async () => {
        job?.()
      })
      assert.ok(
        document.querySelector('.playback-tooltip') !== null,
        'persistent player keeps its focused tooltip when top chrome hides',
      )
      assert.equal(controls.dataset.visible, 'false')
      assert.equal(controls.inert, true)
      await click(overlay.querySelector('[data-testid="cafe-scene"]')!)
      assert.equal(controls.dataset.visible, 'true')
      assert.equal(controls.inert, false)
      assert.ok(
        document.querySelector('[aria-label="전체화면 음악 재생"]'),
        'reveal tap must not start playback',
      )
      await act(async () => {
        job?.()
      })
      assert.equal(controls.dataset.visible, 'false')
      await act(async () => overlay.focus())
      await act(async () =>
        document.dispatchEvent(
          new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
        ),
      )
      assert.equal(controls.dataset.visible, 'true')
      assert.equal(document.activeElement?.getAttribute('aria-label'), '전체화면 나가기')
      assert.equal(job, null, 'keyboard-focused controls must not auto-hide')
      await act(async () =>
        document.dispatchEvent(
          new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        ),
      )
      assert.ok(
        document.querySelector('[data-testid="scene-fullscreen"]') === null,
        'DOM identity must match the expected element or absence',
      )
      assert.equal(host.inert, false)
      assert.ok(
        document.activeElement === button,
        'DOM identity must match the expected element or absence',
      )
    })
  } finally {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test('UI fullscreen ignores browser fullscreen events and leaves preexisting native state alone', async () => {
  await fixture('native', async (host, native) => {
    const outer = document.documentElement
    await outer.requestFullscreen()
    assert.equal(native.entries, 1)
    await click(entry())
    assert.equal(native.entries, 1, 'UI entry must not request native fullscreen')
    assert.equal(document.fullscreenElement, outer)
    await act(async () => document.dispatchEvent(new window.Event('fullscreenchange')))
    assert.ok(document.querySelector('[data-testid="scene-fullscreen"]'))
    await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
    assert.equal(
      document.fullscreenElement,
      outer,
      'UI exit must preserve unrelated native fullscreen',
    )
    assert.equal(native.exits, 0)
    assert.equal(host.inert, false)
    await click(entry())
    await act(async () => document.exitFullscreen())
    assert.ok(
      document.querySelector('[data-testid="scene-fullscreen"]'),
      'external native exit must not close the UI overlay',
    )
    await act(async () =>
      document.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    assert.ok(
      document.querySelector('[data-testid="scene-fullscreen"]') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.equal(native.exits, 1, 'only the test invoked native exit')
    assert.equal(host.inert, false)
    assert.equal(document.body.style.overflow, '')
  })
})

test('music and ambience open isolated modal views and restore their own entry focus', async () => {
  await fixture('unsupported', async () => {
    const musicEntry = document.querySelector<HTMLButtonElement>('header [aria-label="음악 선택"]')!
    await click(musicEntry)
    let dialog = document.querySelector<HTMLDivElement>('.settings-dialog[data-state="open"]')!
    assert.ok(dialog)
    assert.equal(dialog.querySelector('#sheet-title')?.textContent, '음악 선택')
    assert.ok(dialog.querySelector('[data-testid="music-settings"]'))
    assert.ok(dialog.querySelector('[aria-label="음악 볼륨"]'))
    assert.ok(
      dialog.querySelector('[data-testid="ambient-settings"]') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.ok(
      dialog.querySelector('[aria-label="빗소리"]') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.ok(
      dialog.querySelector('[aria-label="빗소리 볼륨"]') === null,
      'DOM identity must match the expected element or absence',
    )
    await click(dialog.querySelector('[aria-label="설정 닫기"]')!)
    assert.ok(
      document.querySelector('.settings-dialog[data-state="open"]') === null,
      'DOM identity must match the expected element or absence',
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.ok(
      document.activeElement === document.querySelector('header [aria-label="설정"]'),
      `focus must return to gear; got ${document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName}`,
    )

    const ambientEntry = document.querySelector<HTMLButtonElement>(
      'header [aria-label="환경음 설정"]',
    )!
    await click(ambientEntry)
    dialog = document.querySelector<HTMLDivElement>('.settings-dialog[data-state="open"]')!
    assert.equal(dialog.querySelector('#sheet-title')?.textContent, '환경음 믹서')
    assert.ok(dialog.querySelector('[data-testid="ambient-settings"]'))
    assert.equal(dialog.querySelectorAll('input[type="checkbox"]').length, AMBIENT_SOUNDS.length)
    assert.equal(dialog.querySelectorAll('input[type="range"]').length, 1)
    assert.ok(dialog.querySelector('[aria-label="빗소리 볼륨"]'))
    assert.ok(
      dialog.querySelector('[aria-label="귀뚜라미 볼륨"]') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.ok(
      dialog.querySelector('[data-testid="music-settings"]') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.ok(
      dialog.querySelector('.music-library') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.ok(
      dialog.querySelector('[aria-label="음악 볼륨"]') === null,
      'DOM identity must match the expected element or absence',
    )
    await act(async () =>
      dialog.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    assert.ok(
      document.querySelector('.settings-dialog[data-state="open"]') === null,
      'DOM identity must match the expected element or absence',
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.ok(
      document.activeElement === document.querySelector('header [aria-label="설정"]'),
      `focus must return to gear; got ${document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName}`,
    )
  })
})

test('switching music and ambience modals preserves selected settings and the existing audio transport', async () => {
  const OriginalAudio = globalThis.Audio
  const created: { element: HTMLAudioElement; plays: number; pauses: number }[] = []
  globalThis.Audio = function () {
    const element = new window.Audio()
    const record = { element: element as unknown as HTMLAudioElement, plays: 0, pauses: 0 }
    let paused = true
    Object.defineProperty(element, 'paused', { configurable: true, get: () => paused })
    element.play = async () => {
      record.plays++
      paused = false
      element.dispatchEvent(new window.Event('playing'))
    }
    element.pause = () => {
      record.pauses++
      paused = true
      element.dispatchEvent(new window.Event('pause'))
    }
    created.push(record)
    return element
  } as unknown as typeof Audio
  try {
    await fixture('unsupported', async () => {
      await click(document.querySelector('[aria-label="음악 재생"]')!)
      const live = created.at(-1)!
      assert.equal(live.plays, 1)
      const count = created.length
      await click(document.querySelector('header [aria-label="음악 선택"]')!)
      const beforeTrack = JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track
      const row = document.querySelector('[data-testid="music-playlist"] li')!
      await click(row)
      assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track, beforeTrack)
      await click(document.querySelector('.shuffle-play')!)
      const playlistTrack = JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track
      const playlistTitle = document.querySelector('.track-info strong')!.textContent
      await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
      const playCount = live.plays
      const pauseCount = live.pauses
      await click(document.querySelector('header [aria-label="환경음 설정"]')!)
      await act(async () =>
        document
          .querySelector<HTMLInputElement>('.settings-dialog [aria-label="귀뚜라미"]')!
          .click(),
      )
      const saved = JSON.parse(localStorage.getItem('rain-room.v1')!).settings
      assert.equal(saved.ambient.crickets.enabled, true)
      assert.equal(saved.track, playlistTrack)
      await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
      await click(document.querySelector('.track-info')!)
      assert.ok(document.querySelector('[data-testid="music-settings"]'))
      assert.equal(
        document.querySelector('[data-testid="music-playlist"] [aria-current="true"] strong')
          ?.textContent,
        playlistTitle,
      )
      assert.equal(created.length, count, 'opening panels must not create an audio engine')
      assert.equal(live.plays, playCount, 'opening panels must not restart playback')
      assert.equal(live.pauses, pauseCount, 'opening panels must not pause playback')
      assert.equal(live.element.paused, false)
      assert.equal(
        JSON.parse(localStorage.getItem('rain-room.v1')!).settings.ambient.crickets.enabled,
        true,
      )
    })
  } finally {
    globalThis.Audio = OriginalAudio
  }
})

async function queueFixture(
  run: (
    live: () => { element: HTMLAudioElement; plays: number; pauses: number; finish: () => void },
  ) => Promise<void>,
) {
  const OriginalAudio = globalThis.Audio
  const originalRandom = Math.random
  const records: {
    element: HTMLAudioElement
    plays: number
    pauses: number
    finish: () => void
  }[] = []
  Math.random = () => 0.99999
  globalThis.Audio = function () {
    const element = new window.Audio()
    let paused = true
    let ended = false
    let src = ''
    const record = {
      element: element as unknown as HTMLAudioElement,
      plays: 0,
      pauses: 0,
      finish: () => {
        ended = true
        paused = true
        element.dispatchEvent(new window.Event('ended'))
      },
    }
    Object.defineProperty(element, 'paused', { configurable: true, get: () => paused })
    Object.defineProperty(element, 'ended', { configurable: true, get: () => ended })
    Object.defineProperty(element, 'src', {
      configurable: true,
      get: () => src,
      set: (value) => {
        src = value
        ended = false
      },
    })
    element.play = async () => {
      record.plays++
      paused = false
      ended = false
      element.dispatchEvent(new window.Event('playing'))
    }
    element.pause = () => {
      record.pauses++
      paused = true
      element.dispatchEvent(new window.Event('pause'))
    }
    records.push(record)
    return element
  } as unknown as typeof Audio
  try {
    await fixture('unsupported', async () => run(() => records.at(-1)!))
  } finally {
    globalThis.Audio = OriginalAudio
    Math.random = originalRandom
  }
}
const activeQueueId = () =>
  document.querySelector<HTMLElement>('[data-testid="music-playlist"] li[aria-current="true"]')!
    .dataset.trackId!
async function setMode(mode: string, fullscreen = false) {
  await click(
    document.querySelector(
      `[aria-label="${fullscreen ? '전체화면' : '메인'} 재생 방식"] [data-mode="${mode}"]`,
    )!,
  )
}
test('category shuffle plays each song once, persists current title and survives panel and fullscreen transitions', async () => {
  await queueFixture(async (live) => {
    await click(document.querySelector('header [aria-label="음악 선택"]')!)
    assert.ok(
      document.querySelector('[role="tablist"],.music-search,.music-tags') === null,
      'DOM identity must match the expected element or absence',
    )
    await click(document.querySelector('.shuffle-play')!)
    const ids = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="music-playlist"] li[data-track-id]',
        ),
      ].map((row) => row.dataset.trackId!)
    const count = ids().length
    assert.equal(count, MUSIC_TRACKS.length)
    assert.equal(document.querySelectorAll('.music-categories button').length, 5)
    assert.equal(
      document.querySelector('[data-testid="music-playlist"]')!.getAttribute('data-order'),
      'queue',
    )
    assert.deepEqual([...ids()].sort(), MUSIC_TRACKS.map((track) => track.id).sort())
    const seen = []
    for (let i = 0; i < count; i++) {
      seen.push(activeQueueId())
      assert.equal(
        JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track,
        activeQueueId(),
      )
      await act(async () => live().finish())
    }
    assert.equal(new Set(seen).size, count)
    assert.notEqual(activeQueueId(), seen.at(-1))
    const plays = live().plays
    await click([...document.querySelectorAll('.music-categories button')][1])
    assert.equal(
      document.querySelector('[data-testid="music-playlist"]')!.getAttribute('data-order'),
      'catalog',
    )
    assert.equal(live().plays, plays)
    assert.equal(document.querySelectorAll('.music-library .scroll-track-list').length, 1)
    assert.equal(
      document.querySelectorAll('.music-playlist button[aria-pressed]').length,
      ids().length,
    )
    const timer = document.querySelector('[role="timer"]')!.textContent
    const track = JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track
    await click(document.querySelector('.music-playlist li button')!)
    assert.equal(live().plays, plays)
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track, track)
    assert.equal(document.querySelector('[role="timer"]')!.textContent, timer)
    await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
    await click(entry())
    await act(async () => live().finish())
    assert.equal(
      document.querySelector('.fullscreen-track strong')!.textContent,
      document.querySelector('.track-info strong')!.textContent,
    )
    await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
    await click(document.querySelector('header [aria-label="음악 선택"]')!)
    assert.equal(ids().length, MUSIC_TRACKS.length)
  })
})
test('repeat one repeats on ended; next advances while paused and late ended cannot restart audio', async () => {
  await queueFixture(async (live) => {
    await click(document.querySelector('[aria-label="음악 재생"]')!)
    const first = JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track
    await act(async () => live().finish())
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track, first)
    await click(document.querySelector('[aria-label="음악 일시정지"]')!)
    const plays = live().plays
    await click(document.querySelector('[aria-label="다음 곡"]')!)
    assert.notEqual(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track, first)
    assert.equal(live().plays, plays)
    assert.equal(live().element.paused, true)
    await act(async () => live().finish())
    assert.equal(live().plays, plays)
  })
})

test('app composition routes the design-system URL through its public page API', async () => {
  await fixture(
    'unsupported',
    async () => {
      assert.ok(document.querySelector('.design-system-page'))
      assert.ok(document.querySelector('.palette-grid'))
      assert.ok(!document.querySelector('[data-testid="timer-card"]'))
      assert.ok(!document.querySelector('[aria-label="배경 전체화면"]'))
      assert.equal(document.querySelector('.gallery-back')?.getAttribute('href'), '/')
    },
    '/design-system',
  )
})

test('category filters wait for explicit shuffle and modes preserve current position, volume and timer', async () => {
  await queueFixture(async (live) => {
    await click(document.querySelector('[aria-label="음악 재생"]')!)
    live().element.currentTime = 42
    const plays = live().plays
    const pauses = live().pauses
    const timer = document.querySelector('[role="timer"]')!.textContent
    await setMode('shuffle')
    await setMode('sequential')
    assert.equal(live().plays, plays)
    assert.equal(live().pauses, pauses)
    assert.equal(live().element.currentTime, 42)
    assert.equal(document.querySelector('[role="timer"]')!.textContent, timer)
    await click(document.querySelector('header [aria-label="음악 선택"]')!)
    await click(
      [...document.querySelectorAll('.music-categories button')].find(
        (button) => button.textContent === '포근한 쉼',
      )!,
    )
    assert.equal(live().plays, plays)
    const eligible = [
      ...document.querySelectorAll<HTMLElement>('[aria-label="플레이리스트 곡 목록"] li'),
    ].map((row) => row.dataset.trackId!)
    await click(document.querySelector('.shuffle-play')!)
    assert.deepEqual(
      [...document.querySelectorAll<HTMLElement>('[data-testid="music-playlist"] li')]
        .map((row) => row.dataset.trackId!)
        .sort(),
      eligible.sort(),
    )
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.playbackMode, 'shuffle')
    await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
    await setMode('sequential')
    await click(entry())
    assert.equal(
      document
        .querySelector('[aria-label="전체화면 재생 방식"] [data-mode="sequential"]')!
        .getAttribute('aria-pressed'),
      'true',
    )
    const before = JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track
    await click(document.querySelector('[aria-label="전체화면 다음 곡"]')!)
    assert.notEqual(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track, before)
    assert.equal(live().element.volume, 0.65)
  })
})
test('persisted playback mode restores without autoplay and invalid modes safely default', async () => {
  let saved: unknown
  await queueFixture(async () => {
    await setMode('sequential')
    saved = JSON.parse(localStorage.getItem('rain-room.v1')!)
  })
  await fixture(
    'unsupported',
    async () => {
      assert.equal(
        document
          .querySelector('[aria-label="메인 재생 방식"] [data-mode="sequential"]')!
          .getAttribute('aria-pressed'),
        'true',
      )
      assert.ok(document.querySelector('[aria-label="음악 재생"]'))
    },
    '/legacy',
    saved,
  )
})

async function saveTimeForm() {
  await act(async () =>
    document
      .querySelector('.settings-dialog form')!
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
  )
}
test('saving time resets a running focus immediately, keeps music playing and restores the new deadline on reload', async () => {
  let saved: any
  await queueFixture(async (live) => {
    await click(document.querySelector('[aria-label="음악 재생"]')!)
    await click(document.querySelector('.timer-actions>.primary')!)
    assert.equal(document.querySelector('.timer-actions>.primary')?.textContent, '잠시 멈추기')
    const plays = live().plays
    const pauses = live().pauses
    await click(document.querySelector('header [aria-label="시간 설정"]')!)
    const originalDeadline = JSON.parse(localStorage.getItem('rain-room.v1')!).session.deadline
    await saveTimeForm()
    assert.equal(
      JSON.parse(localStorage.getItem('rain-room.v1')!).session.deadline,
      originalDeadline,
      'unchanged save must preserve the current deadline',
    )
    await click(document.querySelector('header [aria-label="시간 설정"]')!)
    const preset = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.settings-dialog .presets button'),
    ).find((button) => button.textContent === '15분')!
    await click(preset)
    const before = Date.now()
    await saveTimeForm()
    saved = JSON.parse(localStorage.getItem('rain-room.v1')!)
    assert.equal(saved.settings.focus, 15)
    assert.equal(saved.session.phase, 'focus')
    assert.equal(saved.session.status, 'running')
    assert.equal(saved.session.duration, 15 * 60000)
    assert.ok(saved.session.deadline >= before + 15 * 60000)
    assert.ok(saved.session.deadline <= Date.now() + 15 * 60000)
    assert.equal(document.querySelector('[role="timer"]')?.textContent, '15:00')
    assert.equal(live().plays, plays)
    assert.equal(live().pauses, pauses)
    assert.equal(live().element.paused, false)
  })
  await fixture(
    'unsupported',
    async () => {
      const restored = JSON.parse(localStorage.getItem('rain-room.v1')!)
      assert.equal(restored.session.deadline, saved.session.deadline)
      assert.equal(restored.session.status, 'running')
      assert.equal(document.querySelector('.timer-actions>.primary')?.textContent, '잠시 멈추기')
      assert.ok(
        document.querySelector('[aria-label="음악 재생"]'),
        'restoring a running timer must not autoplay audio',
      )
    },
    '/legacy',
    saved,
  )
})
test('changing focus duration during a running rest resets the rest fully and keeps it running', async () => {
  const { defaults, fresh } = await import('../src/pages/focus/model/timer.ts')
  const saved = {
    version: 3,
    settings: defaults,
    session: {
      ...fresh('rest', defaults),
      status: 'running',
      remaining: 45000,
      deadline: Date.now() + 45000,
    },
  }
  await fixture(
    'unsupported',
    async () => {
      await click(document.querySelector('header [aria-label="시간 설정"]')!)
      await click(
        Array.from(
          document.querySelectorAll<HTMLButtonElement>('.settings-dialog .presets button'),
        ).find((button) => button.textContent === '25분')!,
      )
      await saveTimeForm()
      const stored = JSON.parse(localStorage.getItem('rain-room.v1')!)
      assert.equal(stored.settings.focus, 25)
      assert.equal(stored.session.phase, 'rest')
      assert.equal(stored.session.status, 'running')
      assert.equal(stored.session.duration, 5 * 60000)
      assert.equal(document.querySelector('[role="timer"]')?.textContent, '05:00')
      assert.equal(document.querySelector('.timer-actions>.primary')?.textContent, '잠시 멈추기')
    },
    '/legacy',
    saved,
  )
})
test('main ambience summary shows selected icons and names and clear empty guidance', async () => {
  await fixture('unsupported', async () => {
    const summary = document.querySelector<HTMLButtonElement>('.ambient-summary')!
    assert.equal(summary.querySelectorAll('.ambient-summary-pill').length, 1)
    assert.equal(summary.querySelector('.ambient-summary-pill')?.textContent, '빗소리')
    assert.ok(summary.querySelector('.ambient-summary-pill svg[aria-hidden="true"]'))
    await click(summary)
    await act(async () =>
      document.querySelector<HTMLInputElement>('.settings-dialog [aria-label="귀뚜라미"]')!.click(),
    )
    await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
    assert.equal(summary.querySelectorAll('.ambient-summary-pill').length, 2)
    assert.equal(summary.querySelectorAll('.ambient-summary-pill svg').length, 2)
    await click(summary)
    await act(async () => {
      document.querySelector<HTMLInputElement>('.settings-dialog [aria-label="빗소리"]')!.click()
      document.querySelector<HTMLInputElement>('.settings-dialog [aria-label="귀뚜라미"]')!.click()
    })
    await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
    assert.equal(summary.querySelectorAll('.ambient-summary-pill').length, 0)
    assert.equal(
      summary.querySelector('.ambient-summary-empty')?.textContent,
      '소리를 선택해 주세요',
    )
  })
})
test('background picker reopens the selected real category without an all filter', async () => {
  await fixture('unsupported', async () => {
    await click(document.querySelector('.change-background')!)
    const categories = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.background-categories button'),
    )
    assert.equal(categories.length, 6)
    assert.ok(categories.every((button) => button.textContent !== '전체'))
    assert.equal(
      document.querySelectorAll('.background-card').length,
      ALL_BACKGROUNDS.filter(
        (background) =>
          background.category ===
          getBackground(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.background)
            .category,
      ).length,
    )
    const forest = categories.find((button) => button.textContent === '숲 전망실')!
    assert.ok(forest)
    await click(forest)
    const selected = document.querySelector<HTMLButtonElement>('.background-card')!
    const label = selected.querySelector('.background-card-name')!.textContent
    await click(selected)
    assert.equal(
      Boolean(document.querySelector('.settings-dialog')),
      false,
      'choosing a space closes its dialog immediately',
    )
    assert.equal(document.querySelector('.scene-name')?.textContent, label)
    await click(document.querySelector('.change-background')!)
    assert.equal(
      document.querySelector('.background-categories [aria-pressed="true"]')?.textContent,
      '숲 전망실',
    )
    assert.equal(
      document.querySelectorAll('.background-card').length,
      ALL_BACKGROUNDS.filter((background) => background.category === 'forest').length,
    )
    assert.equal(
      document.querySelector('.background-card[aria-pressed="true"] .background-card-name')
        ?.textContent,
      label,
    )
  })
})

async function changeRange(input: HTMLInputElement, value: number) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      String(value),
    )
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function openMainVolume() {
  const trigger = document.querySelector<HTMLButtonElement>(
    '.sound-more[aria-label="음악 볼륨 조절"]',
  )!
  if (trigger.getAttribute('aria-expanded') !== 'true') await click(trigger)
  return document.querySelector<HTMLInputElement>('[aria-label="메인 음악 볼륨"]')!
}
test('music volume popover synchronizes with settings, fullscreen and saved reload without restarting audio', async () => {
  let saved: any
  await queueFixture(async (live) => {
    assert.ok(!document.querySelector('[aria-label="메인 음악 볼륨"]'))
    let main = await openMainVolume()
    assert.ok(main)
    assert.equal(main.min, '0')
    assert.equal(main.max, '1')
    assert.equal(Number(main.step), 0.01)
    const original = JSON.parse(localStorage.getItem('rain-room.v1')!)
    await changeRange(main, 0)
    assert.equal(live().element.volume, 0)
    assert.equal(live().plays, 0, 'volume adjustment must not autoplay')
    assert.equal(document.querySelector('.music-volume-percentage')?.textContent, '0%')
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.music, 0)
    await click(document.querySelector('[aria-label="음악 재생"]')!)
    assert.equal(live().plays, 1)
    const pauses = live().pauses
    main = await openMainVolume()
    await changeRange(main, 0.25)
    assert.equal(live().element.volume, 0.25)
    assert.equal(live().plays, 1)
    await click(document.querySelector('header [aria-label="음악 선택"]')!)
    assert.ok(!document.querySelector('[data-testid="music-volume-popover"]'))
    const modal = document.querySelector<HTMLInputElement>(
      '.settings-dialog [aria-label="음악 볼륨"]',
    )!
    assert.equal(modal.value, '0.25')
    await changeRange(modal, 0.42)
    assert.equal(live().element.volume, 0.42)
    await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
    main = await openMainVolume()
    assert.equal(main.value, '0.42')
    assert.equal(document.querySelector('.music-volume-percentage')?.textContent, '42%')
    await click(entry())
    assert.ok(!document.querySelector('[data-testid="music-volume-popover"]'))
    const fullscreen = document.querySelector<HTMLInputElement>(
      '[aria-label="전체화면 음악 볼륨"]',
    )!
    assert.equal(fullscreen.value, '0.42')
    await changeRange(fullscreen, 1)
    assert.equal(live().element.volume, 1)
    await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
    main = await openMainVolume()
    assert.equal(main.value, '1')
    assert.equal(document.querySelector('.music-volume-percentage')?.textContent, '100%')
    assert.equal(live().plays, 1, 'volume controls must preserve the transport')
    assert.equal(live().pauses, pauses)
    saved = JSON.parse(localStorage.getItem('rain-room.v1')!)
    assert.equal(saved.settings.track, original.settings.track)
    assert.deepEqual(saved.session, original.session)
    assert.equal(saved.settings.music, 1)
  })
  await fixture(
    'unsupported',
    async () => {
      assert.ok(!document.querySelector('[aria-label="메인 음악 볼륨"]'))
      const restored = await openMainVolume()
      assert.equal(restored.value, '1')
      assert.equal(document.querySelector('.music-volume-percentage')?.textContent, '100%')
      assert.ok(document.querySelector('[aria-label="음악 재생"]'))
    },
    '/legacy',
    saved,
  )
})
test('music volume popover toggles, stays open during slider drag and dismisses on outside, Escape or focus departure', async () => {
  await fixture('unsupported', async () => {
    const trigger = document.querySelector<HTMLButtonElement>('.sound-more')!
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    const slider = await openMainVolume()
    const popup = document.querySelector('[data-testid="music-volume-popover"]')!
    assert.equal(popup.id, trigger.getAttribute('aria-controls'))
    assert.ok(
      document.activeElement === slider,
      'DOM identity must match the expected element or absence',
    )
    await act(async () => {
      slider.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }))
      document.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true }))
      document.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }))
    })
    await changeRange(slider, 0.31)
    assert.ok(document.querySelector('[data-testid="music-volume-popover"]'))
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.music, 0.31)
    // Radix defers left-pointer outside dismissal until the complete click gesture.
    await click(document.body)
    assert.ok(!document.querySelector('[data-testid="music-volume-popover"]'))
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    await openMainVolume()
    await act(async () =>
      document.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.ok(!document.querySelector('[data-testid="music-volume-popover"]'))
    assert.ok(
      document.activeElement === trigger,
      'DOM identity must match the expected element or absence',
    )
    await openMainVolume()
    await click(trigger)
    assert.ok(!document.querySelector('[data-testid="music-volume-popover"]'))
    await openMainVolume()
    await act(async () =>
      document.querySelector<HTMLButtonElement>('header [aria-label="설정"]')!.focus(),
    )
    assert.ok(!document.querySelector('[data-testid="music-volume-popover"]'))
    assert.ok(
      !document.querySelector('.settings-dialog[data-state="open"]'),
      'focus departure alone must not open settings',
    )
  })
})

test('viewport rain follows actual music transport, ignores ambience-only playback and cannot become an interactive foreground', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () =>
    ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response
  const previousContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const previousVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  const { readFile } = await import('node:fs/promises')
  const stylesheet = document.createElement('style')
  stylesheet.textContent = await readFile(
    new URL('../src/pages/focus/ui/viewport-rain.css', import.meta.url),
    'utf8',
  )
  document.head.appendChild(stylesheet)
  class AudioNode {
    gain = { value: 0, setTargetAtTime() {} }
    threshold = { value: 0 }
    knee = { value: 0 }
    ratio = { value: 0 }
    connect(node: unknown) {
      return node
    }
    disconnect() {}
    start() {}
    stop() {}
  }
  class AudioContextStub {
    state = 'suspended'
    currentTime = 0
    destination = new AudioNode()
    onstatechange: (() => void) | null = null
    createGain() {
      return new AudioNode()
    }
    createDynamicsCompressor() {
      return new AudioNode()
    }
    createBufferSource() {
      return new AudioNode()
    }
    async decodeAudioData() {
      return { duration: 10 }
    }
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }
    async resume() {
      this.state = 'running'
      this.onstatechange?.()
    }
    async suspend() {
      this.state = 'suspended'
      this.onstatechange?.()
    }
    async close() {
      this.state = 'closed'
      this.onstatechange?.()
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: AudioContextStub })
  try {
    await queueFixture(async (live) => {
      assert.ok(!document.querySelector('[data-testid="viewport-rain"]'))
      await click(document.querySelector('header [aria-label="환경음 설정"]')!)
      await click(document.querySelector('[aria-label="환경음 재생"]')!)
      assert.ok(
        document.querySelector('[aria-label="환경음 일시정지"]'),
        'ambience must actually be playing for this assertion',
      )
      assert.ok(!document.querySelector('[data-testid="viewport-rain"]'))
      await click(document.querySelector('.settings-dialog [aria-label="설정 닫기"]')!)
      await click(document.querySelector('[aria-label="음악 재생"]')!)
      const rain = document.querySelector<HTMLElement>('[data-testid="viewport-rain"]')!
      assert.ok(rain)
      assert.equal(rain.getAttribute('aria-hidden'), 'true')
      assert.equal(rain.querySelectorAll('button,input,a,[tabindex]').length, 0)
      const rainStyle = window.getComputedStyle(rain)
      assert.equal(rainStyle.position, 'fixed')
      assert.equal(rainStyle.pointerEvents, 'none')
      assert.equal(rainStyle.zIndex, '0')
      assert.equal(window.getComputedStyle(document.querySelector('main')!).zIndex, '1')
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
      assert.equal(rain.dataset.paused, 'true')
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
      assert.equal(rain.dataset.paused, 'false')
      await openMainVolume()
      assert.ok(
        document.querySelector('[data-testid="music-volume-popover"]'),
        'normal UI interactions remain available while rain is mounted',
      )
      await click(document.querySelector('[aria-label="음악 일시정지"]')!)
      assert.ok(!document.querySelector('[data-testid="viewport-rain"]'))
      assert.ok(
        document.querySelector('.ambient-summary')?.textContent?.includes('환경음 재생 중'),
        'ambient playback alone must not enable rain',
      )
      await click(document.querySelector('[aria-label="음악 재생"]')!)
      assert.ok(document.querySelector('[data-testid="viewport-rain"]'))
      Object.defineProperty(live().element, 'error', { configurable: true, value: { code: 2 } })
      await act(async () => live().element.dispatchEvent(new window.Event('error')))
      assert.ok(!document.querySelector('[data-testid="viewport-rain"]'))
    })
  } finally {
    globalThis.fetch = previousFetch
    stylesheet.remove()
    if (previousContext) Object.defineProperty(globalThis, 'AudioContext', previousContext)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (previousVisibility) Object.defineProperty(document, 'visibilityState', previousVisibility)
    else Reflect.deleteProperty(document, 'visibilityState')
  }
})

test('random space changes to a different saved background without opening a modal or resetting music and timer', async () => {
  let saved: any
  let name: string | null | undefined
  await queueFixture(async (live) => {
    await click(document.querySelector('[aria-label="음악 재생"]')!)
    await click(document.querySelector('.timer-actions>.primary')!)
    const before = JSON.parse(localStorage.getItem('rain-room.v1')!)
    const plays = live().plays
    const pauses = live().pauses
    const random = document.querySelector<HTMLButtonElement>('[aria-label="랜덤 공간으로 변경"]')!
    assert.ok(random)
    assert.equal(random.title, '랜덤 공간으로 변경')
    assert.ok(random.querySelector('svg[width="18"][height="18"]'))
    let current = before.settings.background
    for (let i = 0; i < 2; i++) {
      await click(random)
      saved = JSON.parse(localStorage.getItem('rain-room.v1')!)
      assert.notEqual(saved.settings.background, current)
      current = saved.settings.background
      assert.deepEqual(
        { ...saved.settings, background: before.settings.background },
        before.settings,
      )
      assert.equal(saved.session.deadline, before.session.deadline)
      assert.equal(saved.session.duration, before.session.duration)
      assert.equal(saved.session.status, 'running')
      assert.equal(live().plays, plays)
      assert.equal(live().pauses, pauses)
      assert.equal(live().element.paused, false)
      assert.ok(!document.querySelector('.settings-dialog[data-state="open"]'))
    }
    name = document.querySelector('.scene-name')?.textContent
    assert.ok(
      document.querySelector('.change-background'),
      'manual space selection remains available',
    )
  })
  await fixture(
    'unsupported',
    async () => {
      assert.equal(
        JSON.parse(localStorage.getItem('rain-room.v1')!).settings.background,
        saved.settings.background,
      )
      assert.equal(document.querySelector('.scene-name')?.textContent, name)
    },
    '/legacy',
    saved,
  )
})

test('music player sticks within normal flow before the ambient mixer with an upward volume popover', async () => {
  const { readFile } = await import('node:fs/promises')
  const stylesheet = document.createElement('style')
  stylesheet.textContent = await readFile(
    new URL('../src/pages/focus/ui/sticky-player.css', import.meta.url),
    'utf8',
  )
  document.head.appendChild(stylesheet)
  try {
    await queueFixture(async (live) => {
      const player = document.querySelector<HTMLElement>('.focus-section>.now-playing')!
      assert.ok(player)
      assert.equal(document.querySelectorAll('.now-playing').length, 1)
      assert.ok(document.querySelector('main .now-playing'))
      assert.equal(player.nextElementSibling?.className, 'ambient-summary')
      assert.equal(player.previousElementSibling?.getAttribute('aria-label'), '메인 재생 방식')
      assert.equal(
        player.previousElementSibling?.previousElementSibling?.getAttribute('data-testid'),
        'timer-card',
      )
      assert.equal(
        player.previousElementSibling?.querySelectorAll('[aria-pressed="true"]').length,
        1,
      )
      assert.ok(
        player.querySelector('.playback-controls') === null,
        'DOM identity must match the expected element or absence',
      )
      assert.ok(
        document.querySelector('main .ambient-summary'),
        'ambient controls stay in normal page flow',
      )
      assert.ok(document.querySelector('main [data-testid="timer-card"]'))
      const style = window.getComputedStyle(player)
      assert.equal(style.position, 'sticky')
      assert.ok(
        stylesheet.textContent.includes('bottom: calc(18px + env(safe-area-inset-bottom, 0px))'),
      )
      assert.equal(style.zIndex, '20')
      assert.equal(style.overflow, 'visible')
      assert.equal(
        window.getComputedStyle(player.querySelector('.track-info strong')!).textOverflow,
        'ellipsis',
      )
      assert.ok(!stylesheet.textContent.includes('96px'))
      assert.ok(!stylesheet.textContent.includes('position: fixed'))
      await click(player.querySelector('[aria-label="음악 재생"]')!)
      assert.equal(live().plays, 1)
      await openMainVolume()
      assert.ok(document.querySelector('[data-testid="music-volume-popover"]'))
      await changeRange(document.querySelector('[aria-label="메인 음악 볼륨"]')!, 0.27)
      assert.equal(live().element.volume, 0.27)
      const plays = live().plays
      const pauses = live().pauses
      await click(entry())
      assert.equal(player.hidden, true)
      assert.equal((player.previousElementSibling as HTMLElement).hidden, true)
      assert.equal(window.getComputedStyle(player).display, 'none')
      assert.equal(document.getElementById('root')!.inert, true)
      assert.equal(live().plays, plays)
      assert.equal(live().pauses, pauses)
      await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
      assert.equal(player.hidden, false)
      assert.equal(live().element.paused, false)
      assert.equal(document.querySelectorAll('.now-playing').length, 1)
    })
  } finally {
    stylesheet.remove()
  }
})

test('legacy comparison: one scene effect owner follows layered desktop and iOS scenes and pauses for visibility and reduced motion', async () => {
  const originalMatch = window.matchMedia
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
  const media = new window.EventTarget() as unknown as MediaQueryList
  let reduced = false
  let hidden = false
  Object.defineProperty(media, 'matches', { get: () => reduced })
  window.matchMedia = () => media as never
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  try {
    await fixture(
      'unsupported',
      async () => {
        const effects = () => document.querySelector('[data-testid="scene-effects"]')!
        assert.equal(document.querySelectorAll('[data-testid="scene-effects"]').length, 1)
        assert.ok(effects().querySelectorAll('[data-detail]').length >= 2)
        assert.equal(effects().querySelectorAll('[filter]').length, 0)
        assert.equal(effects().getAttribute('data-active'), 'true')
        await act(async () => {
          hidden = true
          document.dispatchEvent(new window.Event('visibilitychange'))
        })
        assert.equal(effects().getAttribute('data-active'), 'false')
        await act(async () => {
          hidden = false
          document.dispatchEvent(new window.Event('visibilitychange'))
        })
        assert.equal(effects().getAttribute('data-active'), 'true')
        await act(async () => {
          reduced = true
          media.dispatchEvent(new window.Event('change') as never)
        })
        assert.equal(effects().getAttribute('data-active'), 'false')
        await act(async () => {
          reduced = false
          media.dispatchEvent(new window.Event('change') as never)
        })
        Object.defineProperty(window.navigator, 'userAgent', {
          configurable: true,
          value: 'iPhone CriOS/120',
        })
        await click(entry())
        assert.equal(
          document
            .querySelector('[data-testid="scene-fullscreen"]')
            ?.getAttribute('data-render-mode'),
          'layered-viewport',
        )
        assert.equal(document.querySelectorAll('[data-testid="scene-effects"]').length, 1)
        assert.ok(effects().querySelectorAll('[data-detail]').length >= 2)
        assert.equal(effects().querySelectorAll('[filter]').length, 0)
        assert.equal(effects().getAttribute('data-active'), 'true')
        assert.equal(effects().getAttribute('aria-hidden'), 'true')
        assert.equal(effects().querySelectorAll('button,input,a,[tabindex]').length, 0)
        await click(document.querySelector('[aria-label="전체화면 나가기"]')!)
        assert.equal(document.querySelectorAll('[data-testid="scene-effects"]').length, 1)
        assert.ok(effects().querySelectorAll('[data-detail]').length >= 2)
        assert.equal(effects().querySelectorAll('[filter]').length, 0)
      },
      '/legacy?renderer=legacy',
    )
    assert.equal(document.querySelectorAll('[data-testid="scene-effects"]').length, 0)
  } finally {
    window.matchMedia = originalMatch
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden)
    else delete (document as unknown as Record<string, unknown>).hidden
  }
})

test('legacy comparison: layered runtime artwork uses small lazy picker assets and pauses effects for offscreen and modal states', async () => {
  const previous = globalThis.IntersectionObserver
  let notify: ((entries: { isIntersecting: boolean }[]) => void) | undefined
  let disconnected = 0
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: class {
      constructor(callback: typeof notify) {
        notify = callback
      }
      observe() {}
      disconnect() {
        disconnected++
      }
    },
  })
  try {
    await fixture(
      'unsupported',
      async () => {
        const effects = () => document.querySelector('[data-testid="scene-effects"]')!
        assert.equal(
          document.querySelector('.scene-artwork')?.getAttribute('src'),
          '/backgrounds/rear/normal/cafe-rain.png',
        )
        assert.ok(document.querySelector('.scene-foreground svg [data-pose]'))
        assert.ok(document.querySelector('.scene-foreground svg [data-plant-species]'))
        assert.ok(
          document.querySelector('.scene-foreground svg [data-scene-layer=rear]') === null,
          'DOM identity must match the expected element or absence',
        )
        await act(async () => notify!([{ isIntersecting: false }]))
        assert.equal(effects().getAttribute('data-active'), 'false')
        await act(async () =>
          document.querySelector('.scene-artwork')!.dispatchEvent(new window.Event('error')),
        )
        assert.ok(document.querySelector('.runtime-fallback'))
        assert.equal(effects().getAttribute('data-active'), 'false')
        await act(async () => notify!([{ isIntersecting: true }]))
        assert.equal(effects().getAttribute('data-active'), 'true')
        await click(document.querySelector('.change-background')!)
        assert.equal(effects().getAttribute('data-active'), 'false')
        const previews = [...document.querySelectorAll('.background-preview img')]
        assert.ok(previews.length > 0)
        assert.ok(
          previews.every(
            (image) =>
              image.getAttribute('loading') === 'lazy' &&
              image.getAttribute('src')?.includes('/thumbnail/'),
          ),
        )
        assert.equal(document.querySelectorAll('.background-preview svg').length, 0)
        await click(document.querySelectorAll('.background-card')[1]!)
        assert.equal(effects().getAttribute('data-active'), 'true')
        assert.ok(
          document.querySelector('.runtime-fallback') === null,
          'DOM identity must match the expected element or absence',
        )
        assert.ok(
          document.querySelector('.scene-artwork')?.getAttribute('src')?.includes('/normal/'),
        )
      },
      '/legacy?renderer=legacy',
    )
    assert.ok(disconnected > 0)
  } finally {
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: previous,
    })
  }
})

test('timer coffee steam follows running, pause, reset and completed session states', async () => {
  await queueFixture(async () => {
    const coffee = () => document.querySelector('.timer-coffee')!
    const steam = () => document.querySelectorAll('.timer-coffee-steam path').length
    assert.equal(coffee().getAttribute('aria-hidden'), 'true')
    assert.equal(steam(), 0)
    await click(document.querySelector('.timer-actions>.primary')!)
    assert.equal(steam(), 3)
    await click(document.querySelector('.timer-actions>.primary')!)
    assert.equal(steam(), 0)
    await click(document.querySelector('.timer-actions>.primary')!)
    assert.equal(steam(), 3)
    await click(document.querySelector('[aria-label="현재 타이머 초기화"]')!)
    assert.equal(steam(), 0)
  })
  const { defaults, fresh } = await import('../src/pages/focus/model/timer.ts')
  await fixture(
    'unsupported',
    async () => {
      assert.equal(document.querySelectorAll('.timer-coffee-steam').length, 0)
    },
    '/legacy',
    {
      version: 3,
      settings: defaults,
      session: { ...fresh('focus', defaults), status: 'complete', remaining: 0 },
    },
  )
})

test('header settings disclose accessible actions and close on selection, Escape, outside pointer and focus departure', async () => {
  await fixture('unsupported', async () => {
    const gear = document.querySelector<HTMLButtonElement>('header [aria-label="설정"]')!
    const panel = document.getElementById(gear.getAttribute('aria-controls')!) as HTMLDivElement
    const time = panel.querySelector<HTMLButtonElement>('[aria-label="시간 설정"]')!
    assert.equal(gear.getAttribute('aria-expanded'), 'false')
    assert.ok(panel.hidden && panel.inert)
    assert.equal(time.tabIndex, -1)
    await act(async () => time.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
    assert.ok(
      document.querySelector('.settings-dialog[data-state="open"]') === null,
      'collapsed actions cannot activate',
    )
    await click(gear)
    assert.equal(gear.getAttribute('aria-expanded'), 'true')
    assert.ok(!panel.hidden && !panel.inert)
    assert.equal(time.tabIndex, 0)
    await click(time)
    assert.ok(panel.hidden && panel.inert)
    assert.equal(document.querySelector('#sheet-title')?.textContent, '나만의 시간')
    await click(document.querySelector('[aria-label="설정 닫기"]')!)
    assert.ok(
      document.activeElement === gear,
      'DOM identity must match the expected element or absence',
    )
    await act(async () =>
      gear.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      ),
    )
    assert.ok(
      document.activeElement === time,
      'DOM identity must match the expected element or absence',
    )
    await act(async () =>
      document.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    assert.ok(panel.hidden && panel.inert)
    assert.ok(
      document.activeElement === gear,
      'DOM identity must match the expected element or absence',
    )
    await click(gear)
    await act(async () =>
      document.body.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })),
    )
    assert.ok(panel.hidden && panel.inert)
    await click(gear)
    await act(async () => {
      time.focus()
      entry().focus()
    })
    assert.ok(panel.hidden && panel.inert)
  })
})

test('Radix settings portal keeps focus, Escape and overlay dismissal while native time inputs and progress semantics stay intact', async () => {
  await fixture('unsupported', async (host) => {
    const progress = document.querySelector('[role="progressbar"]')!
    assert.equal(progress.getAttribute('aria-valuemax'), '100')
    assert.equal(progress.getAttribute('aria-valuenow'), '0')
    await click(document.querySelector('header [aria-label="시간 설정"]')!)
    let content = document.querySelector<HTMLElement>('.settings-dialog')!
    assert.equal(content.getAttribute('role'), 'dialog')
    assert.equal(content.getAttribute('aria-modal'), 'true')
    assert.equal(content.getAttribute('aria-labelledby'), 'sheet-title')
    assert.ok(!host.contains(content), 'Radix content is portalled outside the application root')
    assert.ok(
      document.querySelector('dialog') === null,
      'settings no longer invoke the native dialog element',
    )
    assert.ok(
      document.activeElement === content.querySelector('[aria-label="설정 닫기"]'),
      'DOM identity must match the expected element or absence',
    )
    assert.equal(document.body.style.pointerEvents, 'none')
    const input = content.querySelector<HTMLInputElement>('[aria-label="집중 시간 직접 입력"]')!
    assert.equal(input.type, 'number')
    assert.equal(input.min, '1')
    assert.equal(input.max, '180')
    assert.ok(input.required)
    const close = content.querySelector<HTMLButtonElement>('[aria-label="설정 닫기"]')!
    const last = content.querySelector<HTMLButtonElement>('.save')!
    await act(async () => {
      last.focus()
      last.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      )
    })
    assert.ok(document.activeElement === close, 'Tab loops from the final control inside the modal')
    await act(async () =>
      close.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    assert.ok(document.activeElement === last, 'Shift+Tab loops back to the final control')
    await act(async () =>
      document.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.ok(
      document.querySelector('.settings-dialog') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.equal(document.body.style.pointerEvents, '')
    assert.ok(
      document.activeElement === document.querySelector('header [aria-label="설정"]'),
      'DOM identity must match the expected element or absence',
    )
    await click(document.querySelector('header [aria-label="시간 설정"]')!)
    await click(document.querySelector('.settings-overlay')!)
    assert.ok(
      document.querySelector('.settings-dialog') === null,
      'DOM identity must match the expected element or absence',
    )
    assert.ok(
      document.activeElement === document.querySelector('header [aria-label="설정"]'),
      'DOM identity must match the expected element or absence',
    )
  })
})

test('song selection is a draft until playlist play, starts first with its whole pool and clears outside its category', async () => {
  await queueFixture(async (live) => {
    const target = MUSIC_TRACKS[2]
    const other = MUSIC_TRACKS.find((track) => track.categoryId !== target.categoryId)!
    const category = (id: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('.music-categories button')].find(
        (button) => button.textContent === MUSIC_CATEGORIES.find((item) => item.id === id)!.name,
      )!
    const row = (id: string) =>
      document.querySelector<HTMLButtonElement>(`.music-playlist li[data-track-id="${id}"] button`)!
    await click(document.querySelector('header [aria-label="음악 선택"]')!)
    const before = JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track
    const timer = document.querySelector('[role=timer]')!.textContent
    await click(row(target.id))
    assert.equal(row(target.id).getAttribute('aria-pressed'), 'true')
    assert.match(row(target.id).textContent!, /첫 곡으로 선택/)
    assert.equal(live().plays, 0)
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).settings.track, before)
    assert.equal(document.querySelector('[role=timer]')!.textContent, timer)
    await click(category(other.categoryId))
    assert.ok(
      document.querySelector('.playlist-track[aria-pressed=true]') === null,
      'DOM identity must match the expected element or absence',
    )
    await click(document.querySelector('.music-categories button')!)
    await click(row(target.id))
    await click(document.querySelector('.shuffle-play')!)
    assert.equal(activeQueueId(), target.id)
    assert.equal(document.querySelectorAll('.music-playlist li').length, MUSIC_TRACKS.length)
    assert.equal(
      document.querySelector('.music-playlist li')!.getAttribute('data-track-id'),
      target.id,
    )
    assert.deepEqual(
      [...document.querySelectorAll<HTMLElement>('.music-playlist li')]
        .map((item) => item.dataset.trackId)
        .sort(),
      MUSIC_TRACKS.map((track) => track.id).sort(),
    )
    await act(async () => live().finish())
    assert.notEqual(activeQueueId(), target.id)
    await click(document.querySelector('[aria-label="설정 닫기"]')!)
    await click(document.querySelector('header [aria-label="음악 선택"]')!)
    assert.ok(
      document.querySelector('.playlist-track[aria-pressed=true]') === null,
      'reopening starts a fresh first-song draft',
    )
    await click(row(target.id))
    await click(category(target.categoryId))
    assert.equal(
      row(target.id).getAttribute('aria-pressed'),
      'true',
      'valid drafts survive a narrower matching category',
    )
    await click(document.querySelector('.shuffle-play')!)
    assert.equal(activeQueueId(), target.id)
    assert.deepEqual(
      [...document.querySelectorAll<HTMLElement>('.music-playlist li')]
        .map((item) => item.dataset.trackId)
        .sort(),
      MUSIC_TRACKS.filter((track) => track.categoryId === target.categoryId)
        .map((track) => track.id)
        .sort(),
    )
  })
})

test('playback hints support hover and focus; touch hold suppresses release activation but leaves later taps and keyboard intact', async () => {
  const originalSet = window.setTimeout,
    originalClear = window.clearTimeout
  const jobs = new Map<number, () => void>()
  let next = -1000
  window.setTimeout = ((handler: any, delay?: number, ...args: any[]) => {
    if (delay === 500 && typeof handler === 'function') {
      const id = next--
      jobs.set(id, () => handler(...args))
      return id
    }
    return originalSet.call(window, handler, delay, ...args)
  }) as typeof window.setTimeout
  window.clearTimeout = ((id: any) => {
    if (!jobs.delete(id)) originalClear.call(window, id)
  }) as typeof window.clearTimeout
  const hold = async (button: Element, id = 1) => {
    await act(async () =>
      button.dispatchEvent(
        new window.PointerEvent('pointerdown', {
          bubbles: true,
          pointerType: 'touch',
          pointerId: id,
          button: 0,
          clientX: 10,
          clientY: 10,
        }),
      ),
    )
    assert.equal(jobs.size, 1)
    await act(async () => {
      const callbacks = [...jobs.values()]
      jobs.clear()
      callbacks.forEach((callback) => callback())
    })
  }
  const release = async (button: Element, id = 1) => {
    await act(async () => {
      button.dispatchEvent(
        new window.PointerEvent('pointerup', {
          bubbles: true,
          pointerType: 'touch',
          pointerId: id,
          button: 0,
        }),
      )
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
  }
  try {
    await queueFixture(async (live) => {
      const shuffle = document.querySelector<HTMLButtonElement>(
        '.playback-controls [data-mode=shuffle]',
      )!
      const repeat = document.querySelector<HTMLButtonElement>(
        '.playback-controls [data-mode=repeat-one]',
      )!
      const nextButton = document.querySelector<HTMLButtonElement>(
        '.playback-controls .next-track',
      )!
      const hint = () => document.querySelector('.playback-tooltip')
      const settings = () => JSON.parse(localStorage.getItem('rain-room.v1')!).settings
      assert.equal(shuffle.getAttribute('title'), null)
      await hold(shuffle)
      assert.match(hint()!.textContent!, /무작위/)
      await release(shuffle)
      assert.equal(settings().playbackMode, 'repeat-one')
      assert.ok(hint(), 'a released hold remains readable')
      await act(async () =>
        document.dispatchEvent(
          new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        ),
      )
      assert.ok(hint() === null)
      await click(shuffle)
      assert.equal(settings().playbackMode, 'shuffle')
      const track = settings().track
      await hold(nextButton, 2)
      await release(nextButton, 2)
      assert.equal(settings().track, track)
      assert.equal(live().plays, 0)
      await click(nextButton)
      assert.notEqual(settings().track, track)
      assert.equal(live().plays, 0)
      await act(async () => repeat.focus())
      assert.match(hint()!.textContent!, /계속 반복/)
      await hold(repeat, 3)
      await release(repeat, 3)
      await act(async () =>
        document.querySelector<HTMLButtonElement>('header [aria-label="설정"]')!.focus(),
      )
      assert.ok(hint() === null, 'leaving a pinned trigger closes its portal')
      await act(async () => {
        repeat.focus()
        repeat.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        repeat.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }))
      })
      assert.equal(settings().playbackMode, 'repeat-one')
      await act(async () =>
        document.querySelector<HTMLButtonElement>('header [aria-label="설정"]')!.focus(),
      )
      await act(async () => {
        shuffle.dispatchEvent(
          new window.PointerEvent('pointermove', {
            bubbles: true,
            pointerType: 'mouse',
            clientX: 5,
            clientY: 5,
          }),
        )
        await new Promise((resolve) => setTimeout(resolve, 280))
      })
      assert.match(hint()!.textContent!, /무작위/)
      await click(document.body)
      assert.ok(hint() === null)
      const before = settings().track
      for (const cancel of ['pointercancel', 'pointermove', 'scroll', 'lostpointercapture']) {
        await act(async () =>
          nextButton.dispatchEvent(
            new window.PointerEvent('pointerdown', {
              bubbles: true,
              pointerType: 'touch',
              pointerId: 8,
              button: 0,
              clientX: 10,
              clientY: 10,
            }),
          ),
        )
        assert.equal(jobs.size, 1)
        await act(async () => {
          if (cancel === 'scroll') document.dispatchEvent(new window.Event('scroll'))
          else
            (cancel === 'lostpointercapture' ? nextButton : document).dispatchEvent(
              new window.PointerEvent(cancel, {
                bubbles: true,
                pointerId: 8,
                clientX: 35,
                clientY: 10,
              }),
            )
          nextButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
        })
        assert.equal(jobs.size, 0)
        assert.equal(settings().track, before)
        assert.ok(hint() === null)
      }
      await act(async () =>
        nextButton.dispatchEvent(
          new window.PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            pointerId: 9,
            button: 0,
          }),
        ),
      )
      assert.equal(jobs.size, 1)
    })
    assert.equal(jobs.size, 0, 'unmount cancels a pending hold')
  } finally {
    window.setTimeout = originalSet
    window.clearTimeout = originalClear
  }
})

test('timer completion cues focus and rest exactly once, while mount, pause, reset and settings changes stay silent', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const originalNow = Date.now
  let now = 2_000_000_000_000
  Date.now = () => now
  const contexts: CueContext[] = []
  class CueContext {
    state = 'suspended'
    currentTime = 0
    destination = {}
    oscillators: any[] = []
    resumes = 0
    closed = false
    constructor() {
      contexts.push(this)
    }
    resume() {
      this.resumes++
      this.state = 'running'
      return Promise.resolve()
    }
    close() {
      this.closed = true
      this.state = 'closed'
      return Promise.resolve()
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      }
    }
    createOscillator() {
      const node = {
        frequency: { setValueAtTime() {} },
        type: '',
        start() {},
        stop() {},
        connect() {},
        disconnect() {},
        onended: null,
      }
      this.oscillators.push(node)
      return node
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: CueContext })
  const { defaults, fresh } = await import('../src/pages/focus/model/timer.ts')
  const settings = {
    ...defaults,
    music: 0,
    focus: 1,
    rest: 1,
    ambient: Object.fromEntries(
      Object.entries(defaults.ambient).map(([id, value]) => [id, { ...value, enabled: false }]),
    ),
  }
  const tones = () => contexts.reduce((count, context) => count + context.oscillators.length, 0)
  const elapsed = async (ms: number) => {
    now += ms
    await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
  }
  try {
    for (const phase of ['focus', 'rest'] as const) {
      const before = tones()
      await fixture(
        'unsupported',
        async () => {
          const allocated = contexts.length
          assert.equal(tones(), before)
          await click(document.querySelector('.timer-actions>.primary')!)
          assert.equal(
            contexts.length,
            allocated + 1,
            'one lazily created cue context despite StrictMode',
          )
          assert.ok(contexts.at(-1)!.resumes > 0)
          await elapsed(1001)
          assert.equal(tones(), before + 4)
          assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).session.status, 'complete')
          assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).session.phase, phase)
          assert.equal(
            document.querySelector('.timer-actions>.primary')!.textContent,
            phase === 'focus' ? '휴식 시작하기' : '다시 집중하기',
          )
          await elapsed(5000)
          await elapsed(1000)
          assert.equal(tones(), before + 4)
          await click(document.querySelector('[aria-label="현재 타이머 초기화"]')!)
          assert.equal(tones(), before + 4)
        },
        '/legacy',
        {
          version: 3,
          settings,
          session: { ...fresh(phase, settings as any), status: 'paused', remaining: 1000 },
        },
      )
      assert.ok(contexts.at(-1)!.closed)
    }
    const before = tones()
    await fixture(
      'unsupported',
      async () => {
        await click(document.querySelector('.timer-actions>.primary')!)
        await click(document.querySelector('.timer-actions>.primary')!)
        await elapsed(70000)
        assert.equal(tones(), before)
        await click(document.querySelector('[aria-label="현재 타이머 초기화"]')!)
        await click(document.querySelector('.timer-actions>.primary')!)
        await click(document.querySelector('header [aria-label="시간 설정"]')!)
        await click(
          [...document.querySelectorAll<HTMLButtonElement>('.presets button')].find(
            (button) => button.textContent === '25분',
          )!,
        )
        await saveTimeForm()
        assert.equal(tones(), before)
        assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).session.status, 'running')
        await click(document.querySelector('[aria-label="현재 타이머 초기화"]')!)
        assert.equal(tones(), before)
      },
      '/legacy',
      { version: 3, settings, session: fresh('focus', settings as any) },
    )
    for (const status of ['idle', 'paused', 'complete', 'running'] as const) {
      const allocated = contexts.length
      await fixture(
        'unsupported',
        async () => {
          await elapsed(2000)
          assert.equal(tones(), before)
          assert.equal(contexts.length, allocated)
        },
        '/legacy',
        {
          version: 3,
          settings,
          session: {
            ...fresh('focus', settings as any),
            status,
            remaining: status === 'complete' ? 0 : 1000,
            deadline: status === 'running' ? now - 1 : null,
          },
        },
      )
    }
    const allocated = contexts.length
    await fixture(
      'unsupported',
      async () => {
        assert.equal(
          contexts.length,
          allocated,
          'restored running sessions never autoplay a cue on mount',
        )
        await act(async () =>
          document.body.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })),
        )
        assert.equal(contexts.length, allocated + 1)
        await elapsed(1001)
        assert.equal(tones(), before + 4)
      },
      '/legacy',
      {
        version: 3,
        settings,
        session: {
          ...fresh('rest', settings as any),
          status: 'running',
          remaining: 1000,
          deadline: now + 1000,
        },
      },
    )
  } finally {
    Date.now = originalNow
    if (previous) Object.defineProperty(globalThis, 'AudioContext', previous)
    else delete (globalThis as any).AudioContext
  }
})

test('fullscreen glass player stays usable when top chrome hides and folds independently', async () => {
  const originalSetTimeout = globalThis.setTimeout,
    originalClearTimeout = globalThis.clearTimeout
  let hide: (() => void) | undefined
  const token = {} as ReturnType<typeof setTimeout>
  globalThis.setTimeout = ((
    fn: (...args: unknown[]) => void,
    delay: number,
    ...args: unknown[]
  ) => {
    if (delay === 2500) {
      hide = () => fn(...args)
      return token
    }
    return originalSetTimeout(fn, delay, ...args)
  }) as typeof setTimeout
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    if (id === token) hide = undefined
    else originalClearTimeout(id)
  }) as typeof clearTimeout
  try {
    await queueFixture(async (live) => {
      const opener = entry()
      opener.focus()
      await click(opener)
      const chrome = document.querySelector<HTMLElement>('[data-testid="fullscreen-controls"]')!
      let player = document.querySelector<HTMLElement>('[data-testid="fullscreen-player"]')!
      const play = player.querySelector<HTMLButtonElement>('[aria-label="전체화면 음악 재생"]')!
      play.focus()
      await act(async () => hide?.())
      assert.equal(chrome.inert, true)
      assert.ok(!player.inert && !player.closest('[inert]'))
      assert.ok(document.activeElement === play, 'auto-hide does not steal player focus')
      await click(play)
      assert.equal(live().plays, 1, 'first persistent-player click starts music')
      assert.ok(player.querySelector('[aria-label="전체화면 음악 일시정지"]'))
      await changeRange(player.querySelector('input')!, 0.23)
      assert.equal(live().element.volume, 0.23)
      await click(player.querySelector('[aria-label="플레이어 접기"]')!)
      assert.equal(document.querySelector('[data-testid="fullscreen-player"]'), null)
      let reopen = document.querySelector<HTMLButtonElement>('[aria-label="플레이어 열기"]')!
      assert.ok(document.activeElement === reopen)
      await click(document.querySelector('[data-testid="cafe-scene"]')!)
      assert.equal(
        document.querySelector('[data-testid="fullscreen-player"]'),
        null,
        'background reveal does not reopen panel',
      )
      await act(async () => hide?.())
      assert.equal(chrome.inert, true)
      await click(reopen)
      player = document.querySelector('[data-testid="fullscreen-player"]')!
      assert.ok(player)
      assert.ok(document.activeElement === player.querySelector('[aria-label="플레이어 접기"]'))
      assert.equal(player.querySelector<HTMLInputElement>('input')!.value, '0.23')
      await click(player.querySelector('[aria-label="전체화면 음악 일시정지"]')!)
      assert.ok(live().element.paused, 'reopened player pause works on first click')
      await act(async () =>
        document.dispatchEvent(
          new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        ),
      )
      assert.equal(document.querySelector('[data-testid="scene-fullscreen"]'), null)
      assert.ok(document.activeElement === opener)
    })
  } finally {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test('fullscreen timer reads live focus/rest session state without owning another timer', async () => {
  const { defaults, fresh } = await import('../src/pages/focus/model/timer.ts')
  const originalNow = Date.now
  let now = originalNow()
  Date.now = () => now
  try {
    for (const phase of ['focus', 'rest'] as const) {
      await fixture(
        'unsupported',
        async () => {
          await click(entry())
          const timer = document.querySelector('.fullscreen-timer')!
          assert.equal(
            timer.querySelector('span')!.textContent,
            `${phase === 'focus' ? '집중' : '휴식'} · 진행 중`,
          )
          assert.equal(timer.querySelector('strong')!.textContent, '01:05')
          now += 5000
          await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
          assert.equal(timer.querySelector('strong')!.textContent, '01:00')
        },
        '/legacy',
        {
          version: 3,
          settings: defaults,
          session: {
            ...fresh(phase, defaults),
            status: 'running',
            remaining: 65000,
            deadline: now + 65000,
          },
        },
      )
    }
  } finally {
    Date.now = originalNow
  }
})

test('language settings switch all main UI live without restarting timer or music and save manual preference', async () => {
  await queueFixture(async (live) => {
    await click(document.querySelector('.timer-actions>.primary')!)
    const audio = live().element,
      plays = live().plays,
      deadline = JSON.parse(localStorage.getItem('rain-room.v1')!).session.deadline
    const gear = document.querySelector<HTMLButtonElement>('.settings-gear')!
    await click(document.querySelector('header [aria-label="언어 설정"]')!)
    assert.equal(document.querySelector('#sheet-title')!.textContent, '언어 설정')
    await click(document.querySelector('input[name="app-language"][value="en"]')!)
    assert.equal(document.documentElement.lang, 'en')
    assert.match(document.title, /Your rainy-day focus space/)
    assert.equal(document.querySelector('#sheet-title')!.textContent, 'Language settings')
    assert.equal(
      document.querySelector('.timer-actions>.primary')!.textContent?.trim(),
      'Pause for a moment',
    )
    assert.equal(localStorage.getItem('rain-room.language'), 'en')
    assert.ok(live().element === audio, 'language switch keeps the single music element')
    assert.equal(live().plays, plays)
    assert.equal(JSON.parse(localStorage.getItem('rain-room.v1')!).session.deadline, deadline)
    await click(document.querySelector('input[name="app-language"][value="zh"]')!)
    assert.equal(document.documentElement.lang, 'zh-Hans')
    assert.equal(document.querySelector('#sheet-title')!.textContent, '语言设置')
    assert.match(document.querySelector('[role="timer"]')!.getAttribute('aria-label')!, /^剩余/)
    assert.equal(localStorage.getItem('rain-room.language'), 'zh')
    await click(document.querySelector('[aria-label="关闭设置"]')!)
    assert.ok(
      document.activeElement === gear,
      'translated gear remains the valid modal return target',
    )
    await click(document.querySelector('header [aria-label="语言设置"]')!)
    assert.ok(document.querySelector<HTMLInputElement>('input[value="zh"]')!.checked)
    await click(document.querySelector('input[name="app-language"][value="ko"]')!)
    await click(document.querySelector('[aria-label="설정 닫기"]')!)
    assert.equal(document.documentElement.lang, 'ko')
    assert.equal(live().plays, plays)
  })
})

test('legacy dashboard preserves a v4 ritual and active deadline instead of downgrading shared saved data', async () => {
  const { defaults, fresh } = await import('../src/pages/focus/model/timer.ts')
  const deadline = Date.now() + 10 * 60000
  const ritual = {
    stage: 'room',
    drinkId: 'cold-brew',
    temperature: 'iced',
    order: {
      id: 'legacy-bridge',
      drinkId: 'cold-brew',
      temperature: 'iced',
      createdAt: 1700000000000,
    },
  }
  await fixture(
    'unsupported',
    async () => {
      const saved = JSON.parse(localStorage.getItem('rain-room.v1')!)
      assert.equal(saved.version, 4)
      assert.deepEqual(saved.ritual, ritual)
      assert.equal(saved.ritualMuted, true)
      assert.equal(saved.session.status, 'running')
      assert.equal(saved.session.deadline, deadline)
      assert.ok(document.querySelector('.timer-block'))
    },
    '/legacy',
    {
      version: 4,
      settings: defaults,
      session: { ...fresh('focus', defaults), status: 'running', deadline, remaining: 10 * 60000 },
      ritual,
      ritualMuted: true,
    },
  )
})
