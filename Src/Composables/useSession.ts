import { onUnmounted, ref, watch, type Ref } from 'vue'
import type { RequestApi, ErrorHandler, Notice, Translate } from './types'
import { classifyLoginResponse, connectEstablishedSession } from './sessionFlow.js'

export function useSession(options: {
  token: Ref<string>
  authenticated: Ref<boolean>
  loading: Ref<boolean>
  request: RequestApi
  t: Translate
  showNotice: Notice
  showError: ErrorHandler
  closeEvents: () => void
  openEvents: () => void
  refreshData: () => Promise<void>
  loadConnectedData: () => Promise<void>
  resetSessionData: () => void
  loadProfiles: () => Promise<void>
}) {
  const t = options.t
  const managementKeyDraft = ref('')
  const setupStatusReady = ref(false)
  const setupRequired = ref(false)
  const setupAllowedFromRequest = ref(false)
  const setupKey = ref('')
  const setupConfirmKey = ref('')
  const setupSubmitting = ref(false)
  const setupError = ref('')
  let refreshTimer: ReturnType<typeof setInterval> | undefined

  async function loadSetupStatus() {
    try {
      const response = await fetch('/api/setup/status')
      if (!response.ok) throw new Error(`${response.status}`)
      const payload = await response.json()
      const setupStatus = payload?.data ?? payload
      setupRequired.value = Boolean(setupStatus?.setupRequired)
      setupAllowedFromRequest.value = Boolean(setupStatus?.setupAllowedFromThisRequest)
    } catch (error) {
      options.showError(error)
    } finally {
      setupStatusReady.value = true
    }
  }

  async function refreshBase(): Promise<boolean> {
    if (!options.token.value || options.loading.value) return false
    options.loading.value = true
    try {
      await options.refreshData()
      options.authenticated.value = true
      return true
    } catch (error) {
      if (options.authenticated.value) options.showError(error)
      else throw error
      return false
    } finally {
      options.loading.value = false
    }
  }

  async function login() {
    const managementKey = managementKeyDraft.value
    if (!managementKey) {
      options.showNotice(t('auth.tokenRequired'), 'error')
      return
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: managementKey }),
      })
      const payload = await response.json().catch(() => ({}))
      switch (classifyLoginResponse(response.status, payload)) {
        case 'rate-limited':
          options.showNotice(t('auth.rateLimited'), 'error')
          return
        case 'invalid-key':
          options.showNotice(t('auth.loginFailed'), 'error')
          return
        case 'unavailable':
          options.showNotice(t('auth.loginUnavailable'), 'error')
          return
      }

      managementKeyDraft.value = ''
      await connectWithSession(payload.data.token)
    } catch {
      options.showNotice(t('auth.loginUnavailable'), 'error')
    }
  }

  async function connectWithSession(sessionToken: string) {
    await connectEstablishedSession({
      sessionToken,
      setToken: (token) => { options.token.value = token },
      setAuthenticated: (value) => { options.authenticated.value = value },
      isAuthenticated: () => options.authenticated.value,
      persistToken: (token) => localStorage.setItem('v2rayn-web-token', token),
      refreshBase,
      openEvents: options.openEvents,
      loadConnectedData: options.loadConnectedData,
      onDataLoadFailure: () => options.showNotice(t('auth.sessionDataLoadFailed'), 'error'),
      onConnected: () => options.showNotice(t('auth.connected')),
      onSessionExpired: () => options.showNotice(t('auth.sessionExpired'), 'error'),
    })
  }

  async function configureManagementKey() {
    setupError.value = ''
    if (setupKey.value.length < 12) {
      setupError.value = t('setup.keyTooShort')
      return
    }
    if (setupKey.value.length > 4096) {
      setupError.value = t('setup.keyTooLong')
      return
    }
    if (setupKey.value !== setupConfirmKey.value) {
      setupError.value = t('setup.keysDoNotMatch')
      return
    }

    setupSubmitting.value = true
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: setupKey.value, confirmKey: setupConfirmKey.value }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setupError.value = payload.error === 'key_too_short'
          ? t('setup.keyTooShort')
          : payload.error === 'key_too_long'
            ? t('setup.keyTooLong')
          : payload.error === 'keys_do_not_match'
            ? t('setup.keysDoNotMatch')
          : payload.error === 'already_configured'
            ? t('setup.alreadyConfigured')
            : t('setup.setupFailed')
        return
      }

      setupRequired.value = false
      const sessionToken = payload.token
      setupKey.value = ''
      setupConfirmKey.value = ''
      if (!sessionToken) {
        setupError.value = t('setup.setupFailed')
        return
      }
      await connectWithSession(sessionToken)
    } catch {
      setupError.value = t('setup.setupFailed')
    } finally {
      setupSubmitting.value = false
    }
  }

  function clearSession() {
    options.closeEvents()
    options.token.value = ''
    localStorage.removeItem('v2rayn-web-token')
    options.authenticated.value = false
    options.resetSessionData()
  }

  async function disconnect() {
    try {
      await options.request('/api/auth/logout', { method: 'POST' })
    } catch {
      // Clear the local session even when the backend is already unavailable.
    }
    clearSession()
  }

  watch(options.authenticated, (connected) => {
    clearInterval(refreshTimer)
    if (connected) {
      refreshTimer = setInterval(() => {
        void options.loadProfiles().catch(options.showError)
      }, 8000)
    } else {
      options.closeEvents()
    }
  })

  onUnmounted(() => clearInterval(refreshTimer))

  return {
    token: options.token, authenticated: options.authenticated, loading: options.loading,
    managementKeyDraft, setupStatusReady, setupRequired, setupAllowedFromRequest, setupKey, setupConfirmKey, setupSubmitting, setupError,
    loadSetupStatus, refreshBase, login, connectWithSession, configureManagementKey, clearSession, disconnect,
  }
}
