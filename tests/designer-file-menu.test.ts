import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerDesignerSaveTarget, type DesignerSaveTarget } from '../src/client/designer-save-command.ts'
import {
  installDesignerFileMenu,
  SAVE_LABEL,
  SAVE_TO_WORKSPACE,
  type DesignerFileMenuNamespace,
  type FileMenuNode,
} from '../src/client/designer-file-menu.ts'

type Mock = ReturnType<typeof vi.fn>

/** The shipped template's seven nav items, as `[value, text]`. */
const NEW: [string, string] = ['New', '新建']
const OPEN: [string, string] = ['OpenSJS', '打开']
const SAVE: [string, string] = ['SaveSJS', '保存']
const IMPORT: [string, string] = ['Import', '导入']
const EXPORT: [string, string] = ['Export', '导出']
const PRINT: [string, string] = ['Print', '打印']
const INFO: [string, string] = ['Info', '信息']
const CATEGORIES: Array<[string, string]> = [NEW, OPEN, SAVE, IMPORT, EXPORT, PRINT, INFO]

interface Fixture {
  namespace: DesignerFileMenuNamespace
  /** The nav container's children: a back button plus the category rows. */
  nav: unknown[]
  /** The content column's children: one panel per category. */
  content: unknown[]
  registered: Array<{ name: string; template: unknown }>
  hideFileMenu: Mock
  originalProcessPropertyChanged: Mock
}

/** A nav row, in the shape the shipped template uses. */
function navRow(values: Array<[string, string]>): FileMenuNode {
  return {
    type: 'List',
    listType: 'menu',
    listItemType: 'menuitemradio',
    className: 'file-menu-category-list',
    bindingPath: 'activeCategory_main',
    items: values.map(([value, text]) => ({ text, value })),
  }
}

/** A content panel, in the shape the shipped template uses. */
function panel(category: string, title: string): FileMenuNode {
  return {
    type: 'Container',
    direction: 'vertical',
    attributes: [{ key: 'role', value: 'tabpanel' }, { key: 'data-activeCategory_main', value: category }],
    visibleWhen: `activeCategory_main=${category}`,
    children: [
      { type: 'TextBlock', text: title, style: 'font-size:36px;' },
      {
        type: 'ColumnSet',
        margin: '20px 0 0 50px',
        children: [{
          type: 'Column',
          children: [
            { type: 'TextBlock', text: 'SpreadJS 文件' },
            { type: 'TextEditor', bindingPath: 'saveFileName' },
            { type: 'Button', text: title, bindingPath: 'button_save_sjs' },
          ],
        }],
      },
    ],
  }
}

function fixture(): Fixture {
  const nav: unknown[] = [
    { type: 'Container', className: 'back-button-container', children: [{ type: 'Button', className: 'back-button', bindingPath: 'activeCategory_hide' }] },
    navRow([NEW]),
    { type: 'LabelLine', className: 'seprater-line' },
    // Open and Save share one group in the shipped template.
    navRow([OPEN, SAVE]),
    { type: 'LabelLine', className: 'seprater-line' },
    navRow([IMPORT, EXPORT]),
    { type: 'LabelLine', className: 'seprater-line' },
    navRow([PRINT]),
    { type: 'LabelLine', className: 'seprater-line' },
    navRow([INFO]),
  ]
  const content: unknown[] = CATEGORIES.map(([category, title]) => panel(category, title))
  const template = {
    templateName: 'fileMenuPanelTemplate',
    content: [{
      type: 'FlexContainer',
      children: [{
        type: 'ColumnSet',
        children: [
          { type: 'Column', width: '180px', children: [{ type: 'Container', className: 'gc-file-menu-category', children: nav }] },
          { type: 'Column', className: 'category-content-container', width: 'stretch', children: content },
        ],
      }],
    }],
  }
  const registered: Array<{ name: string; template: unknown }> = []
  const hideFileMenu = vi.fn()
  const originalProcessPropertyChanged = vi.fn()
  return {
    namespace: {
      TemplateNames: { FileMenuPanelTemplate: 'fileMenuPanelTemplate' },
      CommandNames: {
        Save: 'save',
        SaveAs: 'SaveAs',
        SaveSJS: 'SaveSJS',
        OpenSJS: 'OpenSJS',
        New: 'New',
        Import: 'Import',
        Export: 'Export',
        Print: 'Print',
        Info: 'Info',
      },
      getTemplate: () => template,
      registerTemplate: (name, value) => { registered.push({ name, template: value }) },
      FileMenuHandler: { processPropertyChanged: originalProcessPropertyChanged, hideFileMenu },
    },
    nav,
    content,
    registered,
    hideFileMenu,
    originalProcessPropertyChanged,
  }
}

