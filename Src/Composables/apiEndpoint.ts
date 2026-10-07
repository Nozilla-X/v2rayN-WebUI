// API URLs only. Images, favicon and WebUI assets must never use this resolver.
export function normalizeApiBase(value: string): string {
  const input = value.trim()
  if (!input) return ''
  if (!/^https?:\/\//i.test(input) || /[\\?#\s\u0000-\u001f]/.test(input)) throw new Error('backend.invalidEndpoint')
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('backend.invalidEndpoint')
  }
  return url.origin + url.pathname.replace(/\/+$/, '')
}

export function resolveApiUrl(path: string, base = ''): string {
  if (!/^\/api(?:\/|\?|$)/.test(path) || /[\\#\u0000-\u001f]/.test(path)) throw new Error('Invalid API route')
  const normalized = normalizeApiBase(base)
  // Validate the composed path, including encoded dot segments, before adding credentials.
  const url = new URL((normalized || 'http://resolver.invalid') + path)
  const prefix = (normalized ? new URL(normalized).pathname.replace(/\/$/, '') : '') + '/api'
  if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) throw new Error('Invalid API route')
  return normalized ? url.href : url.pathname + url.search
}

export function endpointIdentity(base: string, origin = globalThis.location?.origin || ''): string {
  return normalizeApiBase(base) || origin || 'same-origin'
}

export function sessionStorageKey(base = '', origin?: string): string {
  return 'v2rayn-api-session:' + encodeURIComponent(endpointIdentity(base, origin))
}

export function isSameOriginEndpoint(base: string, origin = globalThis.location?.origin || ''): boolean {
  return !base || normalizeApiBase(base) === origin
}

export function addressSpace(base: string): 'loopback' | 'local' | 'public' {
  if (!base) return 'public'
  const host = new URL(base).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return 'loopback'
  const parts = host.split('.').map(Number)
  if (parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    if (parts[0] === 127) return 'loopback'
    if (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 169 && parts[1] === 254)) return 'local'
  }
  if (/^f[cd][0-9a-f]{2}:|^fe[89ab][0-9a-f]:/i.test(host)) return 'local'
  return 'public'
}

// Most browsers infer address space and handle permission without any hint. Never
// send an unsupported RequestInit extension (and EventSource has no such option).
export function localNetworkFetchOptions(url: string): RequestInit {
  if (!/^https?:/.test(url) || addressSpace(url) === 'public' || typeof Request === 'undefined'
    || !('targetAddressSpace' in Request.prototype)) return {}
  try {
    const targetAddressSpace = addressSpace(url)
    const init = { targetAddressSpace } as RequestInit & { targetAddressSpace: string }
    const request = new Request(url, init) as Request & { targetAddressSpace?: string }
    return request.targetAddressSpace === targetAddressSpace ? init : {}
  } catch { return {} }
}

export function networkFailureKey(base: string, pageProtocol = globalThis.location?.protocol): string {
  if (base && pageProtocol === 'https:' && new URL(base).protocol === 'http:') {
    return addressSpace(base) === 'public' ? 'backend.mixedContentFailure' : 'backend.localNetworkFailure'
  }
  return 'backend.networkFailure'
}
