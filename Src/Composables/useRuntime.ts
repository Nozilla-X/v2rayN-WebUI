import { computed, reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice } from './types'

export function useRuntime(options: ApiServices & { showNotice: Notice; showError: ErrorHandler }) {
  const status = ref<Dict | null>(null)
  const busy = ref(false)
  const operations = ref<string[]>([])
  const listeners = computed(() => status.value?.listeners || [])
  const runtimeVersion = computed(() => status.value?.runtime?.split('|')[0]?.trim() || '')
  const traffic = computed(() => status.value?.traffic || {})

  async function loadOperations() {
    operations.value = await options.data('/api/operations') || []
  }

  async function loadStatus() {
    status.value = await options.data('/api/status')
    const operationRows = await options.data('/api/operations')
    operations.value = Array.isArray(operationRows) ? operationRows : []
  }

  async function coreAction(action: 'start' | 'stop' | 'restart') {
    busy.value = true
    try {
      const result = await options.request(`/api/core/${action}`, { method: 'POST' })
      options.showNotice(options.operationMessage(result, `core.${action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted'}`))
      await loadStatus()
    } catch (error) { options.showError(error) } finally { busy.value = false }
  }

  function listenerDescription(listener: Dict) {
    const protocols = Array.isArray(listener.protocols) ? listener.protocols.join('/') : ''
    return `${protocols ? `${protocols} ` : ''}${listener.listenAddress}:${listener.port}`
  }

  const connectionStripState = reactive({ listeners, traffic, status, runtimeVersion })

  return { status, busy, operations, listeners, runtimeVersion, traffic, connectionStripState, loadOperations, loadStatus, coreAction, listenerDescription }
}
