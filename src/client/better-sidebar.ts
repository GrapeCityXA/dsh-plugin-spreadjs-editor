/**
 * Minimal public face of the `dsh-better-sidebar` client service.
 *
 * The ui-all bundle exposes this service as `ctx.betterSidebar`; external
 * plugins register file viewers with `registerFileViewer`. The plugin keeps
 * its own types here so the client bundle does not need to import another
 * package's runtime module.
 */
import type { ComponentType } from 'react'

/** One request's session scope, mirroring better-sidebar's SessionScope. */
export interface SidebarSessionScope {
  sessionId: string
  cwd?: string
}

/** How the sidebar host loads bytes for a file viewer. */
export type SidebarFileFetchStrategy = 'mediaUrl' | 'custom' | 'none' | 'fsRead' | 'binary-download'

/** Props handed to a registered file viewer component. */
export interface SidebarFileViewerProps {
  ctx: unknown
  store: unknown
  scope: SidebarSessionScope
  path: string
  title: string
  viewerId: string
  mediaUrl?: string
  content?: string
  customData?: unknown
}

/** Registration payload consumed by `betterSidebar.registerFileViewer`. */
export interface SidebarFileViewerDescriptor {
  id: string
  title?: string | (() => string)
  exts: readonly string[]
  priority?: number
  fetchStrategy: SidebarFileFetchStrategy
  component: ComponentType<SidebarFileViewerProps>
}

/** Client service published by dsh-better-sidebar. */
export interface SidebarService {
  registerFileViewer(descriptor: SidebarFileViewerDescriptor): () => void
}

const ABSOLUTE_WINDOWS = /^[a-zA-Z]:[\\/]/

function pathSegments(path: string): string[] {
  return path.split(/[\\/]/).filter(part => part !== '')
}

function isAbsolute(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || ABSOLUTE_WINDOWS.test(path)
}

/** Resolve a better-sidebar path against the session cwd when needed. */
export function sidebarAbsolutePath(path: string, cwd?: string): string {
  if (isAbsolute(path)) return path
  if (cwd === undefined || cwd === '') return path
  return `${cwd.replace(/[\\/]+$/, '')}/${path}`
}

function pathBase(path: string): string {
  const segments = pathSegments(path)
  return segments.at(-1) ?? path
}

function pathDir(path: string): string {
  const segments = pathSegments(path)
  if (segments.length <= 1) return path.startsWith('/') ? '/' : '.'
  const base = segments.slice(0, -1).join('/')
  if (ABSOLUTE_WINDOWS.test(path) && segments.length === 2) return `${segments[0]}:/`
  if (path.startsWith('/')) return `/${base}`
  if (path.startsWith('\\\\')) return `\\\\${base}`
  return base
}

/** Raw-bytes media URL served by the sidebar host for one file. */
export function sidebarFileUrl(scope: SidebarSessionScope, path: string): string {
  const target = sidebarAbsolutePath(path, scope.cwd)
  const params = new URLSearchParams({ sessionId: scope.sessionId, path: target })
  if (scope.cwd !== undefined && scope.cwd !== '') params.set('cwd', scope.cwd)
  return `/sidebar/file?${params.toString()}`
}

/** Raw upload URL that writes a blob back to the file's directory. */
export function sidebarUploadUrl(scope: SidebarSessionScope, path: string): string {
  const target = sidebarAbsolutePath(path, scope.cwd)
  const params = new URLSearchParams({
    sessionId: scope.sessionId,
    dir: pathDir(target),
    relativePath: pathBase(target),
  })
  if (scope.cwd !== undefined && scope.cwd !== '') params.set('cwd', scope.cwd)
  return `/sidebar/upload?${params.toString()}`
}
