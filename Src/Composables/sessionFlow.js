export function classifyLoginResponse(status, payload) {
  if (status === 429) return 'rate-limited'
  if (status === 401 && payload?.code === 'management_key_invalid') return 'invalid-key'
  if (status >= 200 && status < 300
    && payload?.success === true
    && typeof payload?.data?.token === 'string'
    && payload.data.token.length > 0) {
    return 'authenticated'
  }
  return 'unavailable'
}

export async function connectEstablishedSession(options) {
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
