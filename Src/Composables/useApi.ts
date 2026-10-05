import type { ApiError, ApiInit, Dict } from './types'

export function useApi(options: {
  getToken: () => string
  onUnauthorized: () => void
  translateKey: (key?: string | null) => string
}) {
  let requestGeneration = 0
  const pendingRequests = new Set<AbortController>()

  function cancelPendingRequests() {
    requestGeneration += 1
    for (const controller of pendingRequests) controller.abort()
    pendingRequests.clear()
  }

  async function performRequest(path: string, init: ApiInit = {}, binary = false): Promise<any> {
    const generation = requestGeneration
    const controller = new AbortController()
    const headers = new Headers(init.headers)
    const token = options.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
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
      const response = await fetch(path, { ...init, headers, body, signal })
      const payload = response.status === 204 || (binary && response.ok) ? null : await response.json().catch(() => null)
      if (signal.aborted || generation !== requestGeneration || token !== options.getToken()) {
        throw new DOMException('The API session changed.', 'AbortError')
      }
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
        if (signal.aborted || generation !== requestGeneration || token !== options.getToken()) {
          throw new DOMException('The API session changed.', 'AbortError')
        }
        return { blob, filename: response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'v2rayN-backup.zip' }
      }
      return payload || {}
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

  return { request, download, data, operationMessage, queryPath, canonicalCode, coreTypeRoute, cancelPendingRequests }
}

export type ApiClient = ReturnType<typeof useApi>
