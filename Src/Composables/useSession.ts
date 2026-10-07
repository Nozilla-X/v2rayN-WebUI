import { onUnmounted, ref, watch, type Ref } from 'vue'
import type { RequestApi, ErrorHandler, Notice, Translate } from './types'
import { classifyLoginResponse, connectEstablishedSession } from './sessionFlow.js'
import { useApi, type ApiClient } from './useApi'
import { sessionStorageKey } from './apiEndpoint'

export function useSession(options: {
  token: Ref<string>
  authenticated: Ref<boolean>
  loading: Ref<boolean>
  request: RequestApi
  publicRequest?: ApiClient['publicRequest']
  storageKey?: () => string
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
  let sessionGeneration = 0
  const fallbackApi = useApi({ getToken: () => options.token.value, onUnauthorized: () => clearSession(), translateKey: t })
  const publicRequest = options.publicRequest || fallbackApi.publicRequest
  const storageKey = options.storageKey || sessionStorageKey

  async function loadSetupStatus() {
    const generation = sessionGeneration
    try {
      const { response, payload } = await publicRequest('/api/setup/status')
      if (!response.ok) throw new Error(`${response.status}`)
      if (generation !== sessionGeneration) return
      const setupStatus = payload?.data ?? payload
      setupRequired.value = Boolean(setupStatus?.setupRequired)
      setupAllowedFromRequest.value = Boolean(setupStatus?.setupAllowedFromThisRequest)
    } catch (error) {
      if (generation === sessionGeneration) options.showError(error)
    } finally {
      if (generation === sessionGeneration) setupStatusReady.value = true
    }
  }

  async function refreshBase(): Promise<boolean> {
    if (!options.token.value || options.loading.value) return false
    options.loading.value = true
    const generation = sessionGeneration
    try {
      await options.refreshData()
      if (generation !== sessionGeneration) return false
      options.authenticated.value = true
      return true
    } catch (error) {
      if (generation !== sessionGeneration) return false
      if (options.authenticated.value) options.showError(error)
      else throw error
      return false
    } finally {
      if (generation === sessionGeneration) options.loading.value = false
    }
  }

  async function login() {
    const generation = sessionGeneration
    const managementKey = managementKeyDraft.value
    if (!managementKey) {
      options.showNotice(t('auth.tokenRequired'), 'error')
      return
    }

    try {
      await loadSetupStatus()
      if (generation !== sessionGeneration || setupRequired.value) return
      const { response, payload } = await publicRequest('/api/auth/login', {
        method: 'POST',
        body: { key: managementKey },
      })
      if (generation !== sessionGeneration) return
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
    } catch (error) {
      if (generation === sessionGeneration) options.showError(error)
    }
  }

  async function connectWithSession(sessionToken: string) {
    const generation = sessionGeneration
    const key = storageKey()
    await connectEstablishedSession({
      sessionToken,
      setToken: (token) => { options.token.value = token },
      setAuthenticated: (value) => { options.authenticated.value = value },
      isAuthenticated: () => generation === sessionGeneration && options.authenticated.value,
      persistToken: (token) => localStorage.setItem(key, token),
      refreshBase,
      openEvents: options.openEvents,
      loadConnectedData: options.loadConnectedData,
      onDataLoadFailure: () => options.showNotice(t('auth.sessionDataLoadFailed'), 'error'),
      onConnected: () => options.showNotice(t('auth.connected')),
      onSessionExpired: () => { if (generation === sessionGeneration) options.showNotice(t('auth.sessionExpired'), 'error') },
    })
  }

  async function configureManagementKey() {
    const generation = sessionGeneration
    setupError.value = ''
    if (!setupAllowedFromRequest.value) {
      setupError.value = t('setup.localOnly')
      return
    }
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
      const { response, payload } = await publicRequest('/api/setup', {
        method: 'POST',
        body: { key: setupKey.value, confirmKey: setupConfirmKey.value },
      })
      if (generation !== sessionGeneration) return
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
    } catch (error) {
      if (generation === sessionGeneration) options.showError(error)
    } finally {
      if (generation === sessionGeneration) setupSubmitting.value = false
    }
  }

  function clearSession() {
    sessionGeneration += 1
    fallbackApi.cancelPendingRequests()
    options.closeEvents()
    options.token.value = ''
    try {
      localStorage.removeItem(storageKey())
    } catch {
      // Browser storage policy must not prevent clearing in-memory credentials.
    }
    managementKeyDraft.value = ''
    setupKey.value = ''
    setupConfirmKey.value = ''
    options.authenticated.value = false
    options.loading.value = false
    setupSubmitting.value = false
    setupRequired.value = false
    setupAllowedFromRequest.value = false
    setupError.value = ''
    options.resetSessionData()
  }

  async function disconnect() {
    const generation = sessionGeneration
    try {
      await options.request('/api/auth/logout', { method: 'POST' })
    } catch {
      // Clear the local session even when the backend is already unavailable.
    }
    if (generation === sessionGeneration) clearSession()
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
