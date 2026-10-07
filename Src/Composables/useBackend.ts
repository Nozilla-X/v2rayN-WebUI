import { ref } from 'vue'
import { normalizeApiBase, isSameOriginEndpoint, sessionStorageKey } from './apiEndpoint'
import { readStoredValue, writeStoredValue } from './browserStorage'

declare global {
  interface Window { __V2RAYN_WEBUI_CONFIG__?: { apiBaseUrl?: string } }
}

export function useBackend() {
  const configured = readStoredValue('v2rayn-api-endpoint')
    ?? (typeof window !== 'undefined' ? window.__V2RAYN_WEBUI_CONFIG__?.apiBaseUrl : '') ?? ''
  let initial = ''
  try { initial = normalizeApiBase(configured) } catch { /* Invalid config never initiates a request. */ }
  const base = ref(initial)
  const draft = ref(initial)
  const error = ref('')
  function setBase(value: string) {
    base.value = normalizeApiBase(value)
    draft.value = base.value
    writeStoredValue('v2rayn-api-endpoint', base.value)
  }
  return {
    base, draft, error, setBase,
    isSameOrigin: () => isSameOriginEndpoint(base.value),
    storageKey: () => sessionStorageKey(base.value),
  }
}
