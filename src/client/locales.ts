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
  | 'empty.newWorkbook'
  | 'empty.bytes'
  | 'loading.workbook'
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
  | 'unsaved.saved'
  | 'unsaved.dirty'
  | 'unsaved.restored'
  | 'unsaved.stale'
  | 'unsaved.restore'
  | 'unsaved.discard'
  | 'unsaved.kept'
  | 'unsaved.dropped'

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
  'empty.newWorkbook': '新工作簿已就绪：用「另存为」写入工作区，或用「导出」下载副本。',
  'empty.bytes': '这个工作簿需要完整的文件内容，请从文件树重新打开。',
  'loading.workbook': '正在载入…',
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
  'unsaved.saved': '已保存',
  'unsaved.dirty': '未保存的改动',
  'unsaved.restored': '已恢复本会话中未保存的改动。',
  'unsaved.stale': '存在未保存的改动缓存，但文件已在磁盘上被修改。',
  'unsaved.restore': '恢复',
  'unsaved.discard': '丢弃',
  'unsaved.kept': '未保存的改动已保留，切回本标签页即可继续',
  'unsaved.dropped': '已丢弃未保存的改动，重新载入文件',
}

/** Shown when no locale service is composed in: the plugin's own shipped language. */
export const EDITOR_TITLE_FALLBACK = FALLBACK_TEXT['viewer.title']

/** Both dictionaries, registered in one call because the registry demands balance. */
const DICTIONARIES: { zh: Record<string, string>; en: Record<string, string> } = {
  zh: FALLBACK_TEXT,
  en: {
    'viewer.title': 'SpreadJS Editor',
    'empty.newWorkbook': 'New workbook ready. Use Save As to write it into the workspace, or Export to download a copy.',
    'empty.bytes': 'This workbook needs its complete file contents. Reopen it from the file tree.',
    'loading.workbook': 'Loading…',
    'actions.save': 'Save',
    'actions.saveAs': 'Save As…',
    'actions.saveDirty': 'There are unsaved changes',
    'actions.saveClean': 'Nothing is unsaved',
    'saveAs.title': 'Save as a workspace file',
    'saveAs.path': 'Workspace path',
    'saveAs.hint': 'The path is relative to this session workspace. An existing file is never overwritten here — choose another name.',
    'saveAs.confirm': 'Save as',
    'saveAs.cancel': 'Cancel',
    'saveAs.saving': 'Saving…',
    'saveAs.empty': 'Enter a workspace path',
    'saveAs.badExtension': 'Only .xlsx, .xlsm, .csv, .sjs or .ssjson',
    'saveAs.notReady': 'The editor is not ready yet; try again in a moment',
    'saveAs.suffix': 'copy',
    'saveAs.done': 'Saved as ',
    'saveAs.exists': 'That file already exists; choose another name',
    'unsaved.saved': 'Saved',
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
