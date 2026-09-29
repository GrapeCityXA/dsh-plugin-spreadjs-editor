import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The Designer's own File tab is hidden by one CSS rule, and that rule reaches into
 * the product's DOM — the most fragile thing in this plugin's stylesheet. It is pinned
 * here so it cannot rot silently, and so a later edit has to be deliberate.
 *
 * What the shipped build gives the element (measured in SpreadJS Designer 19.2.0):
 * the ribbon draws it from the template registered as `FileMenuButton` —
 * `<div class="gc-designer-fileMenuButton fileMenuButton" data-command=fileMenuButton>`
 * — and the attribute carries the product's *public* command name
 * (`CommandNames.FileMenuButton` is `fileMenuButton`). The element is an ordinary flex
 * item of the ribbon's top row
 * (`.gc-designer-component-container .gc-designer-fileMenuButton` is `position:
 * relative; display: flex`), so `display: none` takes it out without leaving a gap.
 *
 * The product's own rule for the same element is (0,2,0), and its stylesheet is the
 * one the theme swap in `styles.ts` replaces at runtime — either stylesheet can be the
 * later one, so this rule has to win on specificity rather than on order. Hence the
 * repeated scope class, and hence a test that checks it is still repeated.
 */
const css = readFileSync(new URL('../src/client/viewer.css', import.meta.url), 'utf8')
/** Comments name the product's selector too, so counting has to ignore them. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

const SCOPE = '.dsh-spreadjs-panel .dsh-spreadjs-editor '
const BY_COMMAND = "[data-command='fileMenuButton']"
const BY_CLASS = '.gc-designer-fileMenuButton'

/** The whole rule — both selectors and the declaration block. */
function fileTabRule(): string {
  const start = css.indexOf(`${SCOPE}${BY_COMMAND}`)
  expect(start, 'the rule that hides the Designer File tab is gone from viewer.css').toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

/** Its selector list, one entry per comma. */
function fileTabSelectors(): string[] {
  return fileTabRule().slice(0, fileTabRule().indexOf('{')).split(',').map(part => part.trim()).filter(Boolean)
}

describe('the Designer File tab', () => {
  it('is taken out of the ribbon by both of its identities', () => {
    const rule = fileTabRule()
    // The public command name first: a build that renames the private class must not
    // be able to resurrect a Save that downloads instead of writing back.
    expect(rule).toContain(BY_COMMAND)
    // And the class the template actually draws, in case the attribute is dropped.
    expect(rule).toContain(BY_CLASS)
    expect(rule).toContain('display: none')
  })

  it('outranks the product rule for the same element whichever stylesheet lands last', () => {
    const selectors = fileTabSelectors()
    expect(selectors.length).toBe(2)
    for (const selector of selectors) {
      // Three class-level tokens — `.dsh-spreadjs-panel`, `.dsh-spreadjs-editor` and
      // the target itself — against the product's two.
      const specificity = (selector.match(/[.[]/g) ?? []).length
      expect(specificity, `${selector} must outrank (0,2,0)`).toBeGreaterThanOrEqual(3)
    }
  })

  it('never hides anything outside this plugin’s own panel', () => {
    // Exactly one rule, both selectors scoped: no bare `.gc-designer-fileMenuButton`
    // that could hide the File tab of some other Designer on the page.
    expect(declarations.split(BY_CLASS).length - 1).toBe(1)
    expect(declarations.split(BY_COMMAND).length - 1).toBe(1)
    for (const selector of fileTabSelectors()) {
      expect(selector.startsWith(SCOPE.trim())).toBe(true)
    }
  })
})
