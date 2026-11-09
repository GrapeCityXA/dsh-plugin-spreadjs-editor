/**
 * The editor's display name, in the harness's own language.
 *
 * The harness shows a viewer's `title()` wherever it lists the implementations
 * that can render a file, and it warns about a plain-text fallback by suffix.
 * Until DSH 0.1.7 that list held exactly one workbook candidate — this plugin —
 * so any name would do and any suffix was implicitly binary by being unclaimed.
 * The product now ships its own read-only Excel preview ("表格" / "Spreadsheet",
 * claiming `xlsx`, `xls`, `csv`, `tsv`), so the two sit side by side and the name
 * has to say which one edits.
 *
 * The locale service is attached *optionally*, the same way the spreadjs bridge
 * is (see bridge.ts): a composition without it costs the translation and nothing
 * else, and the shipped dictionaries cover both locales the harness registers —
 * a namespace is registered all at once, and the registry requires every shipped
 * locale in that one call.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only, and never emitted: it makes `LocaleNamespaceMap` augmentable here.
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** This plugin's dictionary namespace; the viewer name plus this panel's own text. */
export const EDITOR_LOCALE_NAMESPACE = 'dsh.spreadjs-editor'

/** Every string this plugin shows that is not part of the Designer's own chrome. */
export type EditorTextKey =
  | 'viewer.title'
  | 'empty.bytes'
  | 'loading.workbook'
  | 'driver.working'
  | 'failure.title'
  | 'failure.scope'
  | 'failure.license'
  | 'failure.origin'
  | 'failure.originUnknown'
  | 'failure.details'
  | 'failure.detailsUnavailable'
  | 'actions.save'
  | 'actions.saveAs'
  | 'actions.saveDirty'
  | 'actions.saveClean'
  | 'saveAs.title'
  | 'saveAs.path'
  | 'saveAs.hint'
  | 'saveAs.confirm'
  | 'saveAs.cancel'
  | 'saveAs.saving'
  | 'saveAs.empty'
  | 'saveAs.badExtension'
  | 'saveAs.notReady'
  | 'saveAs.suffix'
  | 'saveAs.done'
  | 'saveAs.exists'
  | 'saveAs.newerEdits'
  | 'unsaved.dirty'
  | 'unsaved.restored'
  | 'unsaved.stale'
  | 'unsaved.restore'
  | 'unsaved.discard'
  | 'unsaved.kept'
  | 'unsaved.dropped'
  | 'settings.nav'
  | 'settings.hint'
  | 'settings.empty'
  | 'settings.none'
  | 'settings.unavailable'
  | 'settings.notSavedRefused'
  | 'settings.notSavedFailed'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh.spreadjs-editor': EditorTextKey
  }
}

/**
 * The text used when no locale service is composed in — and the Chinese half of
 * every dictionary. Chinese is the shipped default because the Designer this panel
 * hosts is the Chinese build (`spread-sheets-designer-resources-cn`), so the
 * surrounding chrome, including this plugin's Save row, is already Chinese.
 */
