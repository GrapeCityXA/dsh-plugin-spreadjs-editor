import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  panelSnapshot,
  publishPanel,
  refreshPanel,
  resetPanelActions,
  saveActivePanel,
  saveAsActivePanel,
  subscribePanel,
  type SpreadsheetPanel,
} from '../src/client/panel-actions.ts'

/** A panel whose state the test can move. */
function panel(initial: { canSave?: boolean; dirty?: boolean; busy?: boolean } = {}) {
  const state = { canSave: initial.canSave ?? true, dirty: initial.dirty ?? false, busy: initial.busy ?? false }
  const save = vi.fn()
  const requestSaveAs = vi.fn()
  const value: SpreadsheetPanel = {
    canSave: () => state.canSave,
    isDirty: () => state.dirty,
    isBusy: () => state.busy,
    save,
    requestSaveAs,
  }
  return { state, save, requestSaveAs, value }
}

beforeEach(() => { resetPanelActions() })

describe('what the document header can ask of the panel', () => {
  it('reports nothing and does nothing while no panel is mounted', () => {
    expect(panelSnapshot()).toEqual({ available: false, dirty: false, busy: false })
    expect(() => {
      saveActivePanel()
      saveAsActivePanel()
      refreshPanel()
    }).not.toThrow()
  })

  it('reflects the mounted panel', () => {
    const { value } = panel({ dirty: true })
    publishPanel(value)
    expect(panelSnapshot()).toEqual({ available: true, dirty: true, busy: false })
  })

  it('reports a panel that cannot write back as unavailable', () => {
    const { value } = panel({ canSave: false })
    publishPanel(value)
    expect(panelSnapshot().available).toBe(false)
  })

  it('notifies on a real change and stays quiet when nothing changed', () => {
    const { state, value } = panel()
    const listener = vi.fn()
    publishPanel(value)
    subscribePanel(listener)

    refreshPanel()
    expect(listener).not.toHaveBeenCalled()

    state.dirty = true
    refreshPanel()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(panelSnapshot().dirty).toBe(true)

    // A second identical refresh must not notify: the header re-renders on this
    // signal, and a redundant one would render on every unrelated state change.
    state.dirty = true
    refreshPanel()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps the snapshot reference stable while nothing changes', () => {
    const { value } = panel()
    publishPanel(value)
    const first = panelSnapshot()
    refreshPanel()
    expect(panelSnapshot()).toBe(first)
  })

  it('routes both actions to the panel on screen', () => {
    const first = panel()
    const publish = publishPanel(first.value)
    saveActivePanel()
    saveAsActivePanel()
    expect(first.save).toHaveBeenCalledTimes(1)
    expect(first.requestSaveAs).toHaveBeenCalledTimes(1)

    publish()
    expect(panelSnapshot()).toEqual({ available: false, dirty: false, busy: false })
    saveActivePanel()
    expect(first.save).toHaveBeenCalledTimes(1)
  })

  it('lets a later panel take over, and does not let an earlier one take it back', () => {
    const first = panel({ dirty: true })
    const second = panel({ dirty: false })
    const releaseFirst = publishPanel(first.value)
    const releaseSecond = publishPanel(second.value)
    releaseFirst()
    // The first panel unmounting after the second mounted must not clear it.
    expect(panelSnapshot()).toEqual({ available: true, dirty: false, busy: false })

    releaseSecond()
    expect(panelSnapshot()).toEqual({ available: false, dirty: false, busy: false })
  })
})
