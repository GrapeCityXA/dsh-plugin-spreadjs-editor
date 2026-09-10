import { readFileSync } from 'node:fs'
import { Children, isValidElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import manifest from '../package.json'
import { VersionLabel, bundledVersions } from '../src/client/VersionLabel.tsx'

function textContent(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (isValidElement<{ children?: ReactNode }>(child)) return textContent(child.props.children)
    return String(child)
  }).join('')
}

describe('bundled version label', () => {
  it('shows only the SpreadJS version', () => {
    expect(textContent(VersionLabel())).toBe(`SpreadJS ${bundledVersions.spreadjs}`)
  })

  it('keeps installed versions, dependency pins, and README version tables aligned', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(manifest.devDependencies['@grapecity-software/spread-sheets']).toBe(bundledVersions.spreadjs)
    expect(manifest.devDependencies['@grapecity-software/spread-sheets-designer']).toBe(bundledVersions.designer)
    expect(readme.match(new RegExp(`\\| SpreadJS \\| ${bundledVersions.spreadjs.replaceAll('.', '\\.')} \\|`, 'g'))).toHaveLength(2)
    expect(readme.match(new RegExp(`\\| SpreadJS Designer \\| ${bundledVersions.designer.replaceAll('.', '\\.')} \\|`, 'g'))).toHaveLength(2)
  })
})
