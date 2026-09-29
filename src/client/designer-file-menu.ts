/**
 * Make the Designer's File tab do exactly one thing: write this workbook back.
 *
 * **Status: a best-effort consistency patch, not the Save path.** The editor's Save
 * lives in the harness's own document header — the published
 * `sidebar.right.tab.document.actions` slot, see SpreadsheetActions.tsx — and on
 * Ctrl+S through the Save command redirect. Both of those are contracts. This module
 * exists only because the File menu's *rows* dispatch through their own handler
 * instead of the command table, so without it File → Save would still download a copy
 * while every other Save writes the file. Deleting this file costs nothing but that
 * inconsistency: an unrecognised template is reported and left alone, and saving has
 * never depended on it.
 *
 * The File menu is its own world. Its rows dispatch through
 * `FileMenuHandler.processPropertyChanged(context, bindingPath, value)` — reached
 * through the `fileMenuPanel` command's `execute` — not through the command
 * table, so replacing the `save` *command* never stopped the menu's Save from
 * opening a download dialog. Measured in a browser, it kept downloading.
 *
 * The shipped template (read out of
 * `@grapecity-software/spread-sheets-designer`, `fileMenuPanelTemplate`) has two
 * columns, and the identities that matter are nowhere near where a first guess
 * would look:
 *
 * - the left column is five `List`s, all bound to `activeCategory_main`, holding
 *   **seven** items. An item's identity is its `value` (`New`, `OpenSJS`,
 *   `SaveSJS`, `Import`, `Export`, `Print`, `Info`), *not* a binding path — which
 *   is why matching `bindingPath` against `CommandNames.Save` found nothing at
 *   all;
 * - the right column holds seven content panels, one per item, each tagged
 *   `data-activeCategory_main=<value>` and gated by `visibleWhen`. The Save panel
 *   contains the built-in operations this plugin replaces: a SpreadJS-format
 *   filename box and a `button_save_sjs` button that downloads.
 *
 * So the rewrite is:
 *
 * - the nav keeps only the item whose value is `SaveSJS`, and loses the other
 *   six plus the separators that grouped them;
 * - the content column keeps only the panel tagged `SaveSJS`;
 * - inside that panel the title stays and the built-in operations become one
 *   button of ours, shaped exactly like the button it replaces (`type: "Button"`
 *   with a `bindingPath`) so the engine renders and dispatches it the same way.
 *
 * Everything is fail-soft, because none of this is a published contract: an
 * unrecognised template is reported through {@link FileMenuInstallResult.summary}
 * and left alone, and if the nav cannot be found at all a row of our own is added
 * instead of leaving the menu without a Save. The header's Save and Ctrl+S write the
 * file either way.
 */
import { designerSaveTargetFor, type DesignerCommandNames } from './designer-save-command.ts'

/** Binding path of the File-menu row this plugin takes over. */
export const SAVE_TO_WORKSPACE = 'dshSaveToWorkspace'

/** How the action this plugin installs is worded. */
export const SAVE_LABEL = '保存到工作区'

/** The binding every File-menu nav row shares in the shipped template. */
const CATEGORY_BINDING = 'activeCategory_main'

/** The attribute every File-menu content panel carries its category in. */
const CATEGORY_ATTRIBUTE = 'data-activeCategory_main'

/** The `CommandNames` entry that identifies the Save category. */
const SAVE_CATEGORY = 'SaveSJS'

/** The built-in Save panel's own button, which the rewrite replaces. */
const BUILT_IN_SAVE_BUTTON = 'button_save_sjs'

/** The three list properties a Designer template nests its rows in. */
const LIST_KEYS = ['children', 'content', 'items'] as const

/** Marker set on the handler wrapper, so a second install never wraps it twice. */
const HANDLER_MARK = '__dshSpreadjsFileMenuHandler'

export interface FileMenuNode {
  bindingPath?: unknown
  text?: unknown
  value?: unknown
  type?: unknown
  key?: unknown
  attributes?: unknown
  items?: unknown
  [key: string]: unknown
}