const navRows = (nav: unknown[]): FileMenuNode[] =>
  nav.filter((row): row is FileMenuNode => row !== null && typeof row === 'object' && (row as FileMenuNode).bindingPath === 'activeCategory_main')

const mounted: Array<() => void> = []
function designerPanel(workbook: unknown): DesignerSaveTarget & { save: Mock } {
  const target = { workbook: () => workbook, canWriteBack: () => true, save: vi.fn() }
  mounted.push(registerDesignerSaveTarget(target))
  return target
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.()
})

/** Run the installed handler the way the Designer's File menu would. */
function click(handler: DesignerFileMenuNamespace['FileMenuHandler'], ...args: unknown[]): unknown {
  return handler?.processPropertyChanged?.(...args)
}

describe('installDesignerFileMenu', () => {
  it('keeps only the Save nav item and drops the rest with their separators', () => {
    const { namespace, nav, registered } = fixture()

    const result = installDesignerFileMenu(namespace)

    expect(result.installed).toBe(true)
    expect(result.navKept).toBe(true)
    expect(result.navAdded).toBe(false)
    expect(navRows(nav)).toHaveLength(1)
    const kept = navRows(nav)[0]
    expect(kept?.items).toEqual([{ text: '保存', value: 'SaveSJS' }])
    // Open shared Save's group, so it goes while Save stays.
    expect(result.navDropped).toEqual(['New', 'OpenSJS', 'Import', 'Export', 'Print', 'Info'])
    // The back button survives, the separators do not.
    expect(nav).toHaveLength(2)
    expect((nav[0] as FileMenuNode).bindingPath).toBeUndefined()
    expect((nav[0] as FileMenuNode).className).toBe('back-button-container')
    expect(registered[0]?.name).toBe('fileMenuPanelTemplate')
  })

  it('keeps only the Save content panel', () => {
    const { namespace, content } = fixture()

    const result = installDesignerFileMenu(namespace)

    expect(content).toHaveLength(1)
    const kept = content[0] as FileMenuNode
    expect(kept.attributes).toContainEqual({ key: 'data-activeCategory_main', value: 'SaveSJS' })
    expect(kept.visibleWhen).toBe('activeCategory_main=SaveSJS')
    expect(result.panelsDropped).toEqual(['New', 'OpenSJS', 'Import', 'Export', 'Print', 'Info'])
  })

  it('replaces the built-in save operations with one action of ours', () => {
    const { namespace, content } = fixture()

    const result = installDesignerFileMenu(namespace)

    expect(result.actionsReplaced).toBe(true)
    const kept = content[0] as FileMenuNode
    const children = kept.children as FileMenuNode[]
    // The panel keeps its own heading, so the tab still reads as Save.
    expect(children).toHaveLength(2)
    expect(children[0]?.text).toBe('保存')
    const button = ((children[1]?.children as FileMenuNode[])[0]?.children as FileMenuNode[])[0]
    expect(button).toMatchObject({ type: 'Button', text: SAVE_LABEL, bindingPath: SAVE_TO_WORKSPACE })
    // The built-in filename box and its download button are gone.
    expect(JSON.stringify(kept)).not.toContain('button_save_sjs')
    expect(JSON.stringify(kept)).not.toContain('saveFileName')
  })

  it('is idempotent: a second install adds no second row or action', () => {
    const { namespace, nav, content } = fixture()

    installDesignerFileMenu(namespace)
    const second = installDesignerFileMenu(namespace)

    expect(navRows(nav)).toHaveLength(1)
    expect(content).toHaveLength(1)
    expect((content[0] as FileMenuNode).children).toHaveLength(2)
    expect(second.navAdded).toBe(false)
    // Nothing left to replace on the second pass, and no second action appeared.
    expect(second.actionsReplaced).toBe(false)
    expect(JSON.stringify(content[0]).match(/dshSaveToWorkspace/g) ?? []).toHaveLength(1)
  })

  it('adds a row of its own only when the Save row cannot be identified', () => {
    const { namespace, nav } = fixture()
    // A build whose Save category is named differently.
    ;(namespace.CommandNames as Record<string, unknown>).SaveSJS = 'SaveAsSjs'

    const result = installDesignerFileMenu(namespace)

    expect(result.navKept).toBe(false)
    expect(result.navAdded).toBe(true)
    const ours = navRows(nav).filter(row => row.bindingPath === 'activeCategory_main')
    expect(ours).toHaveLength(0)
    expect(nav.some(row => (row as FileMenuNode).bindingPath === SAVE_TO_WORKSPACE)).toBe(true)
    // The shape could not be recognised, so it is reported for diagnosis.
    expect(result.summary.join('\n')).toContain('category=SaveSJS')
  })

  it('leaves the menu alone when the Designer cannot be steered', () => {
    expect(installDesignerFileMenu(undefined)).toMatchObject({ installed: false, handler: false, summary: [] })
    expect(installDesignerFileMenu({})).toMatchObject({ installed: false })
    expect(installDesignerFileMenu({ TemplateNames: {} })).toMatchObject({ installed: false })
    expect(installDesignerFileMenu({
      TemplateNames: { FileMenuPanelTemplate: 'fileMenuPanelTemplate' },
    })).toMatchObject({ installed: false })
    expect(installDesignerFileMenu({
      TemplateNames: { FileMenuPanelTemplate: 'fileMenuPanelTemplate' },
      CommandNames: { SaveSJS: 'SaveSJS' },
      getTemplate: () => undefined,
    })).toMatchObject({ installed: false })
    // A template whose rows are nowhere to be found is reported, not thrown at.
    const result = installDesignerFileMenu({
      TemplateNames: { FileMenuPanelTemplate: 'fileMenuPanelTemplate' },
      CommandNames: { SaveSJS: 'SaveSJS' },
      getTemplate: () => ({ type: 'Root', children: [{ type: 'TextBlock', text: 'nothing here' }] }),
    })
    expect(result).toMatchObject({ installed: true, navKept: false, navAdded: false, actionsReplaced: false })
    expect(result.summary.length).toBeGreaterThan(0)
  })
})

