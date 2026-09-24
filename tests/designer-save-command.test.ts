import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  redirectDesignerSave,
  registerDesignerSaveTarget,
  type DesignerCommandLike,
  type DesignerNamespaceLike,
  type DesignerSaveTarget,
} from '../src/client/designer-save-command.ts'

type Mock = ReturnType<typeof vi.fn>

/** A stand-in for the Designer's Save command, as `getCommand` hands it over. */
function makeNamespace(pristineResult: unknown = 'pristine'): {
  namespace: DesignerNamespaceLike
  command: DesignerCommandLike
  pristine: Mock
} {
  const pristine = vi.fn(() => pristineResult)
  const command: DesignerCommandLike = { title: 'save', commandName: 'save', execute: pristine }
  return { namespace: { CommandNames: { Save: 'save' }, getCommand: () => command }, command, pristine }
}

/** A mounted panel. */
function panel(workbook: unknown, canWriteBack = true): DesignerSaveTarget & { save: Mock } {
  return { workbook: () => workbook, canWriteBack: () => canWriteBack, save: vi.fn() }
}

/** Invoke the (possibly redirected) command the way the Designer would. */
function invoke(command: DesignerCommandLike, ...args: unknown[]): unknown {
  return command.execute?.(...args)
}

const mounted: Array<() => void> = []
function mount(target: DesignerSaveTarget): void {
  mounted.push(registerDesignerSaveTarget(target))
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.()
})

describe('redirectDesignerSave', () => {
  it('writes the workbook back instead of downloading a copy', () => {
    const { namespace, command, pristine } = makeNamespace()
    const target = panel('workbook-a')
    mount(target)
    const config = { commandMap: {} as Record<string, unknown> }

    expect(redirectDesignerSave(namespace, config)).toBe(true)

    invoke(command, { getWorkbook: () => 'workbook-a' })
    expect(target.save).toHaveBeenCalledTimes(1)
    expect(pristine).not.toHaveBeenCalled()
  })

  it('registers the redirect for the instance and keeps the other commands', () => {
    const { namespace, command } = makeNamespace()
    const other = { title: 'undo' }
    const config = { commandMap: { undo: other } as Record<string, unknown> }

    redirectDesignerSave(namespace, config)

    expect(config.commandMap.undo).toBe(other)
    expect((config.commandMap.save as DesignerCommandLike).execute).toBe(command.execute)
    expect(command.execute).toBeTypeOf('function')
  })

  it('routes to the panel that owns the workbook the command was launched on', () => {
    const { namespace, command } = makeNamespace()
    const first = panel('workbook-a')
    const second = panel('workbook-b')
    mount(first)
    mount(second)

    redirectDesignerSave(namespace, { commandMap: {} })
    invoke(command, { getWorkbook: () => 'workbook-b' })

    expect(second.save).toHaveBeenCalledTimes(1)
    expect(first.save).not.toHaveBeenCalled()
  })

  it('accepts the only panel when the command cannot name its workbook', () => {
    const { namespace, command } = makeNamespace()
    const only = panel('workbook-a')
    mount(only)

    redirectDesignerSave(namespace, { commandMap: {} })
    invoke(command, {})

    expect(only.save).toHaveBeenCalledTimes(1)
  })

  it('stops writing back once the panel is gone', () => {
    const { namespace, command, pristine } = makeNamespace()
    const target = panel('workbook-a')
    mount(target)

    redirectDesignerSave(namespace, { commandMap: {} })
    while (mounted.length > 0) mounted.pop()?.()
    invoke(command, { getWorkbook: () => 'workbook-a' })

    expect(target.save).not.toHaveBeenCalled()
    expect(pristine).toHaveBeenCalledTimes(1)
  })

  it('falls back to the Designer default when nothing can write back', () => {
    const { namespace, command, pristine } = makeNamespace('downloaded')
    const target = panel('workbook-a', false)
    mount(target)
    const context = { getWorkbook: () => 'workbook-a' }

    redirectDesignerSave(namespace, { commandMap: {} })
    const result = invoke(command, context, 'extra')

    expect(target.save).not.toHaveBeenCalled()
    expect(pristine).toHaveBeenCalledTimes(1)
    expect(pristine.mock.calls[0]?.slice(0, 2)).toEqual([context, 'extra'])
    expect(pristine.mock.contexts[0]).toBe(command)
    expect(result).toBe('downloaded')
  })

  it('replaces its own redirect on re-install instead of nesting wrappers', () => {
    const { namespace, command, pristine } = makeNamespace()
    const target = panel('workbook-a')
    mount(target)

    redirectDesignerSave(namespace, { commandMap: {} })
    redirectDesignerSave(namespace, { commandMap: {} })

    invoke(command, { getWorkbook: () => 'workbook-a' })
    expect(target.save).toHaveBeenCalledTimes(1)

    // With no panel left the pristine command must run exactly once: a nested
    // wrapper would delegate through every layer.
    while (mounted.length > 0) mounted.pop()?.()
    invoke(command, { getWorkbook: () => 'workbook-a' })
    expect(pristine).toHaveBeenCalledTimes(1)
  })

  it('does not mutate the command map object it was handed', () => {
    const { namespace } = makeNamespace()
    const original = { undo: {} } as Record<string, unknown>
    const config = { commandMap: original }

    redirectDesignerSave(namespace, config)

    expect(original.save).toBeUndefined()
    expect(config.commandMap).not.toBe(original)
  })

  it('leaves everything alone when the Designer cannot be steered', () => {
    const { namespace, command, pristine } = makeNamespace()

    expect(redirectDesignerSave(undefined, { commandMap: {} })).toBe(false)
    expect(redirectDesignerSave({ getCommand: () => command }, { commandMap: {} })).toBe(false)
    expect(redirectDesignerSave({ CommandNames: {} }, { commandMap: {} })).toBe(false)
    expect(redirectDesignerSave({ CommandNames: { Save: '' } }, { commandMap: {} })).toBe(false)
    expect(redirectDesignerSave({ CommandNames: { Save: 'save' } }, { commandMap: {} })).toBe(false)
    expect(redirectDesignerSave({ CommandNames: { Save: 'save' }, getCommand: () => undefined }, { commandMap: {} })).toBe(false)
    expect(redirectDesignerSave(namespace, undefined)).toBe(false)
    expect(pristine).not.toHaveBeenCalled()
  })
})
