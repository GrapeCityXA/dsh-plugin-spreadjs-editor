import { useEffect, useLayoutEffect } from 'react'
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  document: vi.fn(),
}))
// Keep the actual React reconciler and boundary; only the DOM/canvas SDK body is
// replaced, so render and commit failures follow React's real recovery path.
vi.mock('../src/client/SpreadsheetDocument.tsx', () => ({
  SpreadsheetDocument: (props: unknown) => h.document(props),
}))

import { EditorErrorBoundary, EditorFailure, ProtectedSpreadsheetDocument, editorPageOrigin } from '../src/client/editor-failure.tsx'
import { attachEditorLocale } from '../src/client/locales.ts'

let root: ReactTestRenderer | undefined
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('location', { protocol: 'dsh-app:', host: 'app', pathname: '/private-file', search: '?token=secret', hash: '#private' })
  h.document.mockReset()
})
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mount(child: React.JSX.Element): ReactTestRenderer {
  act(() => { root = create(child) })
  return root!
}

function renderDocument(resourceAddress: string): React.JSX.Element {
  return <ProtectedSpreadsheetDocument {...{ resourceAddress } as DocumentPreviewProps} />
}

describe('document failure isolation', () => {
  it('keeps a sibling sidebar feature mounted after a document render fails', () => {
    const dispose = vi.fn()
    function Sibling() { useEffect(() => dispose, []); return <p>sidebar remains available</p> }
    h.document.mockImplementation(() => { throw new Error('License validation failed') })
    const tree = mount(<><Sibling />{renderDocument('bad.xlsx')}</>)

    expect(tree.root.findByProps({ role: 'alert' })).toBeDefined()
    expect(JSON.stringify(tree.toJSON())).toContain('sidebar remains available')
    expect(dispose).not.toHaveBeenCalled()
    expect(tree.root.findByType('details').props.open).toBeUndefined()
  })

  it('catches an SDK-like initialization failure in a passive effect', () => {
    function BrokenEffect(): null {
      useEffect(() => { throw new Error('Designer construction failed') }, [])
      return null
    }
    const tree = mount(<><p>sidebar</p><EditorErrorBoundary><BrokenEffect /></EditorErrorBoundary></>)
    expect(tree.root.findByProps({ role: 'alert' })).toBeDefined()
    expect(JSON.stringify(tree.toJSON())).toContain('Designer construction failed')
    expect(JSON.stringify(tree.toJSON())).toContain('sidebar')
  })

  it('contains a child cleanup failure while its boundary remains mounted', () => {
    function BrokenCleanup(): React.JSX.Element {
      useLayoutEffect(() => () => { throw new Error('Designer cleanup failed') }, [])
      return <p>editor</p>
    }
    const tree = mount(<><p>sidebar</p><EditorErrorBoundary><BrokenCleanup /></EditorErrorBoundary></>)
    act(() => { tree.update(<><p>sidebar</p><EditorErrorBoundary><p>replacement</p></EditorErrorBoundary></>) })
    expect(tree.root.findByProps({ role: 'alert' })).toBeDefined()
    expect(JSON.stringify(tree.toJSON())).toContain('Designer cleanup failed')
    expect(JSON.stringify(tree.toJSON())).toContain('sidebar')
  })

  it('does not retry a failed document on rerender and resets when switching files', () => {
    h.document.mockImplementation(({ resourceAddress }: { resourceAddress: string }) => {
      if (resourceAddress === 'bad.xlsx') throw new Error('SDK failed')
      return <p>working document</p>
    })
    const tree = mount(renderDocument('bad.xlsx'))
    const failedAttempts = h.document.mock.calls.length
    act(() => { tree.update(renderDocument('bad.xlsx')) })
    expect(h.document).toHaveBeenCalledTimes(failedAttempts)
    act(() => { tree.update(renderDocument('good.xlsx')) })
    expect(tree.root.findAllByProps({ role: 'alert' })).toHaveLength(0)
    expect(JSON.stringify(tree.toJSON())).toContain('working document')
  })
})

describe('failure diagnostics', () => {
  it.each([
    [{ protocol: 'http:', host: 'localhost:3080' }, 'http://localhost:3080'],
    [{ protocol: 'https:', host: 'example.com' }, 'https://example.com'],
    [{ protocol: 'dsh-app:', host: 'app' }, 'dsh-app://app'],
    [{ protocol: 'file:', host: '' }, 'file:'],
  ])('shows the page origin for %j', (location, expected) => {
    expect(editorPageOrigin(location)).toBe(expected)
  })

  it('never includes the current file path, query or fragment in the page origin', () => {
    const tree = mount(<EditorFailure error={new Error('SDK failed')} />)
    expect(tree.root.findByType('code').children).toEqual(['dsh-app://app'])
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/private-file|token=secret|#private/)
    expect(tree.root.findAllByType('button')).toHaveLength(0)
  })

  it('uses the active locale for a failure without assuming it is a license error', () => {
    let dispose: (() => void) | undefined
    const ctx = {
      inject: (_dependencies: string[], callback: (child: unknown) => void) => {
        callback({
          effect: (createEffect: () => () => void) => { dispose = createEffect() },
          locale: {
            register: (_namespace: string, dictionaries: { en: Record<string, string> }) => {
              ctx.dictionaries = dictionaries.en
              return () => {}
            },
            bind: () => (key: string) => ctx.dictionaries[key],
          },
        })
        return { dispose: () => dispose?.() }
      },
      dictionaries: {} as Record<string, string>,
    }
    const off = attachEditorLocale(ctx as never)
    try {
      const tree = mount(<EditorFailure error={new Error('Out of memory')} />)
      const text = JSON.stringify(tree.toJSON())
      expect(text).toContain('SpreadJS Editor could not initialize')
      expect(text).toContain('If this error concerns licensing')
      expect(text).toContain('both the SpreadJS and Designer licenses')
      expect(text).toContain('Out of memory')
    } finally {
      off()
    }
  })
})
