import { computed, reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice } from './types'

export function useRuntime(options: ApiServices & { showNotice: Notice; showError: ErrorHandler }) {
  const status = ref<Dict | null>(null)
  const busy = ref(false)
  const operations = ref<string[]>([])
  let operationsRequest: Promise<void> | undefined
  let operationsGeneration = 0
  const listeners = computed(() => status.value?.listeners || [])
  const runtimeVersion = computed(() => status.value?.runtime?.split('|')[0]?.trim() || '')
  const traffic = computed(() => status.value?.traffic || {})

  function loadOperations(): Promise<void> {
    if (operationsRequest) return operationsRequest
    const generation = operationsGeneration
    const load = (async () => {
      const result = await options.data('/api/operations')
      if (generation !== operationsGeneration) return
      const rows: string[] = Array.isArray(result) ? result : []
      if (rows.length !== operations.value.length || rows.some((row, index) => row !== operations.value[index])) {
        operations.value = rows
      }
    })()
    let tracked: Promise<void>
    tracked = load.finally(() => {
      if (operationsRequest === tracked) operationsRequest = undefined
    })
    operationsRequest = tracked
    return tracked
  }

  async function loadStatus() {
    status.value = await options.data('/api/status')
    await loadOperations()
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

  function reset() {
    operationsGeneration += 1
    operationsRequest = undefined
    status.value = null
    busy.value = false
    operations.value = []
  }

  return { status, busy, operations, listeners, runtimeVersion, traffic, connectionStripState, loadOperations, loadStatus, coreAction, listenerDescription, reset }
}