/** The Designer namespace surface the File menu is customised through. */
export interface DesignerFileMenuNamespace {
  TemplateNames?: { FileMenuPanelTemplate?: string }
  CommandNames?: DesignerCommandNames
  getTemplate?: (name: string) => unknown
  registerTemplate?: (name: string, template: unknown) => void
  FileMenuHandler?: {
    processPropertyChanged?: (...args: unknown[]) => unknown
    hideFileMenu?: (context: unknown) => unknown
  }
}

export interface FileMenuInstallResult {
  /** Whether the template was rewritten and registered back. */
  installed: boolean
  /** Whether a nav row for Save was found and kept. */
  navKept: boolean
  /** Whether a nav row of ours had to be added instead. */
  navAdded: boolean
  /** Category values removed from the nav, e.g. `['New', 'Import']`. */
  navDropped: string[]
  /** Category values whose content panel was removed. */
  panelsDropped: string[]
  /** Whether the Save panel's built-in operations were replaced by ours. */
  actionsReplaced: boolean
  /** Whether the click handler now answers for {@link SAVE_TO_WORKSPACE}. */
  handler: boolean
  /**
   * A compact description of the template's rows, filled in only when the shape
   * was not recognised — it is not a published contract, so an unfamiliar one has
   * to be reported rather than guessed at.
   */
  summary: string[]
}

interface RewriteState {
  navKept: boolean
  navAdded: boolean
  navDropped: string[]
  panelsDropped: string[]
  actionsReplaced: boolean
  /** Whether anything was found to rewrite at all. */
  recognised: boolean
}

function isNode(value: unknown): value is FileMenuNode {
  return value !== null && typeof value === 'object'
}

function listOf(node: FileMenuNode, key: typeof LIST_KEYS[number]): unknown[] | undefined {
  const value = node[key]
  return Array.isArray(value) ? value : undefined
}

