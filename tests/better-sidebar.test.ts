import { describe, expect, it } from 'vitest'
import {
  sidebarAbsolutePath,
  sidebarFileUrl,
  sidebarUploadUrl,
} from '../src/client/better-sidebar.ts'

describe('better-sidebar helpers', () => {
  it('builds the raw media URL with the session scope', () => {
    const url = sidebarFileUrl(
      { sessionId: 's1', cwd: 'C:/work' },
      'C:/work/data.xlsx',
    )
    expect(url).toBe('/sidebar/file?sessionId=s1&path=C%3A%2Fwork%2Fdata.xlsx&cwd=C%3A%2Fwork')
  })

  it('resolves a relative path against the session cwd', () => {
    expect(sidebarAbsolutePath('data.xlsx', 'C:/work')).toBe('C:/work/data.xlsx')
    expect(sidebarAbsolutePath('C:/work/data.xlsx', 'C:/other')).toBe('C:/work/data.xlsx')
  })

  it('builds the upload URL from an absolute path', () => {
    const url = sidebarUploadUrl(
      { sessionId: 's1', cwd: 'C:/work' },
      'C:/work/sub/data.xlsx',
    )
    expect(url).toContain('sessionId=s1')
    expect(url).toContain('dir=C%3A%2Fwork%2Fsub')
    expect(url).toContain('relativePath=data.xlsx')
    expect(url).toContain('cwd=C%3A%2Fwork')
  })
})
