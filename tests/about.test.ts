/**
 * The About entry is small but it talks to three of the Designer's own APIs, so
 * what matters is that it lands the button where the product keeps such things
 * and that a renamed API costs us the button rather than the editor.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  ABOUT_COMMAND,
  ABOUT_DIALOG_TEMPLATE,
  aboutDialogTemplate,
  bundledVersions,
  installDesignerAbout,
} from '../src/client/about.ts'
import manifest from '../package.json'

const info = { runtimeLicensed: true, designerLicensed: false }

function configWith(tabs: Array<{ id: string; buttonGroups?: unknown[] }>) {
  return { ribbon: tabs, commandMap: {} as Record<string, { execute: () => void }> }
}

describe('the About dialog', () => {
  it('reports the plugin, the bundled SpreadJS build and the licence state', () => {
    const body = JSON.stringify(aboutDialogTemplate(info))
    expect(body).toContain(manifest.version)
    expect(body).toContain(bundledVersions.spreadjs)
    expect(body).toContain(bundledVersions.designer)
    expect(body).toContain('已配置')
    expect(body).toContain('未配置')
    expect(body).toContain('GrapeCity')
  })

  it('is a titled dialog made of renderable components', () => {
    const template = aboutDialogTemplate(info)
    expect(template.title).toBe('关于 DSH SpreadJS 编辑器')
    expect(Array.isArray(template.content)).toBe(true)
    expect((template.content as Array<{ type?: string }>)[0]?.type).toBe('ColumnSet')
  })
})

describe('installDesignerAbout', () => {
  it('puts the button in the settings tab, ahead of the view tab', () => {
    const registerTemplate = vi.fn()
    const showDialog = vi.fn()
    const target = configWith([
      { id: 'home', buttonGroups: [] },
      { id: 'view', buttonGroups: [] },
      { id: 'settings', buttonGroups: [] },
    ])

    const result = installDesignerAbout({ registerTemplate, showDialog }, target, info)

    expect(result).toMatchObject({ installed: true, registered: true, command: true, ribbonGroup: true, tab: 'settings' })
    expect(registerTemplate).toHaveBeenCalledWith(ABOUT_DIALOG_TEMPLATE, expect.any(Object))
    expect(Object.keys(target.commandMap)).toEqual([ABOUT_COMMAND])
    expect(target.ribbon[0]?.buttonGroups).toHaveLength(0)
    expect(target.ribbon[1]?.buttonGroups).toHaveLength(0)
    expect(target.ribbon[2]?.buttonGroups).toHaveLength(1)

    target.commandMap[ABOUT_COMMAND]!.execute()
    expect(showDialog).toHaveBeenCalledWith(ABOUT_DIALOG_TEMPLATE, {}, expect.any(Function))
  })

  it('accepts the singular spelling of the settings tab', () => {
    const target = configWith([{ id: 'view' }, { id: 'setting' }])
    const result = installDesignerAbout({ registerTemplate: vi.fn(), showDialog: vi.fn() }, target, info)
    expect(result.tab).toBe('setting')
  })

  it('falls back to the view tab when there is no settings tab', () => {
    const target = configWith([{ id: 'home' }, { id: 'view' }, { id: 'data' }])
    const result = installDesignerAbout({ registerTemplate: vi.fn(), showDialog: vi.fn() }, target, info)
    expect(result.tab).toBe('view')
    expect(target.ribbon[1]?.buttonGroups).toHaveLength(1)
  })

  it('does not add a second button to a config that already carries one', () => {
    const commands = { children: [{ direction: 'vertical', commands: [ABOUT_COMMAND] }] }
    const target = configWith([{ id: 'settings', buttonGroups: [{ commandGroup: commands }] }])
    const result = installDesignerAbout({ registerTemplate: vi.fn(), showDialog: vi.fn() }, target, info)
    expect(result.installed).toBe(true)
    expect(target.ribbon[0]?.buttonGroups).toHaveLength(1)
  })

  it('fails soft without the Designer namespace', () => {
    const result = installDesignerAbout(undefined, configWith([{ id: 'settings' }]), info)
    expect(result.installed).toBe(false)
    expect(result.reason).toContain('namespace')
  })

  it('installs the command even when no tab can hold the button, and says so', () => {
    const target = configWith([{ id: 'home' }])
    const result = installDesignerAbout({ registerTemplate: vi.fn(), showDialog: vi.fn() }, target, info)
    expect(result).toMatchObject({ command: true, ribbonGroup: false, installed: false })
    expect(result.reason).toBeTruthy()
  })

  it('fails soft when the product API throws', () => {
    const result = installDesignerAbout(
      { registerTemplate: () => { throw new Error('template API moved') } },
      configWith([{ id: 'setting' }]),
      info,
    )
    expect(result.installed).toBe(false)
    expect(result.reason).toBe('template API moved')
  })
})