/** Depth-first search for the first list whose entries satisfy a test. */
function findList(root: FileMenuNode, match: (child: FileMenuNode) => boolean): unknown[] | undefined {
  for (const key of LIST_KEYS) {
    const list = listOf(root, key)
    if (list === undefined) continue
    if (list.some(child => isNode(child) && match(child))) return list
  }
  for (const key of LIST_KEYS) {
    const list = listOf(root, key)
    if (list === undefined) continue
    for (const child of list) {
      if (!isNode(child)) continue
      const found = findList(child, match)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** Read one `attributes` entry, which is how content panels name themselves. */
function attributeValue(node: FileMenuNode, key: string): unknown {
  const attributes = node.attributes
  if (!Array.isArray(attributes)) return undefined
  for (const entry of attributes) {
    if (isNode(entry) && entry.key === key) return entry.value
  }
  return undefined
}

/** Whether a row or anything below it carries this binding. */
function holdsBinding(node: FileMenuNode, bindingPath: string): boolean {
  if (node.bindingPath === bindingPath) return true
  for (const key of LIST_KEYS) {
    const list = listOf(node, key)
    if (list === undefined) continue
    for (const child of list) {
      if (isNode(child) && holdsBinding(child, bindingPath)) return true
    }
  }
  return false
}

function valuesOf(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const out: string[] = []
  for (const item of items) {
    if (!isNode(item)) continue
    out.push(typeof item.value === 'string' ? item.value : String(item.text ?? '?'))
  }
  return out
}

/**
 * The action this plugin installs, rebuilt from the block it replaces: the same
 * `ColumnSet` inset, the same 500px `file-menu-setting-container`, and the
 * built-in row's own `margin`/`height`. A Designer button has no intrinsic
 * width — without them the label is unsized, so it wraps and touches the
 * border. (The built-in button next to it is `margin:'10px 50px', width:70,
 * height:30` for a two-character label; this one needs room for six.)
 */
function ourAction(): FileMenuNode {
  return {
    type: 'ColumnSet',
    margin: '20px 0 0 50px',
    children: [{
      type: 'Column',
      children: [{
        type: 'Container',
        className: 'file-menu-setting-container',
        children: [{
          type: 'Button',
          margin: '10px 50px',
          text: SAVE_LABEL,
          width: 140,
          height: 30,
          bindingPath: SAVE_TO_WORKSPACE,
        }],
      }],
    }],
  }
}

/** The nav row this plugin adds when the shipped one cannot be identified. */
function ourNavRow(): FileMenuNode {
  return {
    type: 'List',
    className: 'file-menu-category-list',
    bindingPath: SAVE_TO_WORKSPACE,
    items: [{ text: SAVE_LABEL, value: SAVE_TO_WORKSPACE }],
  }
}

/** Keep the nav row that means Save; drop every other row and separator. */
function rewriteNav(navList: unknown[], saveValue: string, state: RewriteState): void {
  state.recognised = true

  /** The values a nav row loses, given that Save always stays. */
  const droppedValues = (row: unknown): string[] => {
    if (!isNode(row)) return []
    const items = listOf(row, 'items') ?? []
    const keepsSave = items.some(item => isNode(item) && item.value === saveValue)
    return valuesOf(keepsSave ? items.filter(item => !(isNode(item) && item.value === saveValue)) : items)
  }

  // Reported first, in template order; edited back to front so indices hold.
  for (const row of navList) {
    if (isNode(row) && row.bindingPath === CATEGORY_BINDING) state.navDropped.push(...droppedValues(row))
  }
  for (let index = navList.length - 1; index >= 0; index -= 1) {
    const row = navList[index]
    if (!isNode(row)) continue
    if (row.bindingPath !== CATEGORY_BINDING) {
      // Separators grouped the categories that are about to go.
      if (row.type === 'LabelLine') navList.splice(index, 1)
      continue
    }
    const items = listOf(row, 'items')
    const kept = (items ?? []).filter(item => isNode(item) && item.value === saveValue)
    if (kept.length === 0) {
      navList.splice(index, 1)
      continue
    }
    if (items !== undefined) {
      items.length = 0
      items.push(...kept)
    }
    state.navKept = true
  }
}

/** Keep the Save content panel and give it this plugin's action. */
function rewritePanels(panelList: unknown[], saveValue: string, state: RewriteState): void {
  state.recognised = true
  const categoryOf = (panel: unknown): string | undefined => {
    if (!isNode(panel)) return undefined
    const category = attributeValue(panel, CATEGORY_ATTRIBUTE)
    return category === undefined ? undefined : String(category)
  }

  // Reported first, in template order; edited back to front so indices hold.
  for (const panel of panelList) {
    const category = categoryOf(panel)
    if (category !== undefined && category !== saveValue) state.panelsDropped.push(category)
  }
  for (let index = panelList.length - 1; index >= 0; index -= 1) {
    const panel = panelList[index]
    const category = categoryOf(panel)
    if (!isNode(panel) || category === undefined) continue
    if (category !== saveValue) {
      panelList.splice(index, 1)
      continue
    }
    const children = listOf(panel, 'children')
    if (children === undefined || !holdsBinding(panel, BUILT_IN_SAVE_BUTTON)) continue
    // Keep the panel's own heading; the operations under it become one action.
    const heading = children[0]
    children.length = 0
    if (heading !== undefined) children.push(heading)
    children.push(ourAction())
    state.actionsReplaced = true
  }
}

function nameFor(namespace: DesignerFileMenuNamespace, key: string): string | undefined {
  const value = namespace.CommandNames?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Answer this plugin's File-menu row, and leave every other row to the Designer.
 *
 * The wrapper routes by the same workbook identity the Save command redirect
 * uses, so the action writes the workbook it was opened on.
 */
export function redirectDesignerFileMenuSave(namespace: DesignerFileMenuNamespace | undefined): boolean {
  const handler = namespace?.FileMenuHandler
  if (handler === undefined || typeof handler.processPropertyChanged !== 'function') return false
  const current = handler.processPropertyChanged as { [HANDLER_MARK]?: boolean }
  if (current[HANDLER_MARK] === true) return true

  const original = handler.processPropertyChanged
  const wrapper = function (this: unknown, ...args: unknown[]): unknown {
    if (args[1] === SAVE_TO_WORKSPACE) {
      const target = designerSaveTargetFor(args[0])
      if (target !== undefined && target.canWriteBack()) {
        target.save()
        handler.hideFileMenu?.(args[0])
        return undefined
      }
    }
    return original.apply(this, args)
  }
  wrapper[HANDLER_MARK] = true
  handler.processPropertyChanged = wrapper
  return true
}

/** Depth- and length-capped row description, for diagnosing an unknown tree. */
function describeRows(node: FileMenuNode, depth = 0, out: string[] = []): string[] {
  if (depth > 12 || out.length >= 80) return out
  const bindingPath = typeof node.bindingPath === 'string' ? node.bindingPath : ''
  const category = attributeValue(node, CATEGORY_ATTRIBUTE)
  const items = listOf(node, 'items')
  const first = items?.[0]
  const label = typeof node.text === 'string' ? node.text : (isNode(first) && typeof first.text === 'string' ? first.text : '')
  const value = typeof node.value === 'string' ? node.value : ''
  if (bindingPath !== '' || label !== '' || category !== undefined || typeof node.type === 'string') {
    out.push(`${'  '.repeat(depth)}${String(node.type ?? '-')} bp=${bindingPath} value=${value} category=${String(category ?? '')} text=${label}`)
  }
  for (const key of LIST_KEYS) {
    const list = listOf(node, key)
    if (list === undefined) continue
    for (const child of list) {
      if (isNode(child)) describeRows(child, depth + 1, out)
    }
  }
  return out
}

/**
 * Rewrite the File tab so it offers this plugin's Save and nothing else.
 *
 * @param namespace - the Designer namespace, if the package is loaded.
 * @returns what the rewrite did, for logging and tests.
 */
export function installDesignerFileMenu(namespace: DesignerFileMenuNamespace | undefined): FileMenuInstallResult {
  const result: FileMenuInstallResult = {
    installed: false,
    navKept: false,
    navAdded: false,
    navDropped: [],
    panelsDropped: [],
    actionsReplaced: false,
    handler: redirectDesignerFileMenuSave(namespace),
    summary: [],
  }
  const templateName = namespace?.TemplateNames?.FileMenuPanelTemplate
  if (namespace === undefined || typeof templateName !== 'string' || templateName === '') return result

  let template: unknown
  try {
    template = namespace.getTemplate?.(templateName)
  } catch {
    return result
  }
  if (!isNode(template)) return result

  // Described before anything is touched, so a report shows what was actually
  // there rather than what is left after the rewrite.
  const found = describeRows(template)
  const saveValue = nameFor(namespace, SAVE_CATEGORY) ?? SAVE_CATEGORY
  const state: RewriteState = {
    navKept: false,
    navAdded: false,
    navDropped: [],
    panelsDropped: [],
    actionsReplaced: false,
    recognised: false,
  }

  const navList = findList(template, node => node.bindingPath === CATEGORY_BINDING)
  if (navList !== undefined) rewriteNav(navList, saveValue, state)
  const panelList = findList(template, node => attributeValue(node, CATEGORY_ATTRIBUTE) !== undefined)
  if (panelList !== undefined) rewritePanels(panelList, saveValue, state)

  if (!state.navKept && navList !== undefined && !navList.some(row => isNode(row) && row.bindingPath === SAVE_TO_WORKSPACE)) {
    // The Save row could not be identified — another locale, another build — so
    // the menu would otherwise lose its Save entirely.
    navList.push(ourNavRow())
    state.navAdded = true
  }

  result.navKept = state.navKept
  result.navAdded = state.navAdded
  result.navDropped = state.navDropped
  result.panelsDropped = state.panelsDropped
  result.actionsReplaced = state.actionsReplaced
  if (!state.recognised || !state.navKept) result.summary = found

  try {
    namespace.registerTemplate?.(templateName, template)
  } catch {
    return result
  }
  result.installed = true
  return result
}
