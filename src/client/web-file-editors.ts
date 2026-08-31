import type { ComponentType } from 'react'

/** Props handed to an editor component by the generic webFileEditors service. */
export interface WebFileEditorViewProps {
  /** Absolute path after session workspace resolution. */
  path: string
  /** Session cwd when known; used by the editor as a browse root. */
  root?: string
  /** Close the generic editor panel. */
  onClose: () => void
  /** Publish a status line to the generic editor panel. */
  onStatus?: (status: string, tone?: 'idle' | 'busy' | 'error') => void
}

/** Registration payload consumed by the generic webFileEditors service. */
export interface WebFileEditor {
  id: string
  title: string
  extensions: readonly string[]
  component: ComponentType<WebFileEditorViewProps>
}

/** Minimal face of the optional webFileEditors client service. */
export interface WebFileEditors {
  register(editor: WebFileEditor): () => void
}
