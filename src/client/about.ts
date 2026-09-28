/**
 * The plugin's "About" entry: a button in the Designer's ribbon that opens a
 * dialog describing what this editor is made of. The panel used to carry that
 * information in a permanent status bar; versions belong in a dialog, and a
 * ribbon is where the product keeps its own commands.
 *
 * Everything here is fail-soft. `ribbon`, `commandMap`, `registerTemplate` and
 * `showDialog` are the Designer's own APIs: a build that renames any of them
 * must cost us the About button and nothing else, so the installer reports what
 * it managed to do instead of throwing.
 */
import sheetsPackage from '@grapecity-software/spread-sheets/package.json'
import designerPackage from '@grapecity-software/spread-sheets-designer/package.json'
import pluginPackage from '../../package.json'

export const bundledVersions = {
  plugin: pluginPackage.version,
  spreadjs: sheetsPackage.version,
  designer: designerPackage.version,
} as const

export const ABOUT_DIALOG_TEMPLATE = 'dshSpreadjsAboutDialog'
export const ABOUT_COMMAND = 'dshSpreadjsAbout'

/**
 * The product's own metadata says `license: "Commercial"`, author
 * `GrapeCity Software inc`; the copyright line names them rather than inventing
 * a notice of our own.
 */
const COPYRIGHT = 'SpreadJS 与 SpreadJS Designer 版权归 GrapeCity Software inc 所有，商业授权（Commercial）。'

/**
 * The Designer namespace surface the About button needs. Loosely typed on
 * purpose: these are the product's own APIs, we only ever fire and forget, and a
 * precise signature here would fight the strictness of whatever the host's own
 * namespace type declares.
 */
export interface DesignerAboutNamespace {
  registerTemplate?: (...args: any[]) => unknown
  showDialog?: (...args: any[]) => unknown
}

export interface AboutInfo {
  /** Whether a SpreadJS runtime licence key is configured. */
  runtimeLicensed: boolean
  /** Whether a Designer licence key is configured. */
  designerLicensed: boolean
}

export interface AboutInstallResult {
  installed: boolean
  registered: boolean
  command: boolean
  ribbonGroup: boolean
  /** The ribbon tab the button landed in, when it landed. */
  tab?: string
  /** Why it did not fully install, when it did not. */
  reason?: string
}

interface RibbonTabLike {
  id?: unknown
  buttonGroups?: unknown[]
  [key: string]: unknown
}

interface ConfigLike {
  ribbon?: unknown
  commandMap?: Record<string, unknown>
  [key: string]: unknown
}

/** The dialog body: what this editor is, and what it is built from. */
export function aboutDialogTemplate(info: AboutInfo): Record<string, unknown> {
  const { plugin, spreadjs, designer } = bundledVersions
  const key = (licensed: boolean): string => (licensed ? '已配置' : '未配置')
  return {
    title: '关于 DSH SpreadJS 编辑器',
    content: [{
      type: 'ColumnSet',
      margin: '12px 18px',
      children: [{
        type: 'Column',
        width: 'stretch',
        children: [
          { type: 'TextBlock', text: 'DSH SpreadJS 编辑器', style: 'font-size:18px;font-weight:600;' },
          { type: 'TextBlock', margin: '10px 0 0 0', text: `插件版本 ${plugin}` },
          { type: 'TextBlock', margin: '4px 0 0 0', text: `SpreadJS ${spreadjs} · SpreadJS Designer ${designer}` },
          {
            type: 'TextBlock',
            margin: '4px 0 0 0',
            text: `授权：SpreadJS ${key(info.runtimeLicensed)} · Designer ${key(info.designerLicensed)}`,
          },
          { type: 'TextBlock', margin: '12px 0 0 0', text: COPYRIGHT },
        ],
      }],
    }],
  }
}

/**
 * Where a product keeps its own "about", best first. The shipped Designer's tab
 * id is `settings` while its text resource reads `ribbon.setting.setting` — the
 * singular spelling is not the id, which is how this button first landed in the
 * view tab. Both spellings are accepted; `view` is the last resort.
 */
const PREFERRED_TABS = ['settings', 'setting', 'view']

function ribbonTabs(ribbon: unknown): RibbonTabLike[] {
  return Array.isArray(ribbon)
    ? ribbon.filter((tab): tab is RibbonTabLike => typeof tab === 'object' && tab !== null)
    : []
}

function findTab(tabs: RibbonTabLike[]): RibbonTabLike | undefined {
  for (const id of PREFERRED_TABS) {
    const tab = tabs.find(candidate => candidate.id === id)
    if (tab !== undefined) return tab
  }
  return undefined
}

function hasAboutGroup(tab: RibbonTabLike): boolean {
  const groups = Array.isArray(tab.buttonGroups) ? tab.buttonGroups : []
  return groups.some((group) => {
    const children = (group as { commandGroup?: { children?: Array<{ commands?: unknown[] }> } } | null)
      ?.commandGroup?.children
    return Array.isArray(children)
      && children.some(child => Array.isArray(child?.commands) && child.commands.includes(ABOUT_COMMAND))
  })
}

/**
 * Put the About button in the ribbon and register its dialog. Returns what
 * actually happened so the host can log it — an unrecognised template must be
 * visible in the console, not silent.
 */
export function installDesignerAbout(
  namespace: DesignerAboutNamespace | undefined,
  config: unknown,
  info: AboutInfo,
): AboutInstallResult {
  const result: AboutInstallResult = { installed: false, registered: false, command: false, ribbonGroup: false }
  if (namespace === undefined) return { ...result, reason: 'the Designer namespace is unavailable' }
  try {
    if (typeof namespace.registerTemplate === 'function') {
      namespace.registerTemplate(ABOUT_DIALOG_TEMPLATE, aboutDialogTemplate(info))
      result.registered = true
    }
    if (config === null || typeof config !== 'object') {
      return { ...result, reason: 'the Designer config is unavailable' }
    }
    const target = config as ConfigLike
    if (target.commandMap === null || typeof target.commandMap !== 'object') target.commandMap = {}
    target.commandMap[ABOUT_COMMAND] = {
      title: '关于',
      text: '关于',
      iconClass: 'ribbon-button-spreadgeneral',
      bigButton: true,
      commandName: ABOUT_COMMAND,
      execute: () => { namespace.showDialog?.(ABOUT_DIALOG_TEMPLATE, {}, () => {}) },
    }
    result.command = true
    const tab = findTab(ribbonTabs(target.ribbon))
    if (tab !== undefined) {
      if (!Array.isArray(tab.buttonGroups)) tab.buttonGroups = []
      if (!hasAboutGroup(tab)) {
        tab.buttonGroups.push({
          label: '关于',
          thumbnailClass: '',
          commandGroup: { children: [{ direction: 'vertical', commands: [ABOUT_COMMAND] }] },
        })
      }
      result.ribbonGroup = true
      result.tab = String(tab.id)
    }
    result.installed = result.registered && result.command && result.ribbonGroup
    if (!result.installed) result.reason = 'no ribbon tab could hold the About button'
    return result
  } catch (error) {
    return { ...result, reason: error instanceof Error ? error.message : String(error) }
  }
}
