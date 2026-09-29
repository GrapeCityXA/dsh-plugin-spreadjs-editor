/**
 * The editor's link to the harness palette.
 *
 * The panel's own chrome needs nothing from here: it reads the `--dsw-*` tokens,
 * which the harness swaps wholesale when the palette changes (see viewer.css).
 * The *editor* cannot do that — SpreadJS ships two Excel stylesheets and two
 * Designer presets, and requires exactly one of each, swapped by replacing a tag
 * (see styles.ts) — so it has to be told which scheme is active.
 *
 * That answer comes from the harness's theme service, never from
 * `prefers-color-scheme`: the stored preference may be `light` or `dark` while
 * the OS reports the other one, and a `system` preference is resolved upstream
 * (including the live OS flips that come with it). `ctx.theme` is the only place
 * that knows which scheme the user is actually looking at.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Listeners awaiting the next resolved-scheme flip. */
const listeners = new Set<(dark: boolean) => void>()

/** The resolved palette as the last snapshot reported it (light until told). */
let dark = false

/** Whether the harness is currently rendering its dark palette. */
export function harnessThemeIsDark(): boolean {
  return dark
}

/**
 * Subscribe to the resolved palette. A listener runs only when the scheme
 * actually flips: a preference change that resolves to the same scheme, a
 * content font-size change, or a theme re-registration of the same colour
 * scheme notifies nobody.
 * @param listener - called with the newly resolved scheme.
 * @returns disposer removing this subscription.
 */
export function onHarnessThemeChange(listener: (dark: boolean) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Follow the harness theme service for the lifetime of the plugin fiber. It runs
 * before any panel mounts, so the first Designer is constructed on the scheme the
 * user chose rather than the one the OS reports.
 * @param ctx - the client plugin context, with `theme` injected.
 * @returns disposer releasing the harness subscription.
 */
export function attachHarnessTheme(ctx: Context): () => void {
  const adopt = (snapshot: ThemeSnapshot): void => {
    // `active.colorScheme`, never the id: a registered third-party theme
    // declares which base palette it builds on, and `system` was resolved
    // before the snapshot was published.
    const next = snapshot.active.colorScheme === 'dark'
    if (next === dark) return
    dark = next
    for (const listener of [...listeners]) listener(next)
  }
  adopt(ctx.theme.getTheme())
  const off = ctx.on('theme/change', adopt)
  return () => {
    off()
  }
}
