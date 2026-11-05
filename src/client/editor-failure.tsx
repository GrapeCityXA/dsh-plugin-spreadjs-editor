import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import { SpreadsheetDocument } from './SpreadsheetDocument.tsx'
import { editorText } from './locales.ts'

/** The page's licensing origin only; never its file path, query or fragment. */
export function editorPageOrigin(location?: Pick<Location, 'protocol' | 'host'>): string {
  try {
    const current = location ?? globalThis.location
    if (current === undefined) return editorText('failure.originUnknown')
    // Reading protocol + host also works for custom desktop schemes whose
    // Location.origin is "null". No href is included in the diagnostic.
    return `${current.protocol}${current.host === '' ? '' : `//${current.host}`}`
  } catch {
    return editorText('failure.originUnknown')
  }
}

/** Avoid rendering an arbitrary thrown object (or its potentially throwing getter). */
function failureMessage(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error)
  } catch {
    return editorText('failure.detailsUnavailable')
  }
}

export function EditorFailure({ error }: { error: unknown }): React.JSX.Element {
  return (
    <section className="dsh-spreadjs-failure" role="alert">
      <h2>{editorText('failure.title')}</h2>
      <p>{editorText('failure.scope')}</p>
      <p>{editorText('failure.license')}</p>
      <p className="dsh-spreadjs-failure-origin">
        {editorText('failure.origin')} <code>{editorPageOrigin()}</code>
      </p>
      <details>
        <summary>{editorText('failure.details')}</summary>
        <pre>{failureMessage(error)}</pre>
      </details>
    </section>
  )
}

/** Keep a vendor render/effect failure inside this one document, below the sidebar. */
export class EditorErrorBoundary extends Component<{ children: ReactNode }, { error?: { cause: unknown } }> {
  override state: { error?: { cause: unknown } } = {}

  static getDerivedStateFromError(error: unknown): { error: { cause: unknown } } {
    return { error: { cause: error } }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[dsh-spreadjs-editor] document failed:', error, info.componentStack)
  }

  override render(): ReactNode {
    return this.state.error === undefined
      ? this.props.children
      : <EditorFailure error={this.state.error.cause} />
  }
}

/** Switching documents starts a new boundary; a failed SDK is never auto-retried. */
export function ProtectedSpreadsheetDocument(props: DocumentPreviewProps): React.JSX.Element {
  return (
    <EditorErrorBoundary key={props.resourceAddress}>
      <SpreadsheetDocument {...props} />
    </EditorErrorBoundary>
  )
}
