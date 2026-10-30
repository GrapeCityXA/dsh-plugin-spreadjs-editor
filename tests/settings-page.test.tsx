import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createBridgeRegistry } from '../src/client/bridge-registry.ts'
import { connectBridgeSetting } from '../src/client/bridge-setting.ts'
import { bridgeSettingsPage } from '../src/client/settings-page.tsx'

// Render the settings choices without mounting a browser. This covers the
// unavailable state and the controls that let the user change that saved choice.
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}))

type Element = ReactElement<Record<string, unknown>>

function findAll(node: ReactNode, predicate: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate))
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [...(predicate(node) ? [node] : []), ...findAll(node.props.children as ReactNode, predicate)]
}

function renderMissing(withAlternative: boolean) {
  const registry = createBridgeRegistry()
  if (withAlternative) registry.register({ id: 'another-driver', title: () => 'Another Driver', attach: () => () => {} })
  const set = vi.fn(async () => true)
  const setting = connectBridgeSetting({ get: () => ({
    getSnapshot: () => ({ status: 'ready', value: { bridge: 'saved-driver' } }),
    subscribe: () => () => {},
    set,
  }) }, registry)
  const Page = bridgeSettingsPage(registry, setting)
  const page = (Page as () => ReactElement)()
  return { registry, set, page }
}

describe('an unavailable saved bridge in Settings', () => {
  it.each([false, true])('explains the unavailable choice and offers a keyboard reachable control, alternative=%s', (withAlternative) => {
    const { registry, set, page } = renderMissing(withAlternative)
    const warnings = findAll(page, element => element.props.role === 'status')
    expect(warnings).toHaveLength(1)
    expect(findAll(warnings[0], element => element.type === 'code')[0]?.props.children).toBe('saved-driver')

    const choices = findAll(page, element => element.props.role === 'radio')
    expect(choices.length).toBe(withAlternative ? 2 : 1)
    expect(choices.filter(choice => choice.props.tabIndex === 0)).toHaveLength(1)
    expect(choices.every(choice => choice.props['aria-checked'] === false)).toBe(true)
    expect(registry.selected()).toBe('saved-driver')
    expect(set).not.toHaveBeenCalled()

    ;(choices.at(-1)!.props.onClick as () => void)()
    expect(registry.selected()).toBeUndefined()
    expect(set).toHaveBeenCalledExactlyOnceWith('bridge', '')
  })

  it.each([
    ['ArrowRight', 'another-driver'],
    ['ArrowLeft', undefined],
  ] as const)('moves %s from the unavailable selection to an available choice', (key, expected) => {
    const { registry, page } = renderMissing(true)
    const group = findAll(page, element => element.props.role === 'radiogroup')[0]!
    const preventDefault = vi.fn()
    ;(group.props.onKeyDown as (event: unknown) => void)({ key, preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(registry.selected()).toBe(expected)
  })
})
