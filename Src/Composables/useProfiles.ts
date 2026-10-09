import { computed, reactive, ref, type Ref } from 'vue'
import type { ApiError, ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'
import { canonicalNetwork } from '../profileEditorOptions'
import { normalizeProfileProtocolExtra, normalizeProfileTransportExtra } from './profilePayloads.js'
import { normalizeNullableNumbers } from './settingsPayloads.js'
import { mergeSpeedTestResult as mergeSpeedTestResultIntoRows } from './speedtestResults.js'
import { planSelectedMoves } from './movementOrder.js'

const groupIncompatibleProfileFields = [
  'address', 'port', 'password', 'username', 'network', 'headerType', 'requestHost', 'path',
  'streamSecurity', 'allowInsecure', 'sni', 'alpn', 'fingerprint', 'publicKey', 'shortId', 'spiderX',
  'mldsa65Verify', 'muxEnabled', 'cert', 'certSha', 'echConfigList', 'verifyPeerCertByName', 'finalmask',
  'extra', 'transportExtra', 'ports', 'alterId', 'flow', 'id', 'security',
]
const customFileIncompatibleProfileFields = [
  'port', 'password', 'username', 'network', 'headerType', 'requestHost', 'path', 'streamSecurity',
  'allowInsecure', 'sni', 'alpn', 'fingerprint', 'publicKey', 'shortId', 'spiderX', 'mldsa65Verify',
  'muxEnabled', 'cert', 'certSha', 'echConfigList', 'verifyPeerCertByName', 'finalmask', 'extra',
  'transportExtra', 'ports', 'alterId', 'flow', 'id', 'security',
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
  const editorOptions = ref<Dict>({})
  const profileCatalog = ref<Dict[]>([])
  const groupChildIds = ref<string[]>([])
  const exportOptions = ref({ includeShareUris: true, base64ShareUris: false, includeInnerUri: true, includeClientConfig: true })
  const exportContent = ref('')
  const showProfileForm = ref(false)
  const showImportForm = ref(false)
  const showExportDialog = ref(false)
  const editingProfileId = ref('')
  const profileModalError = ref('')
  let profilesLoadSequence = 0
  let testResultRevision = 0
  const testResultFields = ['delay', 'speed', 'ipInfo'] as const
  const liveTestResults = new Map<string, Partial<Record<typeof testResultFields[number], { revision: number; value: unknown }>>>()

  const protocolTypes = ref<string[]>([])
  const coreTypes = ref<string[]>([])
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

  async function loadEditorOptions() {
    const result = await options.data('/api/editor-options')
    editorOptions.value = result?.profiles || {}
    protocolTypes.value = editorOptions.value.configTypes || []
    coreTypes.value = editorOptions.value.coreTypes || []
  }

  async function loadGroups() {
    groups.value = await options.data('/api/profile-groups') || []
    if (!groups.value.some((group) => group.id === selectedGroup.value)) {
      selectedGroup.value = groups.value.find((group) => group.isCurrent)?.id || ''
    }
  }

  async function loadProfiles() {
    const sequence = ++profilesLoadSequence
    const resultRevision = testResultRevision
    const groupId = selectedGroup.value
    const query = filter.value.trim()
    const path = options.queryPath('/api/profiles', { subscriptionId: groupId, filter: query })
    const rows = await options.data(path) || []
    if (sequence !== profilesLoadSequence || groupId !== selectedGroup.value || query !== filter.value.trim()) return
    const rowMap = new Map<string, Dict>(rows.map((row: Dict) => [row.indexId, row]))
    for (const [id, fields] of liveTestResults) {
      const row = rowMap.get(id)
      if (!row) { liveTestResults.delete(id); continue }
      for (const field of testResultFields) {
        const result = fields[field]
        if (result && result.revision > resultRevision) row[field] = result.value
      }
    }
    profiles.value = rows
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

  function applySpeedTestResult(result: Dict) {
    const merged = mergeSpeedTestResultIntoRows(profiles.value, result)
    if (!merged) return false
    const fields = liveTestResults.get(result.indexId) || {}
    for (const field of testResultFields) {
      if (result[field] !== null && result[field] !== undefined && result[field] !== '') {
        fields[field] = { revision: ++testResultRevision, value: result[field] }
      }
    }
    liveTestResults.set(result.indexId, fields)
    return true
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
    const ids = [...selectedIds.value]
    try {
      // The move API uses the whole group, including rows hidden by the search filter.
      const rows: Dict[] = await options.data(options.queryPath('/api/profiles', { subscriptionId: selectedGroup.value })) || []
      for (const id of planSelectedMoves(rows.map((profile) => profile.indexId), ids, direction)) {
        await options.request('/api/profiles/move', { method: 'POST', body: { profileId: id, direction, position: -1 } })
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

  function openSubscriptionContext(event: MouseEvent, group: Dict) {
    event.preventDefault()
    event.stopPropagation()
    options.contextMenu.value = {
      type: 'subscription',
      group,
      x: Math.min(event.clientX, window.innerWidth - 250),
      y: Math.min(event.clientY, window.innerHeight - 180),
    }
  }

  async function openAddProfile() {
    try {
      await Promise.all([loadEditorOptions(), loadProfileCatalog()])
    } catch (error) { options.showError(error); return }
    editingProfileId.value = ''
    profileModalError.value = ''
    profileForm.value = {
      configType: 'VMess', coreType: '', remarks: '', address: '', port: 0,
      password: '', username: '', network: editorOptions.value.defaultNetwork, streamSecurity: editorOptions.value.defaultStreamSecurity, allowInsecure: false, sni: '',
      alpn: '', fingerprint: '', publicKey: '', shortId: '', spiderX: '', muxEnabled: false, displayLog: true, preSocksPort: null,
      protoExtra: {
        vmessSecurity: editorOptions.value.defaultSecurity,
        vlessEncryption: editorOptions.value.defaultVlessEncryption,
      },
      transportExtra: { rawHeaderType: editorOptions.value.rawHeaderTypes?.[0], xhttpMode: editorOptions.value.defaultXhttpMode, kcpHeaderType: editorOptions.value.rawHeaderTypes?.[0], grpcMode: editorOptions.value.defaultGrpcMode },
    }
    groupChildIds.value = []
    profileAdvancedJson.value = JSON.stringify({
      indexId: '', configType: 'VMess', coreType: 'Xray', subid: '', isSub: false,
      remarks: '', address: '', port: 0, password: '', username: '', network: editorOptions.value.defaultNetwork, streamSecurity: editorOptions.value.defaultStreamSecurity, displayLog: true, preSocksPort: null,
      allowInsecure: '', sni: '', alpn: '', fingerprint: '', publicKey: '', shortId: '', spiderX: '',
      protoExtra: '{}', transportExtra: '{}',
    }, null, 2)
    showProfileForm.value = true
  }

  async function openEditProfile(profile: Dict) {
    editingProfileId.value = profile.indexId
    profileModalError.value = ''
    try {
      await loadEditorOptions()
      const details = await options.data(`/api/profiles/${encodeURIComponent(profile.indexId)}`)
      await loadProfileCatalog()
      const configType = options.canonicalCode(details.configType, protocolTypes.value)
      const protoExtra = parseObject(details.protoExtra)
      if (configType === 'VMess' && !protoExtra.vmessSecurity) protoExtra.vmessSecurity = editorOptions.value.defaultSecurity
      if (configType === 'VLESS' && !protoExtra.vlessEncryption) protoExtra.vlessEncryption = editorOptions.value.defaultVlessEncryption
      if (configType === 'WireGuard' && protoExtra.wgMtu == null) protoExtra.wgMtu = editorOptions.value.defaultWireGuardMtu
      const transportExtra = parseObject(details.transportExtra)
      profileForm.value = {
        ...details,
        configType,
        coreType: details.coreType ? options.canonicalCode(details.coreType, coreTypes.value) : '',
        network: canonicalNetwork(details.network, editorOptions.value.networks || [], editorOptions.value.defaultNetwork),
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
      const transportExtra = normalizeProfileTransportExtra(
        { ...parseObject(advanced.transportExtra), ...profileForm.value.transportExtra },
      )
      const isGroupProfile = ['PolicyGroup', 'ProxyChain'].includes(profileForm.value.configType)
      const isCustomFileProfile = ['Custom', 'Outbound'].includes(profileForm.value.configType)
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
      const normalizedProtoExtra = normalizeProfileProtocolExtra(protoExtra, profileForm.value.configType)
      const body: Dict = {
        ...advanced,
        configType: profileForm.value.configType,
        coreType: profileForm.value.coreType || null,
        ...(!isGroupProfile && !isCustomFileProfile ? {
          address: profileForm.value.address,
          port: Number(profileForm.value.port || 0),
          preSocksPort: profileForm.value.preSocksPort === '' || profileForm.value.preSocksPort == null ? null : Number(profileForm.value.preSocksPort),
          displayLog: profileForm.value.displayLog !== false,
          password: profileForm.value.password || '',
          username: profileForm.value.username || '',
          network: canonicalNetwork(profileForm.value.network, editorOptions.value.networks || [], editorOptions.value.defaultNetwork),
          streamSecurity: profileForm.value.streamSecurity || '',
          allowInsecure: profileForm.value.allowInsecure ? 'true' : 'false',
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
          muxEnabled: Boolean(profileForm.value.muxEnabled),
          transportExtra: JSON.stringify(transportExtra),
        } : {}),
        ...(isCustomFileProfile ? {
          address: profileForm.value.address,
          displayLog: profileForm.value.displayLog !== false,
          preSocksPort: profileForm.value.preSocksPort === '' || profileForm.value.preSocksPort == null ? null : Number(profileForm.value.preSocksPort),
        } : {}),
        remarks: profileForm.value.remarks,
        protoExtra: JSON.stringify(normalizedProtoExtra),
      }
      if (isGroupProfile) {
        for (const field of groupIncompatibleProfileFields) delete body[field]
      }
      if (isCustomFileProfile) {
        for (const field of customFileIncompatibleProfileFields) delete body[field]
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
    const groupIds = [...new Set(['', ...groups.value.map((group) => group.id).filter(Boolean)])]
    const lists = await Promise.all(groupIds.map((subscriptionId) => options.data(subscriptionId ? options.queryPath('/api/profiles', { subscriptionId }) : '/api/profiles?subscriptionId=')))
    profileCatalog.value = [...new Map(lists.flat().map((item: Dict) => [item.indexId, item])).values()]
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
    return String(value)
  }

  function reset() {
    liveTestResults.clear()
    testResultRevision = 0
    profilesLoadSequence += 1
    profiles.value = []
    groups.value = []
    selectedGroup.value = ''
    filter.value = ''
    selectedIds.value = []
    focusedProfileId.value = ''
    sorting.value = { column: '', ascending: true }
    importForm.value = { content: '', subscriptionId: '', isSubscription: false }
    profileForm.value = {}
    profileAdvancedJson.value = ''
    editorOptions.value = {}
    protocolTypes.value = []
    coreTypes.value = []
    profileCatalog.value = []
    groupChildIds.value = []
    exportContent.value = ''
    showProfileForm.value = false
    showImportForm.value = false
    showExportDialog.value = false
    editingProfileId.value = ''
    profileModalError.value = ''
  }

  const nodesPageState = reactive({ filteredProfiles, profiles, selectedGroup, groups, filter, selectedIds, focusedProfileId, allVisibleSelected, sorting, operations: options.operations, testActions })
  const profileModalState = reactive({ showProfileForm, profileForm, profileAdvancedJson, profileModalError, editingProfileId, protocolTypes, coreTypes, profileCatalog, groupChildIds, groups, editorOptions })
  const importProfilesModalState = reactive({ showImportForm, importForm, groups })
  const exportModalState = reactive({ showExportDialog, exportOptions, exportContent })

  return {
    profiles, groups, selectedGroup, selectedIds, protocolTypes, coreTypes, showProfileForm, showImportForm, showExportDialog, loadEditorOptions, loadGroups, loadProfiles,
    openEditProfile, selectProfile, startSpeedTest, runProfileAction, reset,
    nodesPageState, profileModalState, importProfilesModalState, exportModalState,
    nodesPageActions: { openAddProfile, openImportProfiles, startSpeedTest, runProfileAction, stopSpeedTests, applySpeedTestResult, changeGroup, generateGroups, loadProfiles, toggleAllVisible, toggleProfile, sortProfiles, selectProfile, formatDelay, moveSelectedToGroup, moveSelected, moveSelectedPosition, exportSelected, openContext, openSubscriptionContext, focusProfile, setFocusedProfile, handleRowKeydown },
    profileModalActions: { saveProfile, toggleGroupChild, moveGroupChild },
    importProfilesModalActions: { importProfiles, readImportFile, pasteImport },
    exportModalActions: { exportSelected, copyExport, downloadExport },
  }
}
