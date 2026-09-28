import type { ApiError, ApiInit, Dict } from './types'

export function useApi(options: {
  getToken: () => string
  onUnauthorized: () => void
  translateKey: (key?: string | null) => string
}) {
  async function request(path: string, init: ApiInit = {}): Promise<Dict> {
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
    const response = await fetch(path, { ...init, headers, body })
    if (response.status === 401) {
      options.onUnauthorized()
    }
    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok || payload?.success === false) {
      const error = new Error(options.translateKey(payload?.messageKey) || payload?.code || `${response.status}`) as ApiError
      error.messageKey = payload?.messageKey
      error.code = payload?.code
      error.data = payload?.data
      throw error
    }
    return payload || {}
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

  return { request, data, operationMessage, queryPath, canonicalCode, coreTypeRoute }
}

export type ApiClient = ReturnType<typeof useApi>
