/**
 * Stylesheet injection for the client bundle. SpreadJS ships its own CSS and
 * the viewer adds a small stylesheet; both are inlined as text by the build
 * plugin and injected here at factory materialization (framework style).
 */
import spreadSheetsCss from '@grapecity/spread-sheets/styles/gc.spread.sheets.css'
import viewerCss from './viewer.css'

const STYLES = [spreadSheetsCss, viewerCss]

/** Inject the stylesheets; returns a disposer that removes the tags. */
export function injectStyles(): () => void {
  const tags: HTMLStyleElement[] = []
  if (typeof document !== 'undefined' && document.head !== null) {
    for (const css of STYLES) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-spreadjs-editor'
      tag.textContent = css
      document.head.appendChild(tag)
      tags.push(tag)
    }
  }
  return () => {
    for (const tag of tags) tag.remove()
  }
}
