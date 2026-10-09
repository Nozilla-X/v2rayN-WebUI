import { inject, onMounted, onUnmounted, provide, reactive, type InjectionKey } from 'vue'
import type { ApiClient } from '../Composables/useApi'

export interface UiRequestState {
  reads: number
  writes: number
  error: string
  started: { id: number; path: string } | null
  committed: { id: number; path: string } | null
}
export function requestScope(path: string): string {
  if (path.startsWith('/api/settings/dns')) return 'dns'
  if (path.startsWith('/api/settings/core-templates')) return 'templates'
  if (path.startsWith('/api/settings/routing')) return 'routing'
  if (path.startsWith('/api/settings/webdav') || /^\/api\/(core-updates|web-updates|backup|geo|operations)/.test(path)) return 'maintenance'
  if (path.startsWith('/api/settings')) return 'settings'
  if (/^\/api\/(profiles|profile-groups|speedtests)/.test(path)) return 'nodes'
  if (path.startsWith('/api/subscriptions')) return 'subscriptions'
  if (path.startsWith('/api/logs')) return 'logs'
  return ''
}
function emptyState(): UiRequestState { return { reads: 0, writes: 0, error: '', started: null, committed: null } }
const key: InjectionKey<UiRequests> = Symbol('ui-requests')
export type UiRequests = ReturnType<typeof useUiRequests>

/** Observe, but never schedule, retry, alter or suppress business requests. */
export function useUiRequests(confirm: (message: string) => Promise<boolean>) {
  const states = reactive<Record<string, UiRequestState>>({})
  const drafts = new Map<string, () => boolean>()
  let generation = 0
  let nextId = 0
  let failures = new WeakSet<object>()
  function state(scope: string) {
    if (!states[scope]) states[scope] = emptyState()
    return states[scope] // Always return the reactive proxy, including the first request.
  }
  function decorate(api: ApiClient): ApiClient {
    function track<T extends (path: string, ...args: any[]) => Promise<any>>(operation: T): T {
      return (async (path: string, ...args: any[]) => {
        const scope = requestScope(path)
        if (!scope) return operation(path, ...args)
        const revision = generation
        const status = state(scope)
        const write = !['GET', 'HEAD'].includes(String(args[0]?.method || 'GET').toUpperCase())
        const id = ++nextId
        const counter = write ? 'writes' : 'reads'
        status[counter]++
        status.error = ''
        if (write) status.started = { id, path }
        try {
          const result = await operation(path, ...args)
          if (revision === generation && write) status.committed = { id, path }
          return result
        } catch (error) {
          if (revision === generation && (error as Error)?.name !== 'AbortError') {
            status.error = (error as Error)?.message || ''
            if (error && typeof error === 'object') failures.add(error)
          }
          throw error
        } finally { if (revision === generation) status[counter]-- }
      }) as T
    }
    return { ...api, request: track(api.request), data: track(api.data), download: track(api.download) }
  }
  function reset() {
    generation++
    failures = new WeakSet()
    for (const value of Object.values(states)) Object.assign(value, emptyState())
    drafts.clear()
  }
  const dirty = () => [...drafts.values()].some(check => check())
  function beforeUnload(event: BeforeUnloadEvent) { if (dirty()) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener?.('beforeunload', beforeUnload))
  onUnmounted(() => window.removeEventListener?.('beforeunload', beforeUnload))
  return { state, decorate, reset, drafts, dirty, confirm, isRequestError: (error: unknown) => Boolean(error && typeof error === 'object' && failures.has(error)) }
}
export function provideUiRequests(requests: UiRequests) { provide(key, requests) }
export function usePageRequests(scope: string) {
  const requests = inject(key, null)
  const status = requests?.state(scope) || reactive(emptyState())
  async function run(action: () => unknown) {
    try { return await action() }
    catch (error) {
      if ((error as Error)?.name === 'AbortError') return
      if (!status.error || !requests?.isRequestError(error)) throw error
    } // Only consume request failures already visible inline; never hide programming errors.
  }
  return { requests, status, run }
}
