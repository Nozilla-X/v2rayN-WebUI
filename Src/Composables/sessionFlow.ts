export type LoginResponseState = 'rate-limited' | 'invalid-key' | 'authenticated' | 'unavailable'

export function classifyLoginResponse(status: number, payload: unknown): LoginResponseState {
  const response = payload as {
    code?: unknown
    success?: unknown
    data?: { token?: unknown } | null
  } | null | undefined
  if (status === 429) return 'rate-limited'
  if (status === 401 && response?.code === 'management_key_invalid') return 'invalid-key'
  if (status >= 200 && status < 300
    && response?.success === true
    && typeof response?.data?.token === 'string'
    && response.data.token.length > 0) {
    return 'authenticated'
  }
  return 'unavailable'
}

export async function connectEstablishedSession(options: {
  sessionToken: string
  setToken: (token: string) => void
  setAuthenticated: (authenticated: boolean) => void
  isAuthenticated: () => boolean
  persistToken: (token: string) => void
  refreshBase: () => Promise<boolean>
  openEvents: () => void
  loadConnectedData: () => Promise<void>
  onDataLoadFailure: () => void
  onConnected: () => void
  onSessionExpired?: () => void
}): Promise<void> {
  options.setToken(options.sessionToken)
  options.setAuthenticated(true)
  try {
    options.persistToken(options.sessionToken)
  } catch {
    // Storage can be blocked by browser policy; keep the in-memory session active.
  }

  try {
    const baseLoaded = await options.refreshBase()
    if (!options.isAuthenticated()) {
      options.onSessionExpired?.()
      return
    }
    options.openEvents()
    if (!baseLoaded) {
      options.onDataLoadFailure()
      return
    }

    try {
      await options.loadConnectedData()
      options.onConnected()
    } catch {
      // The credential exchange already succeeded; data errors do not invalidate auth.
      if (options.isAuthenticated()) options.onDataLoadFailure()
      else options.onSessionExpired?.()
    }
  } catch {
    if (options.isAuthenticated()) options.onDataLoadFailure()
    else options.onSessionExpired?.()
  }
}
