/**
 * The one file address form this plugin receives, and the identity it carries.
 *
 * The harness addresses every Sidebar document as
 * `dsh-resource://file/session/<sessionId>/<path>`, and only session-scoped
 * addresses are routed to a document implementation at all. The path may be
 * relative to that session's workspace or absolute; this module resolves
 * neither — it splits the address so a save request can carry the same pair the
 * harness itself routes on, and lets the host half do the authoritative
 * resolution.
 *
 * Deliberately dependency-free: the harness's own parser lives behind an
 * internal module path, and re-implementing the four lines of grammar here is
 * cheaper than depending on a private entry point.
 */

/** The scheme and type every file address opens with. */
const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

/** The parts of one session-scoped file address. */
export interface SessionFileAddress {
  /** The session whose workspace the path belongs to. */
  readonly sessionId: string
  /** The path as the address encoded it, decoded, with no resolution applied. */
  readonly path: string
  /** The last path segment, for labels and extension detection. */
  readonly name: string
}

/**
 * Split a `dsh-resource://file/session/…` address into its session and path.
 * Query and fragment suffixes are ignored, matching the harness parser.
 *
 * @param address - a candidate address.
 * @returns the parts, or `undefined` when the address is not a session-scoped
 *   file address or carries no path.
 */
export function parseSessionFileAddress(address: string): SessionFileAddress | undefined {
  if (!address.startsWith(FILE_ADDRESS_PREFIX)) return undefined
  const end = address.search(/[?#]/u)
  const body = address.slice(FILE_ADDRESS_PREFIX.length, end === -1 ? undefined : end)
  const [scope, ...rest] = body.split('/')
  if (scope !== 'session') return undefined
  const [id, ...segments] = rest
  if (id === undefined || id === '' || segments.length === 0) return undefined
  try {
    const sessionId = decodeURIComponent(id)
    const path = segments.map(decodeURIComponent).join('/')
    return { sessionId, path, name: path.split('/').pop() ?? path }
  } catch {
    // A malformed percent escape is not an address this plugin can act on.
    return undefined
  }
}

/**
 * The lower-cased extension of a path, without the leading dot.
 *
 * @param path - a file name or path.
 * @returns the extension, or an empty string when there is none.
 */
export function extensionOf(path: string): string {
  const name = path.split(/[\\/]/u).pop() ?? path
  const index = name.lastIndexOf('.')
  return index <= 0 ? '' : name.slice(index + 1).toLowerCase()
}

/**
 * Content hash of one buffer, used as the freshness token a save guards
 * against. The browser has no `FsVersion`, so the loaded bytes are their own
 * version: the host compares this against the file on disk before replacing it,
 * and a mismatch means someone else wrote the file since it was opened.
 *
 * @param bytes - the complete file bytes.
 * @returns the lower-case hex SHA-256 digest.
 */
export async function contentHash(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
