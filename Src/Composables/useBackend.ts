import { ref } from 'vue'
import { normalizeApiBase, isSameOriginEndpoint, sessionStorageKey } from './apiEndpoint'
import { readStoredValue, writeStoredValue } from './browserStorage'
import { backendHistoryStorageKey, normalizeBackendHistory, restoreBackendHistory } from './backendHistory'

declare global {
  interface Window { __V2RAYN_WEBUI_CONFIG__?: { apiBaseUrl?: string } }
}

export function useBackend() {
  const storedAddress = readStoredValue('v2rayn-api-endpoint')
  const configured = storedAddress
    ?? (typeof window !== 'undefined' ? window.__V2RAYN_WEBUI_CONFIG__?.apiBaseUrl : '') ?? ''
  let initial = ''
  try { initial = normalizeApiBase(configured) } catch { /* Invalid config never initiates a request. */ }
  const base = ref(initial)
  const draft = ref(initial)
  const error = ref('')
  const history = ref(restoreBackendHistory(readStoredValue(backendHistoryStorageKey), storedAddress))
  function setBase(value: string) {
    base.value = normalizeApiBase(value)
    draft.value = base.value
    writeStoredValue('v2rayn-api-endpoint', base.value)
  }
  function remember(value = base.value) {
    let address = ''
    try { address = normalizeApiBase(value) } catch { return } // Credential-bearing or invalid input never reaches storage.
    if (!address) return
    history.value = normalizeBackendHistory([address, ...history.value])
    writeStoredValue(backendHistoryStorageKey, JSON.stringify(history.value))
  }
  function forget(value: string) {
    let address: string
    try { address = normalizeApiBase(value) } catch { return }
    history.value = history.value.filter(item => item !== address)
    writeStoredValue(backendHistoryStorageKey, JSON.stringify(history.value))
  }
  return {
    base, draft, error, history, setBase, remember, forget,
    isSameOrigin: () => isSameOriginEndpoint(base.value),
    storageKey: () => sessionStorageKey(base.value),
  }
}
