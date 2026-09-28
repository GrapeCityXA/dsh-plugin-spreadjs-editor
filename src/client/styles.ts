/**
 * Stylesheet injection for the client bundle. SpreadJS ships its own CSS and the
 * editor adds a small stylesheet; all of it is inlined as text by the build
 * plugin and injected here at factory materialization (framework style).
 *
 * Two of those sheets are themes rather than static CSS: the workbook's Excel
 * theme and the Designer's own light/dark preset. Both are documented as "at
 * most one at a time — swap the sheet to change the theme", and both have to be
 * swapped rather than recoloured: `GC.Spread.Sheets.Designer.setTheme()` writes
 * the Designer's `--sjs-*` variables, which reaches neither the workbook nor the
 * product's icons (each preset bakes its own SVG data URIs, and the two presets
 * rely on an `invert()` filter whose sense depends on that preset's background).
 * So the presets live in their own tags and are replaced in place, and nothing
 * is layered over them: the preset *is* the theme.
 */
import runtimeLightCss from '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css'
import runtimeDarkCss from '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2016black.css'
import designerLightCss from '@grapecity-software/spread-sheets-designer/styles/gc.spread.sheets.designer.light.min.css'
import designerDarkCss from '@grapecity-software/spread-sheets-designer/styles/gc.spread.sheets.designer.dark.min.css'
import viewerCss from './viewer.css'

/** The tag the workbook's theme lives in; null until styles are injected. */
let runtimeThemeTag: HTMLStyleElement | null = null
/** The tag the Designer's chrome theme lives in; null until styles are injected. */
let designerThemeTag: HTMLStyleElement | null = null
/** Whether the dark pair is the one currently applied. */
let editorThemeDark = false

/**
 * Switch both halves of the editor's theme at once: the workbook's Excel
 * stylesheet and the Designer's chrome preset. Only one sheet of each pair may
 * be active, so the content of each tag is replaced in place — never a second
 * tag. The caller repaints the workbook afterwards (`workbook.refresh()`), which
 * is how a workbook theme change lands. Safe before injection and after
 * disposal.
 */
export function setEditorTheme(dark: boolean): void {
  if (dark === editorThemeDark) return
  editorThemeDark = dark
  if (runtimeThemeTag !== null) runtimeThemeTag.textContent = dark ? runtimeDarkCss : runtimeLightCss
  if (designerThemeTag !== null) designerThemeTag.textContent = dark ? designerDarkCss : designerLightCss
}

/** Inject the stylesheets; returns a disposer that removes the tags. */
export function injectStyles(): () => void {
  const tags: HTMLStyleElement[] = []
  if (typeof document !== 'undefined' && document.head !== null) {
    const add = (role: string, css: string): HTMLStyleElement => {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-spreadjs-editor'
      tag.dataset.role = role
      tag.textContent = css
      document.head.appendChild(tag)
      tags.push(tag)
      return tag
    }
    // The runtime sheet goes first: where it and the Designer's stylesheet meet,
    // the Designer's rules have to win.
    runtimeThemeTag = add('runtime-theme', editorThemeDark ? runtimeDarkCss : runtimeLightCss)
    designerThemeTag = add('designer-theme', editorThemeDark ? designerDarkCss : designerLightCss)
    add('viewer', viewerCss)
  }
  return () => {
    for (const tag of tags) tag.remove()
    runtimeThemeTag = null
    designerThemeTag = null
  }
}
