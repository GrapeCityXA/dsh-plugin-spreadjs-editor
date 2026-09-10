import { readFileSync } from 'node:fs'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from '../package.json'
import { CompatibilityNotice, bundledVersions } from '../src/client/CompatibilityNotice.tsx'

function textContent(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (isValidElement<{ children?: ReactNode }>(child)) return textContent(child.props.children)
    return String(child)
  }).join('')
}

afterEach(() => vi.unstubAllGlobals())

describe('bundled version and file compatibility notice', () => {
  it.each([
    ['zh-CN', '保留原文件', '低版本 SpreadJS'],
    ['en-US', 'Keep the original', 'older SpreadJS'],
  ])('keeps both versions and the data-loss warning visible for %s', (language, backup, compatibility) => {
    vi.stubGlobal('navigator', { language })
    const text = textContent(CompatibilityNotice())
    expect(text).toContain(`SpreadJS ${bundledVersions.spreadjs}`)
    expect(text).toContain(`Designer ${bundledVersions.designer}`)
    expect(text).toContain(backup)
    expect(text).toContain(compatibility)
  })

  it('keeps installed versions, dependency pins, and README version tables aligned', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(manifest.devDependencies['@grapecity-software/spread-sheets']).toBe(bundledVersions.spreadjs)
    expect(manifest.devDependencies['@grapecity-software/spread-sheets-designer']).toBe(bundledVersions.designer)
    expect(readme.match(new RegExp(`\\| SpreadJS \\| ${bundledVersions.spreadjs.replaceAll('.', '\\.')} \\|`, 'g'))).toHaveLength(2)
    expect(readme.match(new RegExp(`\\| SpreadJS Designer \\| ${bundledVersions.designer.replaceAll('.', '\\.')} \\|`, 'g'))).toHaveLength(2)
  })
})
