/**
 * The bridge between the harness theme service and the editor's own theme pair.
 *
 * The editor's palette cannot come from CSS the way the panel's chrome does:
 * SpreadJS ships two Excel stylesheets and two Designer presets, and requires
 * exactly one of each chosen by replacing a tag, so something has to tell it
 * which scheme is active. These tests fix that wiring — the scheme is read from
 * `ctx.theme` (never from `prefers-color-scheme`, which disagrees with the
 * harness whenever the user picks a preference the OS does not share), adopted
 * at attach time, re-read on every `theme/change`, and reported to subscribers
 * only when the scheme actually flips.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

/** One published snapshot, carrying the fields the bridge reads. */
interface SnapshotDouble {
  preference: string
  fontSize: number
  active: { id: string; colorScheme: 'light' | 'dark'; tokens: Record<string, string> }
  themes: readonly unknown[]
  revision: number
}

function snapshot(colorScheme: 'light' | 'dark', id: string = colorScheme, preference: string = colorScheme): SnapshotDouble {
  return { preference, fontSize: 14, active: { id, colorScheme, tokens: {} }, themes: [], revision: 1 }
}

type SnapshotHandler = (snapshot: unknown) => void

interface HarnessDouble {
  ctx: unknown
  /** Event names the bridge subscribed to, in order. */
  events: string[]
  /** Live subscriptions on the harness event bus. */
  handlerCount(): number
  /** Publish a snapshot the way the theme service does. */
  emit(next: SnapshotDouble): void
}

/** A context double carrying the theme service and the harness event bus. */
function makeHarness(initial: SnapshotDouble): HarnessDouble {
  const handlers = new Set<SnapshotHandler>()
  const events: string[] = []
  return {
    ctx: {
      theme: { getTheme: () => initial },
      on: (name: string, handler: SnapshotHandler) => {
        events.push(name)
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
    },
    events,
    handlerCount: () => handlers.size,
    emit(next) {
      for (const handler of [...handlers]) handler(next)
    },
  }
}

/** A fresh module per test: the adopted scheme is module state. */
async function loadBridge() {
  vi.resetModules()
  return await import('../src/client/ds-theme.ts')
}

afterEach(() => {
  vi.resetModules()
})

describe('harness theme bridge', () => {
  it('adopts the resolved scheme before any panel mounts', async () => {
    const { attachHarnessTheme, harnessThemeIsDark } = await loadBridge()
    const harness = makeHarness(snapshot('dark'))

    const dispose = attachHarnessTheme(harness.ctx as never)

    expect(harnessThemeIsDark()).toBe(true)
    expect(harness.events).toEqual(['theme/change'])
    dispose()
  })

  it('starts on the light pair when the harness resolves to light', async () => {
    const { attachHarnessTheme, harnessThemeIsDark } = await loadBridge()
    const harness = makeHarness(snapshot('light'))

    attachHarnessTheme(harness.ctx as never)

    expect(harnessThemeIsDark()).toBe(false)
  })

  it('flips the editor when the harness resolves the other scheme', async () => {
    const { attachHarnessTheme, harnessThemeIsDark, onHarnessThemeChange } = await loadBridge()
    const harness = makeHarness(snapshot('light'))
    const seen: boolean[] = []
    const dispose = attachHarnessTheme(harness.ctx as never)
    const off = onHarnessThemeChange(dark => { seen.push(dark) })

    harness.emit(snapshot('dark'))

    expect(seen).toEqual([true])
    expect(harnessThemeIsDark()).toBe(true)

    harness.emit(snapshot('light'))
    expect(seen).toEqual([true, false])
    expect(harnessThemeIsDark()).toBe(false)

    off()
    dispose()
  })

  it('reads the base palette a theme builds on, never its id', async () => {
    const { attachHarnessTheme, harnessThemeIsDark, onHarnessThemeChange } = await loadBridge()
    const harness = makeHarness(snapshot('light'))
    const dispose = attachHarnessTheme(harness.ctx as never)
    const off = onHarnessThemeChange(() => {})

    harness.emit(snapshot('dark', 'midnight', 'midnight'))

    expect(harnessThemeIsDark()).toBe(true)

    off()
    dispose()
  })

  it('stays quiet when a snapshot resolves to the scheme already applied', async () => {
    const { attachHarnessTheme, onHarnessThemeChange } = await loadBridge()
    const harness = makeHarness(snapshot('light'))
    const listener = vi.fn()
    const dispose = attachHarnessTheme(harness.ctx as never)
    const off = onHarnessThemeChange(listener)

    // The preference changed to `system` and the content font size moved; both
    // arrive on the same event and neither flips the resolved scheme.
    harness.emit(snapshot('light', 'light', 'system'))
    harness.emit({ ...snapshot('light', 'light', 'system'), fontSize: 16, revision: 2 })

    expect(listener).not.toHaveBeenCalled()

    off()
    dispose()
  })

  it('releases the harness subscription when the plugin fiber is disposed', async () => {
    const { attachHarnessTheme, onHarnessThemeChange } = await loadBridge()
    const harness = makeHarness(snapshot('light'))
    const listener = vi.fn()
    const dispose = attachHarnessTheme(harness.ctx as never)
    const off = onHarnessThemeChange(listener)

    dispose()

    expect(harness.handlerCount()).toBe(0)
    harness.emit(snapshot('dark'))
    expect(listener).not.toHaveBeenCalled()

    off()
  })

  it('drops one subscriber without disturbing the others', async () => {
    const { attachHarnessTheme, onHarnessThemeChange } = await loadBridge()
    const harness = makeHarness(snapshot('light'))
    const first = vi.fn()
    const second = vi.fn()
    const dispose = attachHarnessTheme(harness.ctx as never)
    const offFirst = onHarnessThemeChange(first)
    const offSecond = onHarnessThemeChange(second)

    offFirst()
    harness.emit(snapshot('dark'))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true)

    offSecond()
    dispose()
  })

  it('survives a listener that unsubscribes while the snapshot is being published', async () => {
    const { attachHarnessTheme, harnessThemeIsDark, onHarnessThemeChange } = await loadBridge()
    const harness = makeHarness(snapshot('light'))
    const other = vi.fn()
    const dispose = attachHarnessTheme(harness.ctx as never)
    const offOther = onHarnessThemeChange(other)

    const offSelf = onHarnessThemeChange(() => { offSelf() })
    harness.emit(snapshot('dark'))

    expect(other).toHaveBeenCalledWith(true)
    expect(harnessThemeIsDark()).toBe(true)

    offOther()
    dispose()
  })
})
