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

/** This plugin's dictionary namespace; one key, the name the viewer list shows. */
export const EDITOR_LOCALE_NAMESPACE = 'dsh.spreadjs-editor'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh.spreadjs-editor': 'viewer.title'
  }
}

/** Shown when no locale service is composed in: the plugin's own shipped language. */
export const EDITOR_TITLE_FALLBACK = 'SpreadJS 编辑器'

/** Both dictionaries, registered in one call because the registry demands balance. */
const DICTIONARIES: { zh: Record<string, string>; en: Record<string, string> } = {
  zh: { 'viewer.title': 'SpreadJS 编辑器' },
  en: { 'viewer.title': 'SpreadJS Editor' },
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
 * The name the harness lists this implementation under. Read at call time, so a
 * dictionary that arrives after registration — or a locale switch — is picked up
 * without re-registering the definition.
 *
 * @returns the localized or fallback display name.
 */
export function editorTitle(): string {
  try {
    const text = translate?.('viewer.title')
    return text === undefined || text === '' ? EDITOR_TITLE_FALLBACK : text
  } catch {
    return EDITOR_TITLE_FALLBACK
  }
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