const FALLBACK_TEXT: Record<EditorTextKey, string> = {
  'viewer.title': 'SpreadJS 编辑器',
  'empty.bytes': '这个工作簿需要完整的文件内容，请从文件树重新打开。',
  'loading.workbook': '正在载入…',
  'driver.working': 'AI 正在操作此工作簿，暂时无法编辑',
  'failure.title': '无法初始化 SpreadJS 编辑器',
  'failure.scope': '当前文件的编辑器已停止，你仍可关闭或切换标签页，使用其他侧栏功能。',
  'failure.license': '若错误与授权有关，请核对 SpreadJS 和 Designer 两份许可证是否适用于下面的页面来源。更新授权配置后，请重新打开文件。',
  'failure.origin': '页面来源：',
  'failure.originUnknown': '无法读取',
  'failure.details': '错误详情',
  'failure.detailsUnavailable': '无法读取错误详情',
  'actions.save': '保存',
  'actions.saveAs': '另存为…',
  'actions.saveDirty': '有未保存的改动',
  'actions.saveClean': '没有未保存的改动',
  'saveAs.title': '另存为工作区文件',
  'saveAs.path': '工作区路径',
  'saveAs.hint': '路径相对当前会话的工作区。若同名文件已存在，这里不会覆盖它，请换个名字。',
  'saveAs.confirm': '另存为',
  'saveAs.cancel': '取消',
  'saveAs.saving': '正在保存…',
  'saveAs.empty': '请填写工作区路径',
  'saveAs.badExtension': '只支持 .xlsx / .xlsm / .csv / .sjs / .ssjson',
  'saveAs.notReady': '编辑器还没准备好，请稍候再试',
  'saveAs.suffix': '副本',
  'saveAs.done': '已另存为 ',
  'saveAs.exists': '目标文件已存在，请换一个名字',
  'saveAs.newerEdits': '副本已保存，但保存期间的新修改仍在当前文件中，请继续保存。',
  'unsaved.dirty': '未保存的改动',
  'unsaved.restored': '已恢复本会话中未保存的改动。',
  'unsaved.stale': '存在未保存的改动缓存，但文件已在磁盘上被修改。',
  'unsaved.restore': '恢复',
  'unsaved.discard': '丢弃',
  'unsaved.kept': '未保存的改动已保留，切回本标签页即可继续',
  'unsaved.dropped': '已丢弃未保存的改动，重新载入文件',
  // The bridge picker. Named for what the page DOES, not for the brand: the
  // whole product is SpreadJS, so a title saying so told the reader nothing.
  'settings.nav': '电子表格编辑器',
  'settings.hint': '选择由哪个插件驱动你正打开的那张表。被选中的插件会接管那份文档，且仅在它打开期间。',
  'settings.empty': '还没有安装任何桥。桥是让 AI 直接改你正打开的那张表的插件；没有它，这个编辑器照样能打开和保存文件。',
  'settings.none': '不使用',
  'settings.unavailable': '已选择的桥当前不可用；它加载后会自动连接，也可以选择其他桥或「不使用」。',
  'settings.notSavedRefused': '宿主没有接受这次更改，所以它只在你刷新前有效。',
  'settings.notSavedFailed': '这次更改没能保存，所以它只在你刷新前有效。',
}

/** Shown when no locale service is composed in: the plugin's own shipped language. */
export const EDITOR_TITLE_FALLBACK = FALLBACK_TEXT['viewer.title']

