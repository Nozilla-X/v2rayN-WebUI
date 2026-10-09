import { onUnmounted, watch, type Ref } from 'vue'
import type { Dict, RequestApi, Notice, Translate } from './types'
import { enqueueLogEntry, takeLogBatch } from './logBatch.ts'
import { createEventRefresh } from './eventRefresh.ts'
import { resolveApiUrl } from './apiEndpoint'

export function useEvents(options: {
  token: Ref<string>
  activePage: Ref<string>
  status: Ref<Dict | null>
  logs: Ref<Dict[]>
  logTotal: Ref<number>
  logPage: Ref<number>
  logPageSize: number
  logsPaused?: Ref<boolean>
  onSubscriptionProgress?: (progress: Dict) => void
  request: RequestApi
  resolveUrl?: (path: string) => string
  networkFailureMessage?: () => string
  t: Translate
  showNotice: Notice
  matchesLogFilter: (entry: Dict) => boolean
  loadGroups: () => Promise<void>
  loadProfiles: () => Promise<void>
  loadSubscriptions: () => Promise<void>
  loadStatus: () => Promise<void>
  loadRouting: () => Promise<void>
  loadOperations: () => Promise<void>
  onCoreUpdateProgress: (progress: Dict) => void
  onCoreUpdateBatchComplete: (result: Dict) => void
  onGeoUpdateComplete: (result: Dict) => void
  onSpeedTestResult: (result: Dict) => void
  onLogsCleared: (generation: number) => void
}) {
  const t = options.t
  let eventSource: EventSource | undefined
  let connectionGeneration = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectAttempts = 0
  let ticketRequestGeneration: number | undefined
  let reconnectNotified = false
  let logEventSource: EventSource | undefined
  let logEventHandler: EventListener | undefined
  let eventSourceIncludesLogs = false
  let minimumLogGeneration = 0
  let geoUpdateActive = false
  const operationsRefresh = createEventRefresh(options.loadOperations)
  const updatePhases = new Map<string, string>()
  const pendingUpdateProgress = new Map<string, Dict>()
  let updateProgressTimer: ReturnType<typeof setTimeout> | undefined

  function recordUpdateProgress(progress: Dict) {
    if (typeof progress.coreType !== 'string') return
    if (progress.isComplete || updatePhases.get(progress.coreType) !== progress.phase) {
      updatePhases.set(progress.coreType, progress.phase)
      pendingUpdateProgress.delete(progress.coreType)
      if (!pendingUpdateProgress.size) {
        clearTimeout(updateProgressTimer)
        updateProgressTimer = undefined
      }
      options.onCoreUpdateProgress(progress)
      return
    }
    // Download packets can arrive thousands of times a second. Keep only the
    // latest progress per Core and render at most once per 100 ms.
    pendingUpdateProgress.set(progress.coreType, progress)
    if (updateProgressTimer === undefined) {
      updateProgressTimer = setTimeout(() => {
        updateProgressTimer = undefined
        const batch = [...pendingUpdateProgress.values()]
        pendingUpdateProgress.clear()
        for (const latest of batch) options.onCoreUpdateProgress(latest)
      }, 100)
    }
  }

  function openEvents() {
    closeEvents()
    if (!options.token.value) return
    void connectEvents(connectionGeneration)
  }

  const pendingLogs: Dict[] = []
  let logFlushTimer: ReturnType<typeof setTimeout> | undefined
  const logFlushIntervalMs = 75

  function clearPendingLogQueue(generation?: number) {
    if (typeof generation === 'number') minimumLogGeneration = Math.max(minimumLogGeneration, generation)
    if (typeof generation === 'number') {
      let write = 0
      for (const entry of pendingLogs) {
        if (typeof entry.generation === 'number' && entry.generation >= generation) {
          pendingLogs[write++] = entry
        }
      }
      pendingLogs.length = write
    } else {
      pendingLogs.length = 0
    }
    clearTimeout(logFlushTimer)
    logFlushTimer = pendingLogs.length ? setTimeout(flushLogBatch, logFlushIntervalMs) : undefined
  }

  function flushLogBatch() {
    clearTimeout(logFlushTimer)
    logFlushTimer = undefined
    if (options.activePage.value !== 'logs' || options.logsPaused?.value) {
      clearPendingLogQueue()
      return
    }
    const batch = takeLogBatch(pendingLogs)
    if (!batch.length) return
    const matching = batch.filter(options.matchesLogFilter)
    if (!matching.length) return
    options.logTotal.value += matching.length
    if (options.logPage.value === 1) {
      options.logs.value = [...options.logs.value, ...matching].slice(-options.logPageSize)
    }
  }

  function enqueueLog(entry: Dict) {
    if (options.activePage.value !== 'logs' || options.logsPaused?.value) return
    if (typeof entry.generation === 'number' && entry.generation < minimumLogGeneration) return
    enqueueLogEntry(pendingLogs, entry)
    if (pendingLogs.length >= 100) {
      flushLogBatch()
    } else if (!logFlushTimer) {
      logFlushTimer = setTimeout(flushLogBatch, logFlushIntervalMs)
    }
  }

  function detachLogListener() {
    if (logEventSource && logEventHandler) {
      logEventSource.removeEventListener('log', logEventHandler)
    }
    logEventSource = undefined
    logEventHandler = undefined
    clearPendingLogQueue()
  }

  function attachLogListener() {
    const source = eventSource
    if (!source || options.activePage.value !== 'logs' || logEventSource === source) return
    detachLogListener()
    const handler: EventListener = (event) => {
      if (eventSource !== source) return
      const entry = JSON.parse((event as MessageEvent).data)
      enqueueLog(entry)
    }
    logEventSource = source
    logEventHandler = handler
    source.addEventListener('log', handler)
  }

  async function connectEvents(generation: number) {
    if (generation !== connectionGeneration || !options.token.value || ticketRequestGeneration === generation) return
    ticketRequestGeneration = generation
    try {
      const response = await options.request('/api/auth/sse-ticket', { method: 'POST' })
      const ticket = response.data?.ticket
      if (typeof ticket !== 'string' || generation !== connectionGeneration || !options.token.value) return

      const includeLogs = options.activePage.value === 'logs'
      eventSourceIncludesLogs = includeLogs
      const source = new EventSource((options.resolveUrl || resolveApiUrl)(`/api/events?sse_ticket=${encodeURIComponent(ticket)}&include_logs=${includeLogs}`))
      eventSource = source
      const listen = (name: string, handler: (event: MessageEvent) => void) => {
        source.addEventListener(name, (event) => {
          if (eventSource === source && generation === connectionGeneration) handler(event as MessageEvent)
        })
      }
      attachLogListener()
      source.onopen = () => {
        if (eventSource === source) {
          reconnectAttempts = 0
          reconnectNotified = false
          void options.loadStatus().catch(() => {})
        }
      }
      listen('status', (event) => { options.status.value = JSON.parse(event.data) })
      listen('traffic', (event) => {
      if (options.status.value) options.status.value.traffic = JSON.parse((event as MessageEvent).data)
      })
      listen('speedtest-started', () => operationsRefresh.request())
      listen('speedtest-result', (event) => {
        const result = JSON.parse((event as MessageEvent).data) as Dict
        options.onSpeedTestResult(result)
        // Empty IDs are Backend-wide notifications (completion, stop or failure),
        // not profile rows. Reconcile actual operation state without guessing rawLog language.
        if (!result.indexId) operationsRefresh.request()
      })
      listen('core-update-progress', (event) => {
        const progress = JSON.parse((event as MessageEvent).data) as Dict
        recordUpdateProgress(progress)
        if (progress.coreType === 'GeoFiles') {
          if (!geoUpdateActive && !progress.isComplete) operationsRefresh.request()
          geoUpdateActive = !progress.isComplete
        }
        if (progress.phase === 'checking' || progress.isComplete) {
          operationsRefresh.request()
        }
      })
      listen('core-update-batch-completed', (event) => {
        options.onCoreUpdateBatchComplete(JSON.parse((event as MessageEvent).data) as Dict)
        operationsRefresh.request()
      })
      listen('geo-update-progress', () => {
        // Raw progress does not change operation membership. Refresh once at
        // startup, not once per download packet; completion refreshes below.
        if (!geoUpdateActive) {
          geoUpdateActive = true
          operationsRefresh.request()
        }
      })
      listen('logs-cleared', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as Dict
        const generation = typeof payload.generation === 'number' ? payload.generation : minimumLogGeneration
        clearPendingLogQueue(generation)
        options.onLogsCleared(generation)
      })
      for (const eventName of ['profiles-changed', 'subscription-progress', 'settings-changed', 'core-state', 'geo-update-completed', 'xray-update-completed']) {
        listen(eventName, (event) => {
        if (eventName === 'core-state') {
          const state = JSON.parse((event as MessageEvent).data) as Dict
          if (options.status.value) {
            Object.assign(options.status.value, {
              runtimeState: state.state,
              coreType: state.coreType,
              coreStartedAt: state.startedAt,
              runningProfileId: state.profileId,
              runningProxyPort: state.proxyPort,
              apiPort: state.apiPort,
              coreProcessIds: state.processIds || [],
              runtimeFailure: state.lastFailure,
            })
          }
        }
        if (eventName === 'profiles-changed' || eventName === 'subscription-progress') {
          if (eventName === 'subscription-progress') options.onSubscriptionProgress?.(JSON.parse((event as MessageEvent).data))
          operationsRefresh.request()
          void options.loadGroups().then(options.loadProfiles).then(options.loadSubscriptions).catch(() => {})
        }
        if (eventName === 'settings-changed' || eventName === 'core-state') {
          void Promise.all([options.loadStatus(), options.loadRouting()]).catch(() => {})
        }
        if (eventName === 'geo-update-completed') {
          geoUpdateActive = false
          options.onGeoUpdateComplete(JSON.parse((event as MessageEvent).data) as Dict)
        }
        if (eventName === 'geo-update-completed' || eventName === 'xray-update-completed') operationsRefresh.request()
      })
      }
      source.onerror = () => {
        if (eventSource !== source) return
        detachLogListener()
        source.close()
        eventSource = undefined
        scheduleReconnect(generation)
      }
    } catch {
      scheduleReconnect(generation)
    } finally {
      if (ticketRequestGeneration === generation) ticketRequestGeneration = undefined
    }
  }

  function scheduleReconnect(generation: number) {
    if (generation !== connectionGeneration || !options.token.value || reconnectTimer) return
    const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 5), 30000)
    reconnectAttempts += 1
    if (reconnectAttempts >= 5 && !reconnectNotified) {
      reconnectNotified = true
      options.showNotice(options.networkFailureMessage?.() || t('backend.networkFailure'), 'error')
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      void connectEvents(generation)
    }, delay)
  }

  function closeEvents() {
    connectionGeneration += 1
    operationsRefresh.clear()
    geoUpdateActive = false
    clearTimeout(updateProgressTimer)
    updateProgressTimer = undefined
    pendingUpdateProgress.clear()
    updatePhases.clear()
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    reconnectAttempts = 0
    detachLogListener()
    eventSource?.close()
    eventSource = undefined
    eventSourceIncludesLogs = false
    ticketRequestGeneration = undefined
    reconnectNotified = false
  }

  watch(options.activePage, (page) => {
    if (options.token.value && (page === 'logs') !== eventSourceIncludesLogs) {
      openEvents()
      return
    }
    if (page === 'logs') attachLogListener()
    else detachLogListener()
  })

  onUnmounted(closeEvents)

  function resetEvents() {
    closeEvents()
    minimumLogGeneration = 0
  }

  return { openEvents, closeEvents, resetEvents, clearPendingLogQueue }
}
