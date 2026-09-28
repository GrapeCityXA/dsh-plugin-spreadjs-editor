/**
 * Two of the injected stylesheets are themes rather than static CSS: the
 * workbook's Excel theme and the Designer's own light/dark preset. Both are
 * documented as "at most one at a time", and both have to be swapped rather than
 * recoloured — `setTheme` reaches the Designer's variables only, never the
 * workbook and never the product's icon assets. These tests fix the wiring — one
 * tag per role, replaced in place, never a second sheet — by standing in for the
 * stylesheets the real build inlines as text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css', () => ({ default: 'RUNTIME_LIGHT' }))
vi.mock('@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2016black.css', () => ({ default: 'RUNTIME_DARK' }))
vi.mock('@grapecity-software/spread-sheets-designer/styles/gc.spread.sheets.designer.light.min.css', () => ({ default: 'DESIGNER_LIGHT' }))
vi.mock('@grapecity-software/spread-sheets-designer/styles/gc.spread.sheets.designer.dark.min.css', () => ({ default: 'DESIGNER_DARK' }))
vi.mock('../src/client/viewer.css', () => ({ default: 'VIEWER' }))

interface FakeTag {
  dataset: Record<string, string>
  textContent: string
  remove(): void
}

let tags: FakeTag[] = []

/** A document that only knows how to hold style tags. */
function fakeDocument(): void {
  tags = []
  vi.stubGlobal('document', {
    head: {
      appendChild(element: FakeTag) {
        tags.push(element)
      },
    },
    createElement(): FakeTag {
      const element: FakeTag = {
        dataset: {},
        textContent: '',
        remove() {
          const index = tags.indexOf(element)
          if (index >= 0) tags.splice(index, 1)
        },
      }
      return element
    },
  })
}

/** A fresh module per test: the applied theme is module state. */
async function loadStyles() {
  vi.resetModules()
  return await import('../src/client/styles.ts')
}

beforeEach(() => {
  fakeDocument()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme stylesheets', () => {
  it('injects one tag per role, on the light pair by default', async () => {
    const { injectStyles } = await loadStyles()

    const dispose = injectStyles()

    expect(tags.map(tag => tag.dataset.role)).toEqual(['runtime-theme', 'designer-theme', 'viewer'])
    expect(tags[0]?.textContent).toBe('RUNTIME_LIGHT')
    expect(tags[1]?.textContent).toBe('DESIGNER_LIGHT')
    expect(tags[2]?.textContent).toBe('VIEWER')

    dispose()
  })

  it('swaps both themes in place instead of appending sheets', async () => {
    const { injectStyles, setEditorTheme } = await loadStyles()
    const dispose = injectStyles()

    setEditorTheme(true)
    expect(tags).toHaveLength(3)
    expect(tags[0]?.textContent).toBe('RUNTIME_DARK')
    expect(tags[1]?.textContent).toBe('DESIGNER_DARK')

    setEditorTheme(false)
    expect(tags).toHaveLength(3)
    expect(tags[0]?.textContent).toBe('RUNTIME_LIGHT')
    expect(tags[1]?.textContent).toBe('DESIGNER_LIGHT')

    dispose()
  })

  it('honours a theme chosen before the styles were injected', async () => {
    const { injectStyles, setEditorTheme } = await loadStyles()

    setEditorTheme(true)
    const dispose = injectStyles()

    expect(tags[0]?.textContent).toBe('RUNTIME_DARK')
    expect(tags[1]?.textContent).toBe('DESIGNER_DARK')

    dispose()
  })

  it('leaves the sheets alone when the theme did not change', async () => {
    const { injectStyles, setEditorTheme } = await loadStyles()
    const dispose = injectStyles()
    const runtime = tags[0]
    if (runtime !== undefined) runtime.textContent = 'TOUCHED'

    setEditorTheme(false)

    expect(runtime?.textContent).toBe('TOUCHED')

    dispose()
  })

  it('does nothing, without throwing, once the styles are disposed', async () => {
    const { injectStyles, setEditorTheme } = await loadStyles()
    const dispose = injectStyles()
    dispose()
    expect(tags).toHaveLength(0)

    expect(() => setEditorTheme(true)).not.toThrow()
  })
})
