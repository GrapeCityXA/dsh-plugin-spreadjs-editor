import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The bridge picker is a guest on the harness's own Settings surface, so it is
 * styled by copying that surface's rows — the same doctrine as the document
 * header's buttons (see actions-style.test.ts): a third-party client bundle
 * cannot import the platform's components, because a module that fails to
 * resolve takes the whole editor down rather than merely looking off.
 *
 * The values come from the product's own settings pages, measured off
 * `@deepseek-ai/dsh-client-ui-settings-general` (`Pt1bsG_row`, `Pt1bsG_title`,
 * `Pt1bsG_description`): a `.5px` hairline in `--dsw-alias-border-l2`, 16px of
 * vertical padding, a 24px gap between the label and whatever sits on the right,
 * a 14px/20px title and 12px/18px supporting text.
 *
 * The first test is the one that matters most, because the page's original
 * failure was not a wrong value but an ABSENT rule: a `<button>` with no styling
 * wears the platform's default chrome, and two adjacent spans with no `gap`
 * collapse into one run of text.
 */
const css = readFileSync(new URL('../src/client/viewer.css', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/client/settings-page.tsx', import.meta.url), 'utf8')

/** The block this file is about; it is appended last, so it runs to the end. */
const settingsCss = css.slice(css.indexOf('/* The bridge picker'))

/** The body of one rule, by its exact selector line. */
function ruleFor(selector: string): string {
  const start = settingsCss.indexOf(`${selector} {`)
  expect(start, `${selector} is missing from the settings rules`).toBeGreaterThan(-1)
  return settingsCss.slice(start, settingsCss.indexOf('}', start))
}

describe('the settings page is styled at all', () => {
  it('has a rule for every class the page draws', () => {
    // Read off the component rather than listed here, so a class added to the
    // markup and forgotten in the stylesheet fails as this test rather than as a
    // grey browser button in front of a user.
    const drawn = new Set(
      [...page.matchAll(/className="(dsh-spreadjs-[a-z-]+)"/gu)].map(match => match[1]),
    )
    expect(drawn.size).toBeGreaterThan(4)
    const unstyled = [...drawn].filter(name => !settingsCss.includes(`.${name}`))
    expect(unstyled).toEqual([])
  })

  it('uses tokens only, so the page follows the active palette', () => {
    // A literal colour would freeze this page into whichever theme it was
    // written in, while every surface around it swaps tokens.
    const literals = [...settingsCss.matchAll(/(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/gu)].map(m => m[0])
    expect(literals).toEqual([])
  })
})

describe('a row reads as one of the harness’s own settings rows', () => {
  it('is a full-width line with the surface’s spacing and separator', () => {
    const row = ruleFor('.dsh-spreadjs-settings-row')
    expect(row).toContain('width: 100%')
    expect(row).toContain('padding: 16px 8px')
    expect(row).toContain('gap: 24px')
    expect(row).toContain('justify-content: space-between')
    expect(row).toContain('border-bottom: .5px solid var(--dsw-alias-border-l2)')
  })

  it('drops the browser’s own button chrome', () => {
    // Without these the row keeps the platform's default look — grey, centred,
    // inset — which is exactly what the page shipped as at first.
    const row = ruleFor('.dsh-spreadjs-settings-row')
    expect(row).toContain('appearance: none')
    expect(row).toContain('font: inherit')
    expect(row).toContain('text-align: left')
    expect(row).toContain('background: transparent')
    expect(row).toContain('color: inherit')
  })

  it('keeps a separator BETWEEN rows and none under the last one', () => {
    const last = ruleFor('.dsh-spreadjs-settings-row:last-child')
    expect(last).toContain('border-bottom: none')
  })

  it('marks hover, press and focus the way the surface does', () => {
    expect(ruleFor('.dsh-spreadjs-settings-row:hover')).toContain('background: var(--dsw-alias-interactive-bg-hover)')
    expect(ruleFor('.dsh-spreadjs-settings-row:active')).toContain('background: var(--dsw-alias-interactive-bg-active)')
    // Inset, so the ring does not collide with the hairline stack.
    const focus = ruleFor('.dsh-spreadjs-settings-row:focus-visible')
    expect(focus).toContain('outline: 2px solid var(--dsw-alias-brand-primary)')
    expect(focus).toContain('outline-offset: -2px')
  })

  it('sets the title at the surface’s 14px/20px, and the prose at 12px/18px', () => {
    expect(ruleFor('.dsh-spreadjs-settings-row-title')).toContain('font-size: 14px')
    expect(ruleFor('.dsh-spreadjs-settings-row-title')).toContain('line-height: 20px')
    for (const prose of ['.dsh-spreadjs-settings-hint', '.dsh-spreadjs-settings-warning']) {
      expect(ruleFor(prose)).toContain('font-size: 12px')
      expect(ruleFor(prose)).toContain('line-height: 18px')
      expect(ruleFor(prose)).toContain('margin')
    }
    expect(ruleFor('.dsh-spreadjs-settings-hint')).toContain('color: var(--dsw-alias-label-secondary)')
  })

  it('warns rather than alarms when a write did not land', () => {
    // The choice IS in force; only its persistence failed. An error colour would
    // say the opposite.
    expect(ruleFor('.dsh-spreadjs-settings-warning')).toContain('color: var(--dsw-alias-state-warn-primary)')
  })
})

describe('the chosen row is marked, not worded', () => {
  it('reserves the mark’s box always, so selecting moves no layout', () => {
    const mark = ruleFor('.dsh-spreadjs-settings-row-mark')
    expect(mark).toContain('flex: none')
    expect(mark).toContain('width: 16px')
    expect(mark).toContain('height: 16px')
    // Hidden by visibility, not by display: the box stays, only the ink goes.
    expect(mark).toContain('visibility: hidden')
  })

  it('shows it only on the checked row, in the selection colour', () => {
    expect(ruleFor('.dsh-spreadjs-settings-row-mark')).toContain('color: var(--dsw-alias-brand-primary)')
    const checked = ruleFor(".dsh-spreadjs-settings-row[aria-checked='true'] .dsh-spreadjs-settings-row-mark")
    expect(checked).toContain('visibility: visible')
  })

  it('draws the tick from a border box rather than an icon font', () => {
    // No image to embed, no font to load, and `currentColor` inherits the row's
    // mark colour, so theme and state cannot drift apart.
    const tick = ruleFor('.dsh-spreadjs-settings-row-mark::before')
    expect(tick).toContain('border: solid currentColor')
    expect(tick).toContain('transform: rotate(45deg)')
  })
})
