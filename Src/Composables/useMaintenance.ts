import { reactive, ref, type Ref } from 'vue'
import type { ApiError, ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'

export function useMaintenance(options: ApiServices & {
  t: Translate
  translateKey: (key?: string | null) => string
  showNotice: Notice
  showError: ErrorHandler
  confirm: (message: string) => Promise<boolean>
  token: Ref<string>
  status: Ref<Dict | null>
  operations: Ref<string[]>
  loadOperations: () => Promise<void>
  loadProfiles: () => Promise<void>
}) {
  const t = options.t
  const webdavForm = ref<Dict>({ url: '', userName: '', password: '', dirName: '' })
  const updateSettings = ref<Dict>({ targets: [], geoFilesSelected: true, preRelease: false, useProxy: true })
  const updateResults = ref<Record<string, Dict>>({})
  const updateProgress = ref<Record<string, Dict>>({})

  async function loadMaintenance() {
    const [webdav, updates, progress, webTarget] = await Promise.all([
      options.data('/api/settings/webdav'),
      options.data('/api/core-updates'),
      options.data('/api/core-updates/progress'),
      options.data('/api/web-updates'),
      options.loadOperations(),
    ])
    webdavForm.value = { ...webdav, password: '' }
    updateSettings.value = { ...updates, webTarget, webSelected: Boolean(webTarget?.selected) }
    updateProgress.value = Object.fromEntries((progress || []).map((item: Dict) => [item.coreType, item]))
  }

  function recordCoreUpdateProgress(progress: Dict) {
    if (typeof progress.coreType !== 'string') return
    const previous = updateProgress.value[progress.coreType]
    updateProgress.value = { ...updateProgress.value, [progress.coreType]: progress }
    if (progress.isComplete && !progress.batch && progress.coreType !== 'GeoFiles' && !previous?.isComplete) {
      options.showNotice(
        t(progress.success ? 'maintenance.updateCompleted' : 'maintenance.updateFailed'),
        progress.success ? 'success' : 'error',
      )
    }
  }

  function notifyCoreUpdateBatchComplete(result: Dict) {
    options.showNotice(
      t(result.success ? 'maintenance.batchCompleted' : 'maintenance.batchFailed'),
      result.success ? 'success' : 'error',
    )
  }

  function notifyGeoUpdateComplete(result: Dict) {
    if (result.data?.batch === true) return
    const key = typeof result.messageKey === 'string' ? result.messageKey : result.success ? 'common.completed' : 'maintenance.updateFailed'
    options.showNotice(options.translateKey(key), result.success ? 'success' : 'error')
  }

  async function loadCoreUpdateProgress() {
    const progress = await options.data('/api/core-updates/progress')
    updateProgress.value = Object.fromEntries((progress || []).map((item: Dict) => [item.coreType, item]))
  }

  async function persistUpdateSettings(showSavedNotice: boolean): Promise<boolean> {
    try {
      const selectedCoreTypes = (updateSettings.value.targets || [])
        .filter((target: Dict) => target.selected)
        .map((target: Dict) => target.coreType)
      if (updateSettings.value.geoFilesSelected) selectedCoreTypes.push('GeoFiles')
      if (updateSettings.value.webSelected) selectedCoreTypes.push('v2rayN.Web')
      const result = await options.request('/api/core-updates/settings', {
        method: 'PUT',
        body: {
          selectedCoreTypes,
          preRelease: Boolean(updateSettings.value.preRelease),
          useProxy: Boolean(updateSettings.value.useProxy),
        },
      })
      if (showSavedNotice) options.showNotice(options.operationMessage(result))
      return true
    } catch (error) {
      options.showError(error)
      return false
    }
  }

  async function saveUpdateSettings() {
    await persistUpdateSettings(true)
  }

  async function checkCoreUpdate(coreType: string) {
    try {
      if (!await persistUpdateSettings(false)) return
      const result = await options.request(`/api/core-updates/${encodeURIComponent(coreType)}/check`)
      const check = result.data || {}
      updateResults.value = { ...updateResults.value, [coreType]: check }
      options.showNotice(check.updateAvailable
        ? t('maintenance.updateAvailable', { version: check.version })
        : check.isUpToDate ? t('maintenance.upToDateGeneric') : options.translateKey(result.messageKey))
    } catch (error) { options.showError(error) }
  }

  async function updateCore(coreType: string) {
    try {
      if (!await persistUpdateSettings(false)) return
      const result = await options.request(`/api/core-updates/${encodeURIComponent(coreType)}/update`, { method: 'POST' })
      options.showNotice(options.operationMessage(result, 'maintenance.updateStarted'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function checkWebUpdate() {
    try {
      const result = await options.request('/api/web-updates/check')
      const check = result.data || {}
      updateResults.value = { ...updateResults.value, 'v2rayN.Web': check }
      options.showNotice(check.updateAvailable
        ? t('maintenance.updateAvailable', { version: check.latestVersion })
        : check.detail || options.translateKey(result.messageKey), check.updateAvailable ? 'info' : 'success')
      await loadMaintenance()
    } catch (error) { options.showError(error) }
  }

  async function updateWeb() {
    try {
      if (!await persistUpdateSettings(false)) return
      const result = await options.request('/api/web-updates/update', { method: 'POST' })
      options.showNotice(options.operationMessage(result, 'maintenance.updateStarted'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function runSelectedUpdateBatch(apply: boolean) {
    try {
      if (!await persistUpdateSettings(false)) return
      const result = await options.request('/api/core-updates/batch', {
        method: 'POST',
        body: { apply },
      })
      options.showNotice(options.operationMessage(result, apply ? 'maintenance.batchStarted' : 'maintenance.batchCheckStarted'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function updateGeo() {
    try {
      if (!await persistUpdateSettings(false)) return
      const result = await options.request('/api/core/geo/update', { method: 'POST' })
      options.showNotice(options.operationMessage(result, 'updates.geoStarted'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function saveWebdav() {
    try {
      const result = await options.request('/api/settings/webdav', { method: 'PUT', body: {
        url: webdavForm.value.url, userName: webdavForm.value.userName,
        password: webdavForm.value.password || null, dirName: webdavForm.value.dirName,
      } })
      webdavForm.value.password = ''
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function webdavAction(action: 'check' | 'backup' | 'restore') {
    try {
      if (action === 'restore' && !await options.confirm(t('maintenance.restoreConfirm'))) return
      const result = await options.request(`/api/backup/webdav${action === 'check' ? '/check' : action === 'restore' ? '/restore' : ''}`, { method: 'POST' })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function downloadBackup() {
    try {
      const response = await fetch('/api/backup/download', { headers: { Authorization: `Bearer ${options.token.value}` } })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const issue = new Error(options.translateKey(payload?.messageKey)) as ApiError
        issue.messageKey = payload?.messageKey
        throw issue
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'v2rayN-backup.zip'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { options.showError(error) }
  }

  async function uploadRestore(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!await options.confirm(t('maintenance.restoreConfirm'))) return
    try {
      const formData = new FormData()
      formData.set('file', file)
      const result = await options.request('/api/backup/restore', { method: 'POST', body: formData })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) } finally { input.value = '' }
  }

  async function clearStatistics() {
    if (!await options.confirm(t('maintenance.clearConfirm'))) return
    try {
      const result = await options.request('/api/statistics', { method: 'DELETE' })
      options.showNotice(options.operationMessage(result))
      await options.loadProfiles()
    } catch (error) { options.showError(error) }
  }

  const maintenancePageState = reactive({
    updateSettings, updateResults, updateProgress,
    operations: options.operations, status: options.status, webdavForm,
  })

  return {
    webdavForm, updateSettings, updateResults, updateProgress, loadMaintenance, loadCoreUpdateProgress,
    recordCoreUpdateProgress, notifyCoreUpdateBatchComplete, notifyGeoUpdateComplete, maintenancePageState,
    maintenancePageActions: {
      checkCoreUpdate, updateCore, checkWebUpdate, updateWeb, runSelectedUpdateBatch, saveUpdateSettings, updateGeo, clearStatistics, saveWebdav,
      webdavAction, downloadBackup, uploadRestore, loadMaintenance, loadOperations: options.loadOperations,
    },
  }
}
