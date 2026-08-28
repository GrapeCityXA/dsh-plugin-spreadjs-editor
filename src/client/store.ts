/** Shared viewer view-state store: open/close, browse root, selected file. */

import { defineStore } from '@deepseek-ai/dsh-client-store'

/** Root-scoped view state shared by the trigger and the overlay entries. */
export interface ViewerState {
  /** Whether the viewer overlay is open. */
  open: boolean
  /** Selected browse root (a task workspace path); undefined = host default (cwd). */
  root: string | undefined
  /** Absolute path of the file currently shown. */
  selected: string | undefined
  /** Bumped to re-run the file-list fetch. */
  refreshToken: number
}

/** Store factory (handle is constructed in apply and shared by both entries). */
export const createViewerStore = () => defineStore({
  init: (): ViewerState => ({
    open: false,
    root: undefined,
    selected: undefined,
    refreshToken: 0,
  }),
  actions: {
    open(state) { state.open = true },
    close(state) { state.open = false },
    setRoot(state, root?: string) {
      state.root = root
      state.selected = undefined
    },
    select(state, path: string) { state.selected = path },
    refresh(state) { state.refreshToken += 1 },
  },
})

export type ViewerStoreHandle = ReturnType<typeof createViewerStore>
