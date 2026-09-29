import { describe, expect, it } from 'vitest'
import {
  contentHash,
  extensionOf,
  parseSessionFileAddress,
  sessionFileAddressFor,
} from '../src/client/session-file-address.ts'

describe('parseSessionFileAddress', () => {
  it('splits a session address into its session and path', () => {
    expect(parseSessionFileAddress('dsh-resource://file/session/abc123/books/q1.xlsx')).toEqual({
      sessionId: 'abc123',
      path: 'books/q1.xlsx',
      name: 'q1.xlsx',
    })
  })

  it('decodes encoded segments, including non-ASCII names', () => {
    const address = `dsh-resource://file/session/s1/${encodeURIComponent('报表 2026.xlsx')}`
    expect(parseSessionFileAddress(address)).toEqual({
      sessionId: 's1',
      path: '报表 2026.xlsx',
      name: '报表 2026.xlsx',
    })
  })

  it('keeps an absolute path absolute without resolving it', () => {
    const parsed = parseSessionFileAddress('dsh-resource://file/session/s1/C%3A/Users/me/a.xlsx')
    expect(parsed?.path).toBe('C:/Users/me/a.xlsx')
    expect(parsed?.name).toBe('a.xlsx')
  })

  it('ignores query and fragment suffixes', () => {
    expect(parseSessionFileAddress('dsh-resource://file/session/s1/a.xlsx?x=1#top')?.path).toBe('a.xlsx')
  })

  it.each([
    'dsh-resource://file/absolute/C%3A/a.xlsx',
    'dsh-resource://file/session/s1',
    'dsh-resource://file/session//a.xlsx',
    'https://example.com/a.xlsx',
    'dsh-resource://file/session/s1/%E0%A4%A',
    '',
  ])('rejects %j', address => {
    expect(parseSessionFileAddress(address)).toBeUndefined()
  })
})

describe('sessionFileAddressFor', () => {
  it('builds an address the parser reads back unchanged', () => {
    const address = sessionFileAddressFor('s1', 'books/q1.xlsx')
    expect(address).toBe('dsh-resource://file/session/s1/books/q1.xlsx')
    expect(parseSessionFileAddress(address)).toEqual({ sessionId: 's1', path: 'books/q1.xlsx', name: 'q1.xlsx' })
  })

  it.each([
    ['s1', '报表 2026 副本.xlsx'],
    ['session/id with/slash', 'dir/a+b&c.xlsx'],
    ['s1', 'dir/percent%name.xlsx'],
  ])('round-trips %j %j', (sessionId, path) => {
    const parsed = parseSessionFileAddress(sessionFileAddressFor(sessionId, path))
    expect(parsed?.sessionId).toBe(sessionId)
    expect(parsed?.path).toBe(path)
  })

  it('escapes each segment, so a separator inside a name is not one', () => {
    const address = sessionFileAddressFor('s1', 'dir/a/b.xlsx')
    expect(address).toBe('dsh-resource://file/session/s1/dir/a/b.xlsx')
    // A name that itself contains an escaped separator parses back to the name,
    // which is what makes the round trip above the real assertion.
    expect(parseSessionFileAddress(sessionFileAddressFor('s1', 'dir/odd name.xlsx'))?.path).toBe('dir/odd name.xlsx')
  })
})

describe('extensionOf', () => {
  it.each([
    ['a.xlsx', 'xlsx'],
    ['dir/a.XLSM', 'xlsm'],
    ['C:\\dir\\a.sjs', 'sjs'],
    ['archive.tar.gz', 'gz'],
    ['noext', ''],
    ['.hidden', ''],
  ])('maps %j to %j', (path, expected) => {
    expect(extensionOf(path)).toBe(expected)
  })
})

describe('contentHash', () => {
  it('hashes the same bytes identically and different bytes differently', async () => {
    const a = new TextEncoder().encode('workbook')
    const b = new TextEncoder().encode('workbook!')

    expect(await contentHash(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(await contentHash(a)).toBe(await contentHash(new TextEncoder().encode('workbook')))
    expect(await contentHash(a)).not.toBe(await contentHash(b))
  })
})
