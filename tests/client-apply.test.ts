import { describe, expect, it, vi, beforeEach } from 'vitest'

// SpreadJS + module-table rows are not loadable in a Node test environment
// (SpreadJS touches DOM/canvas at import). Stub them so we can exercise the
// client apply() registration logic (the slot keys and the effect).
vi.mock('@deepseek-ai/dsh-client-store', () => ({
  defineStore: (spec: unknown) => ({ __spec: spec }),
}))
vi.mock('@grapecity/spread-sheets', () => ({ Workbook: class {} }))
vi.mock('@grapecity/spread-excelio', () => ({ IO: class {} }))
vi.mock('@grapecity/spread-sheets-resources-zh', () => ({}))

import { apply, inject, name } from '../src/client/index.ts'

describe('client plugin manifest', () => {
  it('exports name and required inject', () => {
    expect(name).toBe('dsh-spreadjs-editor')
    expect(inject).toContain('slots')
  })

  it('apply() registers both slot seats and a style effect', () => {
    const injected: Array<[string, () => unknown]> = []
    let effectCalls = 0
    const ctx = {
      slots: {
        inject: vi.fn((key: string, cb: () => unknown) => {
          injected.push([key, cb])
          return () => {}
        }),
        register: vi.fn(() => () => {}),
      },
      effect: vi.fn(() => {
        effectCalls += 1
      }),
    }

    apply(ctx as never)

    expect(effectCalls).toBeGreaterThanOrEqual(1)
    const keys = injected.map(([k]) => k)
    expect(keys).toContain('sidebar.footer.action')
    expect(keys).toContain('shell.overlay')

    // Each inject callback yields one register() disposable.
    for (const [, cb] of injected) {
      const result = cb()
      const disposables = Array.isArray(result) ? result : result ? [result] : []
      expect(disposables.length).toBeGreaterThanOrEqual(1)
      for (const d of disposables) expect(typeof d).toBe('function')
    }
    expect(ctx.slots.register).toHaveBeenCalledTimes(2)
  })
})
