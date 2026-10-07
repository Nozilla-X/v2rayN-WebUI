import type { ApiError, ApiInit, Dict } from './types'
import { resolveApiUrl, localNetworkFetchOptions, networkFailureKey } from './apiEndpoint'

export function useApi(options: {
  getToken: () => string
  onUnauthorized: () => void
  translateKey: (key?: string | null) => string
  getBase?: () => string
}) {
  let requestGeneration = 0
  const pendingRequests = new Set<AbortController>()

  function cancelPendingRequests() {
    requestGeneration += 1
    for (const controller of pendingRequests) controller.abort()
    pendingRequests.clear()
  }

  async function performRequest(path: string, init: ApiInit = {}, binary = false, publicRequest = false): Promise<any> {
    const generation = requestGeneration
    const base = options.getBase?.() || ''
    const url = resolveApiUrl(path, base)
    const controller = new AbortController()
    const headers = new Headers(init.headers)
    const token = options.getToken()
    headers.delete('Authorization')
    if (token && !publicRequest) headers.set('Authorization', `Bearer ${token}`)
    let body: BodyInit | undefined
    if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(init.body)
    } else if (init.body !== undefined && init.body !== null) {
      body = init.body as BodyInit
    }
    const signal = init.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal
    pendingRequests.add(controller)
    try {
      const response = await fetch(url, { ...localNetworkFetchOptions(url), ...init, headers, body, signal, credentials: 'omit', redirect: 'error' })
      const payload = response.status === 204 || (binary && response.ok) ? null : await response.json().catch(() => null)
      if (signal.aborted || generation !== requestGeneration || base !== (options.getBase?.() || '') || token !== options.getToken()) {
        throw new DOMException('The API session changed.', 'AbortError')
      }
      if (publicRequest) return { response, payload }
      if (response.status === 401) options.onUnauthorized()
      if (!response.ok || payload?.success === false) {
        const message = payload?.messageKey
          ? options.translateKey(payload.messageKey)
          : payload?.code || `${options.translateKey('common.unknownError')} (HTTP ${response.status})`
        const error = new Error(message) as ApiError
        error.messageKey = payload?.messageKey
        error.code = payload?.code
        error.data = payload?.data
        error.status = response.status
        throw error
      }
      if (binary) {
        const blob = await response.blob()
        if (signal.aborted || generation !== requestGeneration || base !== (options.getBase?.() || '') || token !== options.getToken()) {
          throw new DOMException('The API session changed.', 'AbortError')
        }
        return { blob, filename: response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'v2rayN-backup.zip' }
      }
      return payload || {}
    } catch (error) {
      // A valid 401 clears the session synchronously, which also cancels requests.
      // Keep that HTTP failure rather than misclassifying our own cleanup as a switch.
      if ((error as ApiError)?.status) throw error
      if (signal.aborted || generation !== requestGeneration || base !== (options.getBase?.() || '')) {
        if (generation === requestGeneration && (signal.reason as Error)?.name === 'TimeoutError') {
          throw new Error(options.translateKey('backend.timeout'))
        }
        throw new DOMException('The Backend changed.', 'AbortError')
      }
      if (error instanceof TypeError) throw new Error(options.translateKey(networkFailureKey(base)))
      throw error
    } finally {
      pendingRequests.delete(controller)
    }
  }

  async function request(path: string, init: ApiInit = {}): Promise<Dict> {
    return performRequest(path, init)
  }

  async function download(path: string): Promise<{ blob: Blob; filename: string }> {
    return performRequest(path, {}, true)
  }

  async function data(path: string, init: ApiInit = {}): Promise<any> {
    const payload = await request(path, init)
    return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
  }

  function operationMessage(payload: Dict, fallback = 'common.operationDone') {
    return options.translateKey(payload?.messageKey || fallback)
  }

  function queryPath(path: string, values: Dict): string {
    const query = new URLSearchParams()
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    })
    return query.size ? `${path}?${query}` : path
  }

  function canonicalCode(value: unknown, codes: string[]): string {
    const match = codes.find((code) => code.toLocaleLowerCase() === String(value ?? '').toLocaleLowerCase())
    return match || String(value ?? '')
  }

  function coreTypeRoute(value: string): string {
    return value.toLocaleLowerCase() === 'xray' ? 'Xray' : value
  }

  function captureSessionRevocation(): () => Promise<void> {
    const token = options.getToken()
    const base = options.getBase?.() || ''
    return async () => {
      if (!token) return
      // A bounded cleanup request, with immutable old URL/token. It cannot read
      // the new Backend's state or send the old Bearer to the new endpoint.
      const oldApi = useApi({ getToken: () => token, getBase: () => base, onUnauthorized() {}, translateKey: options.translateKey })
      try { await oldApi.request('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(2000) }) }
      catch { /* Local disconnect is immediate even when the old API is gone. */ }
    }
  }

  return {
    request, download, data, operationMessage, queryPath, canonicalCode, coreTypeRoute, cancelPendingRequests, captureSessionRevocation,
    publicRequest: (path: string, init: ApiInit = {}) => performRequest(path, init, false, true) as Promise<{ response: Response; payload: any }>,
    resolveUrl: (path: string) => resolveApiUrl(path, options.getBase?.() || ''),
  }
}

export type ApiClient = ReturnType<typeof useApi>
