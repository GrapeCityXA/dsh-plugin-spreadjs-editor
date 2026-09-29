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
  | 'unsaved.chip'
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
  'unsaved.chip': '未保存的改动',
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
    'unsaved.chip': 'Unsaved changes',
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
