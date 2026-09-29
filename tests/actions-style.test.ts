import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The document header's Save and Save As are styled by *copying* the controls they
 * sit next to, rather than by importing the platform's own button component: a
 * third-party client bundle cannot assume an internal `@deepseek-ai/*` package
 * resolves at load time, and a failure there would take the whole editor down
 * instead of merely looking off. The copy is therefore a decision, and this file
 * pins it so a later edit has to be a deliberate one.
 *
 * The source of the copied values is the header's own controls in
 * `@deepseek-ai/dsh-client-ui-sidebar-documentpreview`: `.dhJKeW_tool` and
 * `.dhJKeW_viewerTool` (the reload and viewer-name buttons) are 28px tall,
 * `font-size: 12px`, in `--dsw-alias-label-secondary`, lightening to
 * `--dsw-alias-label-primary` on `--dsw-alias-interactive-bg-hover`, with disabled
 * controls dropping to `--dsw-alias-label-tertiary` and the default cursor. The
 * primitives package's compact `Button` agrees on the same 28px/12px pair.
 */
const css = readFileSync(new URL('../src/client/viewer.css', import.meta.url), 'utf8')

/** The body of one rule, by its exact selector line. */
function ruleFor(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} is missing from viewer.css`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('document header action styles', () => {
  it('gives the buttons the size and typography of the controls beside them', () => {
    const rule = ruleFor('.dsh-spreadjs-actions-button')
    expect(rule).toContain('height: 28px')
    expect(rule).toContain('padding: 0 6px')
    expect(rule).toContain('font-size: 12px')
    expect(rule).toContain('line-height: 18px')
    expect(rule).toContain('border-radius: var(--dsw-radius-sm)')
    // Borderless like the viewer-name button: any stroke here would make the pair
    // look like a second toolbar next to the product's split button.
    expect(rule).toContain('border: none')
    expect(rule).toContain('box-sizing: border-box')
  })

  it('keeps the header’s quiet-normal, loud-hover colour pair', () => {
    expect(ruleFor('.dsh-spreadjs-actions-button')).toContain('color: var(--dsw-alias-label-secondary)')
    const hover = ruleFor('.dsh-spreadjs-actions-button:hover:not(:disabled)')
    expect(hover).toContain('color: var(--dsw-alias-label-primary)')
    expect(hover).toContain('background: var(--dsw-alias-interactive-bg-hover)')
  })

  it('quiets a disabled button instead of fading it', () => {
    // The harness dims nothing here; it switches to tertiary text and stops
    // responding, so the row's contrast never changes shape while a save runs.
    const disabled = ruleFor('.dsh-spreadjs-actions-button:disabled')
    expect(disabled).toContain('color: var(--dsw-alias-label-tertiary)')
    expect(disabled).toContain('cursor: default')
    expect(ruleFor('.dsh-spreadjs-actions-button:disabled:hover')).toContain('background: transparent')
  })

  it('marks unsaved work with a dot that cannot be squeezed out of the row', () => {
    const dot = ruleFor('.dsh-spreadjs-actions-dot')
    expect(dot).toContain('flex: none')
    expect(dot).toContain('width: 6px')
    expect(dot).toContain('height: 6px')
    expect(dot).toContain('background: var(--dsw-alias-state-business-primary)')
  })
})