/** Both dictionaries, registered in one call because the registry demands balance. */
const DICTIONARIES: { zh: Record<string, string>; en: Record<string, string> } = {
  zh: FALLBACK_TEXT,
  en: {
    'viewer.title': 'SpreadJS Editor',
    'empty.bytes': 'This workbook needs its complete file contents. Reopen it from the file tree.',
    'loading.workbook': 'Loading…',
    'driver.working': 'AI is working on this workbook. Editing is temporarily unavailable.',
    'failure.title': 'SpreadJS Editor could not initialize',
    'failure.scope': 'The editor for this file has stopped. You can still close or switch tabs and use other sidebar features.',
    'failure.license': 'If this error concerns licensing, check that both the SpreadJS and Designer licenses cover the page origin below. Reopen the file after updating the license configuration.',
    'failure.origin': 'Page origin:',
    'failure.originUnknown': 'Unavailable',
    'failure.details': 'Error details',
    'failure.detailsUnavailable': 'Error details are unavailable',
    'actions.save': 'Save',
    'actions.saveAs': 'Save As…',
    'actions.saveDirty': 'There are unsaved changes',
    'actions.saveClean': 'Nothing is unsaved',
    'saveAs.title': 'Save as a workspace file',
    'saveAs.path': 'Workspace path',
    'saveAs.hint': 'The path is relative to this session workspace. An existing file is never overwritten here — choose another name.',
    'saveAs.confirm': 'Save as',
    'saveAs.cancel': 'Cancel',
    'settings.nav': 'Spreadsheet Editor',
    'settings.hint': 'Choose which plugin drives the spreadsheet you have open. The chosen one is handed that document, and only while it is open.',
    'settings.empty': 'No bridge is installed. A bridge is what lets the agent edit the workbook you have open; without one, this editor still opens and saves files.',
    'settings.none': 'None',
    'settings.unavailable': 'The selected bridge is currently unavailable. It will reconnect when loaded; you can also choose another bridge or None.',
    'settings.notSavedRefused': 'The host did not accept this change, so it applies only until you reload.',
    'settings.notSavedFailed': 'This change could not be saved, so it applies only until you reload.',
    'saveAs.saving': 'Saving…',
    'saveAs.empty': 'Enter a workspace path',
    'saveAs.badExtension': 'Only .xlsx, .xlsm, .csv, .sjs or .ssjson',
    'saveAs.notReady': 'The editor is not ready yet; try again in a moment',
    'saveAs.suffix': 'copy',
    'saveAs.done': 'Saved as ',
    'saveAs.exists': 'That file already exists; choose another name',
    'saveAs.newerEdits': 'The copy was saved, but newer edits remain in the current file. Save again to keep them.',
    'unsaved.dirty': 'Unsaved changes',
    'unsaved.restored': 'Restored unsaved changes from this session.',
    'unsaved.stale': 'An unsaved buffer exists, but the file changed on disk.',
    'unsaved.restore': 'Restore',
    'unsaved.discard': 'Discard',
    'unsaved.kept': 'Unsaved changes kept; switch back to this tab to continue',
    'unsaved.dropped': 'Discarded unsaved changes and reloaded the file',
  },
}

/** The `ctx.locale` surface this file uses, declared structurally. */
interface LocaleLike {
  register(namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): () => void
  bind(namespace: string): (key: string) => string
}

function localeOf(ctx: Context): LocaleLike | undefined {
  return (ctx as unknown as { locale?: LocaleLike }).locale
}

/** The bound translator while the locale service is attached. */
let translate: ((key: string) => string) | undefined

/**
 * One of this plugin's own strings, in the harness's current language.
 *
 * Read at call time, so a dictionary that arrives after registration — or a locale
 * switch, which rebinds the module-level translator — is picked up without
 * re-registering anything.
 *
 * @param key - the string to read.
 * @returns the localized text, or the shipped Chinese fallback.
 */
export function editorText(key: EditorTextKey): string {
  try {
    const text = translate?.(key)
    return text === undefined || text === '' ? FALLBACK_TEXT[key] : text
  } catch {
    return FALLBACK_TEXT[key]
  }
}

/**
 * The name the harness lists this implementation under.
 *
 * @returns the localized or fallback display name.
 */
export function editorTitle(): string {
  return editorText('viewer.title')
}

/**
 * Register the dictionaries when a locale service is present. Returns a disposer;
 * calling it when nothing was attached is a no-op, exactly like the bridge.
 *
 * @param ctx - the client plugin context.
 * @returns disposer releasing the optional injection.
 */
export function attachEditorLocale(ctx: Context): () => void {
  const fiber = ctx.inject(['locale'], (child) => {
    child.effect(() => {
      const locale = localeOf(child)
      if (locale === undefined) return () => { /* nothing to release */ }
      let dispose: (() => void) | undefined
      try {
        dispose = locale.register(EDITOR_LOCALE_NAMESPACE, DICTIONARIES)
        translate = locale.bind(EDITOR_LOCALE_NAMESPACE)
      } catch (error) {
        // A namespace already occupied by someone else must not cost the editor.
        console.error('[dsh-spreadjs-editor] locale registration failed:', error)
        translate = undefined
      }
      return () => {
        translate = undefined
        try { dispose?.() } catch { /* already released */ }
      }
    }, 'dsh-spreadjs-editor: locale')
  })
  return () => {
    try { fiber.dispose() } catch { /* already disposed */ }
  }
}