describe('redirectDesignerFileMenuSave', () => {
  it('writes the workbook back and closes the menu for its own action', () => {
    const { namespace, hideFileMenu, originalProcessPropertyChanged } = fixture()
    const target = designerPanel('workbook-a')
    const context = { getWorkbook: () => 'workbook-a' }

    installDesignerFileMenu(namespace)
    click(namespace.FileMenuHandler, context, SAVE_TO_WORKSPACE, true)

    expect(target.save).toHaveBeenCalledTimes(1)
    expect(hideFileMenu).toHaveBeenCalledWith(context)
    expect(originalProcessPropertyChanged).not.toHaveBeenCalled()
  })

  it('leaves every other row to the Designer', () => {
    const { namespace, originalProcessPropertyChanged } = fixture()
    const context = { getWorkbook: () => 'workbook-a' }

    installDesignerFileMenu(namespace)
    click(namespace.FileMenuHandler, context, 'activeCategory_main', 'Info')

    expect(originalProcessPropertyChanged).toHaveBeenCalledTimes(1)
    expect(originalProcessPropertyChanged.mock.calls[0]?.slice(0, 3)).toEqual([context, 'activeCategory_main', 'Info'])
  })

  it('wraps the handler once no matter how many times a panel installs', () => {
    const { namespace, originalProcessPropertyChanged } = fixture()

    expect(installDesignerFileMenu(namespace).handler).toBe(true)
    expect(installDesignerFileMenu(namespace).handler).toBe(true)
    click(namespace.FileMenuHandler, {}, 'button_save_sjs')

    expect(originalProcessPropertyChanged).toHaveBeenCalledTimes(1)
  })

  it('falls back to the Designer when no panel can write back', () => {
    const { namespace, originalProcessPropertyChanged } = fixture()
    const context = { getWorkbook: () => 'workbook-a' }

    installDesignerFileMenu(namespace)
    click(namespace.FileMenuHandler, context, SAVE_TO_WORKSPACE)

    expect(originalProcessPropertyChanged).toHaveBeenCalledTimes(1)
  })
})
