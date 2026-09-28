import { computed, reactive, ref, type Ref } from 'vue'
import type { ApiError, ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'
import { canonicalNetwork, profileEditorOptions } from '../profileEditorOptions'
import { normalizeNullableNumbers } from './settingsPayloads.js'

const groupIncompatibleProfileFields = [
  'address', 'port', 'password', 'username', 'network', 'headerType', 'requestHost', 'path',
  'streamSecurity', 'allowInsecure', 'sni', 'alpn', 'fingerprint', 'publicKey', 'shortId', 'spiderX',
  'mldsa65Verify', 'muxEnabled', 'cert', 'certSha', 'echConfigList', 'verifyPeerCertByName', 'finalmask',
  'extra', 'transportExtra', 'ports', 'alterId', 'flow', 'id', 'security',
]

export function useProfiles(options: ApiServices & {
  t: Translate
  showNotice: Notice
  showError: ErrorHandler
  loadStatus: () => Promise<void>
  loadOperations: () => Promise<void>
  busy: Ref<boolean>
  operations: Ref<string[]>
  contextMenu: Ref<Dict | null>
  confirm: (message: string) => Promise<boolean>
}) {
  const t = options.t
  const profiles = ref<Dict[]>([])
  const groups = ref<Dict[]>([])
  const selectedGroup = ref('')
  const filter = ref('')
  const selectedIds = ref<string[]>([])
  const focusedProfileId = ref('')
  const sorting = ref({ column: '', ascending: true })
  const importForm = ref<Dict>({ content: '', subscriptionId: '', isSubscription: false })
  const profileForm = ref<Dict>({})
  const profileAdvancedJson = ref('')
  const profileCatalog = ref<Dict[]>([])
  const groupChildIds = ref<string[]>([])
  const exportOptions = ref({ includeShareUris: true, base64ShareUris: false, includeInnerUri: true, includeClientConfig: true })
  const exportContent = ref('')
  const showProfileForm = ref(false)
  const showImportForm = ref(false)
  const showExportDialog = ref(false)
  const editingProfileId = ref('')
  const profileModalError = ref('')

  const protocolTypes = ['VMess', 'VLESS', 'Shadowsocks', 'SOCKS', 'Trojan', 'Hysteria2', 'TUIC', 'WireGuard', 'HTTP', 'Anytls', 'Naive']
  const coreTypes = [...profileEditorOptions.coreTypes]
  const testActions = [
    { id: 'tcping', key: 'nodes.tcping' },
    { id: 'realping', key: 'nodes.realping' },
    { id: 'fastRealping', key: 'nodes.fastRealping' },
    { id: 'udpTest', key: 'nodes.udp' },
    { id: 'speedtest', key: 'nodes.speedtest' },
    { id: 'mixedtest', key: 'nodes.mixedtest' },
  ]

  // The backend owns filtering so its ServiceLib regex semantics are preserved.
  const filteredProfiles = computed(() => profiles.value)
  const selectedProfiles = computed(() => profiles.value.filter((profile) => selectedIds.value.includes(profile.indexId)))
  const allVisibleSelected = computed(() => filteredProfiles.value.length > 0 && filteredProfiles.value.every((profile) => selectedIds.value.includes(profile.indexId)))

  async function loadGroups() {
    groups.value = await options.data('/api/profile-groups') || []
    if (!groups.value.some((group) => group.id === selectedGroup.value)) {
      selectedGroup.value = groups.value.find((group) => group.isCurrent)?.id || ''
    }
  }

  async function loadProfiles() {
    const path = options.queryPath('/api/profiles', { subscriptionId: selectedGroup.value, filter: filter.value.trim() })
    profiles.value = await options.data(path) || []
    selectedIds.value = selectedIds.value.filter((id) => profiles.value.some((profile) => profile.indexId === id))
    if (!profiles.value.some((profile) => profile.indexId === focusedProfileId.value)) {
      focusedProfileId.value = profiles.value.find((profile) => profile.isCurrent)?.indexId || profiles.value[0]?.indexId || ''
    }
  }

  async function changeGroup(groupId: string) {
    try {
      await options.request('/api/profile-groups/current', { method: 'PUT', body: { subscriptionId: groupId || null } })
      selectedGroup.value = groupId
      selectedIds.value = []
      await loadProfiles()
    } catch (error) { options.showError(error) }
  }

  async function selectProfile(profile: Dict) {
    if (profile.isCurrent) return
    options.busy.value = true
    try {
      const result = await options.request(`/api/profiles/${encodeURIComponent(profile.indexId)}/select`, { method: 'POST' })
      options.showNotice(options.operationMessage(result, 'core.started'))
      await Promise.all([options.loadStatus(), loadProfiles()])
    } catch (error) { options.showError(error) } finally { options.busy.value = false }
  }

  async function startSpeedTest(action: string, ids: string[] = selectedIds.value) {
    try {
      const result = await options.request('/api/speedtests', {
        method: 'POST',
        body: { action, ...(ids.length ? { profileIds: ids } : {}) },
      })
      options.showNotice(options.operationMessage(result, 'speedtest.started'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function stopSpeedTests() {
    try {
      const result = await options.request('/api/speedtests', { method: 'DELETE' })
      options.showNotice(options.operationMessage(result))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  function toggleProfile(id: string) {
    selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((item) => item !== id) : [...selectedIds.value, id]
  }

  function toggleAllVisible() {
    if (allVisibleSelected.value) {
      const visible = new Set(filteredProfiles.value.map((profile) => profile.indexId))
      selectedIds.value = selectedIds.value.filter((id) => !visible.has(id))
    } else {
      selectedIds.value = [...new Set([...selectedIds.value, ...filteredProfiles.value.map((profile) => profile.indexId)])]
    }
  }

  function setFocusedProfile(id: string) {
    focusedProfileId.value = id
  }

  function focusProfile(event: MouseEvent, profile: Dict) {
    const target = event.target
    if (target instanceof Element && target.closest('button, input, select, a')) return
    focusedProfileId.value = profile.indexId
    if (!selectedIds.value.includes(profile.indexId)) selectedIds.value = [profile.indexId]
    ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
  }

  function openContextAt(x: number, y: number, profile: Dict) {
    if (!selectedIds.value.includes(profile.indexId)) selectedIds.value = [profile.indexId]
    focusedProfileId.value = profile.indexId
    options.contextMenu.value = { x: Math.min(x, window.innerWidth - 250), y: Math.min(y, window.innerHeight - 280), profile }
  }

  function handleRowKeydown(event: KeyboardEvent, profile: Dict) {
    if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
    event.preventDefault()
    const row = event.currentTarget as HTMLElement
    const rect = row.getBoundingClientRect()
    openContextAt(rect.left + 8, rect.bottom, profile)
  }

  async function sortProfiles(column: string) {
    const ascending = sorting.value.column === column ? !sorting.value.ascending : true
    sorting.value = { column, ascending }
    try {
      await options.request('/api/profiles/sort', { method: 'POST', body: { subscriptionId: selectedGroup.value || null, column, ascending } })
      await loadProfiles()
    } catch (error) { options.showError(error) }
  }

  async function runProfileAction(action: string, profileIds = selectedIds.value) {
    if (!profileIds.length && !['test-group', 'deduplicate', 'remove-invalid'].includes(action)) {
      options.showNotice(t('nodes.selectionRequired'), 'error')
      return
    }
    try {
      let result: Dict
      if (action === 'delete') {
        if (!await options.confirm(t('common.confirmDelete'))) return
        result = await options.request('/api/profiles', { method: 'DELETE', body: { profileIds } })
      } else if (action === 'copy') {
        result = await options.request('/api/profiles/copy', { method: 'POST', body: { profileIds } })
      } else if (action === 'deduplicate') {
        result = await options.request(options.queryPath('/api/profiles/deduplicate', { subscriptionId: selectedGroup.value }), { method: 'POST' })
      } else if (action === 'remove-invalid') {
        result = await options.request(options.queryPath('/api/profiles/invalid-test-results', { subscriptionId: selectedGroup.value }), { method: 'DELETE' })
      } else if (action === 'test-group') {
        await startSpeedTest('mixedtest', [])
        return
      } else {
        return
      }
      options.showNotice(options.operationMessage(result))
      selectedIds.value = []
      await Promise.all([loadGroups(), loadProfiles(), options.loadStatus()])
    } catch (error) { options.showError(error) }
  }

  async function moveSelectedToGroup(subscriptionId: string) {
    if (!selectedIds.value.length) return options.showNotice(t('nodes.selectionRequired'), 'error')
    try {
      const result = await options.request('/api/profiles/move-to-group', { method: 'POST', body: { profileIds: selectedIds.value, subscriptionId } })
      options.showNotice(options.operationMessage(result))
      await Promise.all([loadGroups(), loadProfiles()])
      selectedIds.value = []
    } catch (error) { options.showError(error) }
  }

  async function moveSelected(direction: string) {
    if (!selectedIds.value.length) return options.showNotice(t('nodes.selectionRequired'), 'error')
    const ordered = [...selectedProfiles.value]
    if (direction === 'up' || direction === 'top') ordered.reverse()
    try {
      for (const profile of ordered) {
        await options.request('/api/profiles/move', { method: 'POST', body: { profileId: profile.indexId, direction, position: -1 } })
      }
      await loadProfiles()
    } catch (error) { options.showError(error) }
  }

  async function moveSelectedPosition() {
    if (!selectedIds.value.length) return options.showNotice(t('nodes.selectionRequired'), 'error')
    const value = window.prompt(t('nodes.positionPrompt'))
    if (value === null) return
    const position = Number(String(value).trim())
    if (!Number.isInteger(position) || position < 1) return options.showNotice(t('errors.invalidInput'), 'error')
    try {
      for (const profile of selectedProfiles.value) {
        await options.request('/api/profiles/move', { method: 'POST', body: { profileId: profile.indexId, direction: 'position', position: position - 1 } })
      }
      await loadProfiles()
    } catch (error) { options.showError(error) }
  }

  async function generateGroups(byRegion: boolean) {
    if (!selectedGroup.value) {
      options.showNotice(t('nodes.groupGenerationSelectSubscription'), 'error')
      return
    }
    try {
      const route = byRegion ? '/api/profile-groups/generate/regions' : '/api/profile-groups/generate/all'
      const result = await options.request(options.queryPath(route, { subscriptionId: selectedGroup.value || null }), { method: 'POST' })
      options.showNotice(options.operationMessage(result, 'profiles.grouped'))
      await Promise.all([loadGroups(), loadProfiles()])
    } catch (error) {
      const issue = error as ApiError
      if (byRegion && issue.code === 'profile_group_empty') options.showNotice(t('nodes.regionGroupsNoMatches'), 'error')
      else options.showError(error)
    }
  }

  async function exportSelected() {
    if (!selectedIds.value.length) return options.showNotice(t('nodes.selectionRequired'), 'error')
    try {
      const result = await options.data('/api/profiles/export', {
        method: 'POST',
        body: { profileIds: selectedIds.value, ...exportOptions.value },
      })
      exportContent.value = (result || []).map((item: Dict) => `# ${item.format}${item.remarks ? ` · ${item.remarks}` : ''}\n${item.content}`).join('\n\n')
      showExportDialog.value = true
    } catch (error) { options.showError(error) }
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportContent.value)
      options.showNotice(t('common.copySuccess'))
    } catch { options.showNotice(t('common.clipboardUnavailable'), 'error') }
  }

  function downloadExport() {
    const blob = new Blob([exportContent.value], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'v2rayN-profiles.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  function openContext(event: MouseEvent, profile: Dict) {
    event.preventDefault()
    openContextAt(event.clientX, event.clientY, profile)
  }

  async function openAddProfile() {
    await loadProfileCatalog()
    editingProfileId.value = ''
    profileModalError.value = ''
    profileForm.value = {
      configType: 'VMess', coreType: 'Xray', remarks: '', address: '', port: 443,
      password: '', username: '', network: profileEditorOptions.defaultNetwork, streamSecurity: 'tls', allowInsecure: '', sni: '',
      alpn: '', fingerprint: '', publicKey: '', shortId: '', spiderX: '', muxEnabled: null,
      protoExtra: { vmessSecurity: 'auto' },
      transportExtra: { rawHeaderType: 'none', xhttpMode: 'auto', kcpHeaderType: 'none', grpcMode: 'gun' },
    }
    groupChildIds.value = []
    profileAdvancedJson.value = JSON.stringify({
      indexId: '', configType: 'VMess', coreType: 'Xray', subid: '', isSub: false,
      remarks: '', address: '', port: 443, password: '', username: '', network: profileEditorOptions.defaultNetwork, streamSecurity: 'tls',
      allowInsecure: '', sni: '', alpn: '', fingerprint: '', publicKey: '', shortId: '', spiderX: '',
      protoExtra: '{}', transportExtra: '{}',
    }, null, 2)
    showProfileForm.value = true
  }

  async function openEditProfile(profile: Dict) {
    editingProfileId.value = profile.indexId
    profileModalError.value = ''
    try {
      const details = await options.data(`/api/profiles/${encodeURIComponent(profile.indexId)}`)
      await loadProfileCatalog()
      const protoExtra = parseObject(details.protoExtra)
      const transportExtra = parseObject(details.transportExtra)
      profileForm.value = {
        ...details,
        configType: options.canonicalCode(details.configType, [...protocolTypes, 'PolicyGroup', 'ProxyChain']),
        coreType: details.coreType ? options.canonicalCode(details.coreType, coreTypes) : '',
        network: canonicalNetwork(details.network),
        allowInsecure: details.allowInsecure === 'true',
        protoExtra: { ...protoExtra, childItems: parseList(protoExtra.childItems) },
        transportExtra,
      }
      groupChildIds.value = parseList(protoExtra.childItems)
      profileAdvancedJson.value = JSON.stringify(details, null, 2)
      showProfileForm.value = true
    } catch (error) { options.showError(error) }
  }

  async function saveProfile() {
    try {
      const advanced = JSON.parse(profileAdvancedJson.value || '{}')
      const protoExtra = normalizeNullableNumbers(
        { ...parseObject(advanced.protoExtra), ...profileForm.value.protoExtra },
        ['upMbps', 'downMbps', 'wgMtu', 'insecureConcurrency'],
      )
      const transportExtra = normalizeNullableNumbers(
        { ...parseObject(advanced.transportExtra), ...profileForm.value.transportExtra },
        ['kcpMtu'],
      )
      const isGroupProfile = ['PolicyGroup', 'ProxyChain'].includes(profileForm.value.configType)
      if (isGroupProfile) {
        if (!groupChildIds.value.length && !protoExtra.subChildItems) {
          profileModalError.value = t('nodes.groupChildRequired')
          return
        }
        protoExtra.groupType = profileForm.value.configType
        protoExtra.childItems = groupChildIds.value.join(',')
        if (profileForm.value.configType === 'PolicyGroup') {
          protoExtra.multipleLoad = profileForm.value.protoExtra.multipleLoad || 'LeastPing'
        } else {
          delete protoExtra.multipleLoad
        }
      } else {
        for (const field of ['groupType', 'childItems', 'subChildItems', 'filter', 'multipleLoad']) delete protoExtra[field]
      }
      const body: Dict = {
        ...advanced,
        configType: profileForm.value.configType,
        coreType: profileForm.value.coreType || null,
        ...(!isGroupProfile ? {
          address: profileForm.value.address,
          port: Number(profileForm.value.port || 0),
          password: profileForm.value.password || '',
          username: profileForm.value.username || '',
          network: canonicalNetwork(profileForm.value.network),
          streamSecurity: profileForm.value.streamSecurity || '',
          allowInsecure: profileForm.value.allowInsecure ? 'true' : '',
          sni: profileForm.value.sni || '',
          alpn: profileForm.value.alpn || '',
          fingerprint: profileForm.value.fingerprint || '',
          publicKey: profileForm.value.publicKey || '',
          shortId: profileForm.value.shortId || '',
          spiderX: profileForm.value.spiderX || '',
          mldsa65Verify: profileForm.value.mldsa65Verify || '',
          cert: profileForm.value.cert || '',
          certSha: profileForm.value.certSha || '',
          echConfigList: profileForm.value.echConfigList || '',
          verifyPeerCertByName: profileForm.value.verifyPeerCertByName || '',
          finalmask: profileForm.value.finalmask || '',
          muxEnabled: profileForm.value.muxEnabled,
          transportExtra: JSON.stringify(transportExtra),
        } : {}),
        remarks: profileForm.value.remarks,
        protoExtra: JSON.stringify(protoExtra),
      }
      if (isGroupProfile) {
        for (const field of groupIncompatibleProfileFields) delete body[field]
      }
      delete body.configVersion
      const result = await options.request(editingProfileId.value ? `/api/profiles/${encodeURIComponent(editingProfileId.value)}` : '/api/profiles', {
        method: editingProfileId.value ? 'PUT' : 'POST', body,
      })
      showProfileForm.value = false
      options.showNotice(options.operationMessage(result, 'profiles.saved'))
      await Promise.all([loadGroups(), loadProfiles(), options.loadStatus()])
    } catch (error) {
      if (error instanceof SyntaxError) profileModalError.value = t('common.invalidJson')
      else options.showError(error)
    }
  }

  function parseObject(value: unknown): Dict {
    if (typeof value !== 'string' || !value.trim()) return {}
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
  }

  function parseList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean)
    return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
  }

  function toggleGroupChild(id: string) {
    groupChildIds.value = groupChildIds.value.includes(id) ? groupChildIds.value.filter((item) => item !== id) : [...groupChildIds.value, id]
  }

  function moveGroupChild(id: string, direction: 'up' | 'down') {
    const index = groupChildIds.value.indexOf(id)
    const next = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || next < 0 || next >= groupChildIds.value.length) return
    const ordered = [...groupChildIds.value]
    ;[ordered[index], ordered[next]] = [ordered[next], ordered[index]]
    groupChildIds.value = ordered
  }

  async function loadProfileCatalog() {
    try {
      const groupIds = [...new Set(['', ...groups.value.map((group) => group.id).filter(Boolean)])]
      const lists = await Promise.all(groupIds.map((subscriptionId) => options.data(subscriptionId ? options.queryPath('/api/profiles', { subscriptionId }) : '/api/profiles?subscriptionId=')))
      profileCatalog.value = [...new Map(lists.flat().map((item: Dict) => [item.indexId, item])).values()]
    }
    catch (error) { options.showError(error) }
  }

  function openImportProfiles() {
    importForm.value = { content: '', subscriptionId: selectedGroup.value || '', isSubscription: false }
    showImportForm.value = true
  }

  async function pasteImport() {
    try { importForm.value.content = await navigator.clipboard.readText() } catch { options.showNotice(t('common.clipboardUnavailable'), 'error') }
  }

  async function readImportFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) importForm.value.content = await file.text()
    input.value = ''
  }

  async function importProfiles() {
    try {
      const result = await options.request('/api/profiles/import', { method: 'POST', body: importForm.value })
      const count = result.data?.imported ?? 0
      showImportForm.value = false
      options.showNotice(t('nodes.profilesImported', { count }))
      await Promise.all([loadGroups(), loadProfiles()])
    } catch (error) { options.showError(error) }
  }

  function formatDelay(value: number) {
    if (value < 0) return t('nodes.timeout')
    if (!value) return t('nodes.delayUntested')
    return `${value} ms`
  }

  const nodesPageState = reactive({ filteredProfiles, profiles, selectedGroup, groups, filter, selectedIds, focusedProfileId, allVisibleSelected, operations: options.operations, testActions })
  const profileModalState = reactive({ showProfileForm, profileForm, profileAdvancedJson, profileModalError, editingProfileId, protocolTypes, coreTypes, profileCatalog, groupChildIds, groups, networks: profileEditorOptions.networks })
  const importProfilesModalState = reactive({ showImportForm, importForm, groups })
  const exportModalState = reactive({ showExportDialog, exportOptions, exportContent })

  return {
    profiles, groups, selectedGroup, selectedIds, protocolTypes, coreTypes, showProfileForm, showImportForm, showExportDialog, loadGroups, loadProfiles,
    openEditProfile, selectProfile, startSpeedTest, runProfileAction,
    nodesPageState, profileModalState, importProfilesModalState, exportModalState,
    nodesPageActions: { openAddProfile, openImportProfiles, startSpeedTest, runProfileAction, stopSpeedTests, changeGroup, generateGroups, loadProfiles, toggleAllVisible, toggleProfile, sortProfiles, selectProfile, formatDelay, moveSelectedToGroup, moveSelected, moveSelectedPosition, exportSelected, openContext, focusProfile, setFocusedProfile, handleRowKeydown },
    profileModalActions: { saveProfile, toggleGroupChild, moveGroupChild },
    importProfilesModalActions: { importProfiles, readImportFile, pasteImport },
    exportModalActions: { exportSelected, copyExport, downloadExport },
  }
}
