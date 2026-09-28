import { computed, reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'

export function useRouting(options: ApiServices & {
  t: Translate
  showNotice: Notice
  showError: ErrorHandler
  confirm: (message: string) => Promise<boolean>
  loadStatus: () => Promise<void>
}) {
  const t = options.t
  const activeRoutingId = ref('')
  const selectedRoutingId = ref('')
  const routes = ref<Dict[]>([])
  const routingOptions = ref<Dict>({})
  const routingRules = ref<Dict[]>([])
  const selectedRouteIds = ref<string[]>([])
  const selectedRuleIds = ref<string[]>([])
  const rulesRaw = ref('[]')
  const ruleImportText = ref('')
  const appendRules = ref(true)
  const routingForm = ref<Dict>({})
  const routeForm = ref<Dict>({})
  const ruleForm = ref<Dict>({})
  const ruleAdvancedJson = ref('')
  const ruleModalError = ref('')
  const showRouteForm = ref(false)
  const showRuleForm = ref(false)
  const editingRouteId = ref('')
  const editingRuleId = ref('')
  let rulesLoadSequence = 0
  const currentRoute = computed(() => routes.value.find((route) => route.isActive) || null)
  const selectedRoute = computed(() => routes.value.find((route) => route.id === selectedRoutingId.value) || null)

  async function loadRouting() {
    routes.value = await options.data('/api/settings/routing-profiles') || []
    selectedRouteIds.value = selectedRouteIds.value.filter((id) => routes.value.some((route) => route.id === id))
    activeRoutingId.value = routes.value.find((item) => item.isActive)?.id || ''
    if (!routes.value.some((item) => item.id === selectedRoutingId.value)) {
      selectedRoutingId.value = activeRoutingId.value || routes.value[0]?.id || ''
    }
    if (selectedRoutingId.value) await loadRules(selectedRoutingId.value)
    else {
      routingRules.value = []
      rulesRaw.value = '[]'
    }
  }

  async function loadRules(id = selectedRoutingId.value) {
    const sequence = ++rulesLoadSequence
    if (!id) {
      routingRules.value = []
      selectedRuleIds.value = []
      rulesRaw.value = '[]'
      return
    }
    const rules = await options.data(`/api/settings/routing-profiles/${encodeURIComponent(id)}/rules`) || []
    if (sequence !== rulesLoadSequence || id !== selectedRoutingId.value) return
    routingRules.value = rules
    selectedRuleIds.value = selectedRuleIds.value.filter((ruleId) => routingRules.value.some((rule) => rule.id === ruleId))
    rulesRaw.value = JSON.stringify(routingRules.value, null, 2)
  }

  async function selectRoutingProfile(id: string) {
    if (!routes.value.some((route) => route.id === id)) return
    selectedRoutingId.value = id
    await loadRules(id)
  }

  async function activateRoute(id: string) {
    if (!id) return
    try {
      selectedRoutingId.value = id
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(id)}/activate`, { method: 'POST' })
      activeRoutingId.value = id
      options.showNotice(options.operationMessage(result))
      await Promise.all([loadRouting(), options.loadStatus()])
    } catch (error) { options.showError(error) }
  }

  function openAddRoute() {
    editingRouteId.value = ''
    routeForm.value = { remarks: '', url: '', enabled: true, locked: false, customIcon: '', customRulesetPath4Singbox: '', domainStrategy: '', domainStrategy4Singbox: '', ruleSet: '[]', ruleNum: 0, sort: routes.value.length + 1 }
    showRouteForm.value = true
  }

  function openEditRoute(route: Dict) {
    editingRouteId.value = route.id
    routeForm.value = { ...route }
    showRouteForm.value = true
  }

  async function saveRoute() {
    try {
      const result = await options.request(editingRouteId.value ? `/api/settings/routing-profiles/${encodeURIComponent(editingRouteId.value)}` : '/api/settings/routing-profiles', {
        method: editingRouteId.value ? 'PUT' : 'POST', body: routeForm.value,
      })
      showRouteForm.value = false
      options.showNotice(options.operationMessage(result))
      await loadRouting()
    } catch (error) { options.showError(error) }
  }

  async function deleteRoute(route: Dict) {
    if (!await options.confirm(t('common.confirmDelete'))) return
    try {
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(route.id)}`, { method: 'DELETE' })
      options.showNotice(options.operationMessage(result))
      await loadRouting()
    } catch (error) { options.showError(error) }
  }

  function toggleAllRoutes() {
    selectedRouteIds.value = selectedRouteIds.value.length === routes.value.length ? [] : routes.value.map((route) => route.id)
  }

  async function deleteSelectedRoutes() {
    if (!selectedRouteIds.value.length || !await options.confirm(t('common.confirmDelete'))) return
    try {
      for (const id of [...selectedRouteIds.value]) {
        await options.request(`/api/settings/routing-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
      }
      selectedRouteIds.value = []
      options.showNotice(t('common.deleted'))
      await loadRouting()
    } catch (error) { options.showError(error) }
  }

  async function importRoutingProfiles() {
    try {
      const result = await options.request('/api/settings/routing-profiles/import', { method: 'POST' })
      options.showNotice(options.operationMessage(result))
      await loadRouting()
    } catch (error) { options.showError(error) }
  }

  async function saveRoutingRules() {
    try {
      const parsed = JSON.parse(rulesRaw.value)
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules`, { method: 'PUT', body: parsed })
      options.showNotice(options.operationMessage(result))
      await loadRules()
    } catch (error) {
      if (error instanceof SyntaxError) options.showNotice(t('common.invalidJson'), 'error')
      else options.showError(error)
    }
  }

  async function importRoutingRules() {
    if (!selectedRoutingId.value || !ruleImportText.value.trim()) return
    try {
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules/import`, {
        method: 'POST', body: { content: ruleImportText.value, append: appendRules.value },
      })
      ruleImportText.value = ''
      options.showNotice(options.operationMessage(result))
      await loadRules()
    } catch (error) { options.showError(error) }
  }

  async function importRulesFromClipboard() {
    try { ruleImportText.value = await navigator.clipboard.readText() }
    catch { options.showNotice(t('common.clipboardUnavailable'), 'error'); return }
    await importRoutingRules()
  }

  async function readRulesFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      ruleImportText.value = await file.text()
      await importRoutingRules()
    }
    input.value = ''
  }

  async function importRulesFromUrl() {
    const url = selectedRoute.value?.url?.trim()
    if (!url) return options.showNotice(t('routing.urlRequired'), 'error')
    try {
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules/import-url`, {
        method: 'POST', body: { append: appendRules.value },
      })
      options.showNotice(options.operationMessage(result))
      await loadRules(selectedRoutingId.value)
    } catch (error) {
      options.showNotice(t('routing.urlImportFailed', { error: error instanceof Error ? error.message : String(error) }), 'error')
    }
  }

  function addRoutingRule() {
    editingRuleId.value = ''
    ruleModalError.value = ''
    ruleForm.value = { id: crypto.randomUUID(), enabled: true, type: 'field', remarks: '', ruleType: null, outboundTag: 'proxy', port: '', network: '', inboundTagText: '', protocolText: '', domainText: '', ipText: '', processText: '' }
    ruleAdvancedJson.value = JSON.stringify({ id: '', type: 'field', port: '', network: '', inboundTag: [], outboundTag: 'proxy', ip: [], domain: [], protocol: [], process: [], enabled: true, remarks: '', ruleType: null }, null, 2)
    showRuleForm.value = true
  }

  function openEditRoutingRule(rule: Dict) {
    editingRuleId.value = rule.id
    ruleModalError.value = ''
    ruleForm.value = {
      ...rule,
      inboundTagText: (rule.inboundTag || []).join('\n'),
      protocolText: (rule.protocol || []).join('\n'),
      domainText: (rule.domain || []).join('\n'),
      ipText: (rule.ip || []).join('\n'),
      processText: (rule.process || []).join('\n'),
    }
    ruleAdvancedJson.value = JSON.stringify(rule, null, 2)
    showRuleForm.value = true
  }

  function listFromText(value: string) {
    return value.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean)
  }

  async function saveRoutingRule() {
    try {
      const advanced = JSON.parse(ruleAdvancedJson.value || '{}')
      const rule = {
        ...advanced,
        ...ruleForm.value,
        id: editingRuleId.value || ruleForm.value.id || crypto.randomUUID(),
        inboundTag: listFromText(ruleForm.value.inboundTagText || ''),
        protocol: listFromText(ruleForm.value.protocolText || ''),
        domain: listFromText(ruleForm.value.domainText || ''),
        ip: listFromText(ruleForm.value.ipText || ''),
        process: listFromText(ruleForm.value.processText || ''),
        ruleType: ruleForm.value.ruleType || null,
      }
      delete rule.inboundTagText
      delete rule.protocolText
      delete rule.domainText
      delete rule.ipText
      delete rule.processText
      const hasMatch = Boolean(rule.port || rule.network || rule.inboundTag.length || rule.protocol.length || rule.domain.length || rule.ip.length || rule.process.length)
      if (!hasMatch) {
        ruleModalError.value = t('routing.matchConditionRequired')
        return
      }
      const rules = editingRuleId.value
        ? routingRules.value.map((item) => item.id === editingRuleId.value ? rule : item)
        : [rule, ...routingRules.value]
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules`, { method: 'PUT', body: rules })
      showRuleForm.value = false
      options.showNotice(options.operationMessage(result))
      await loadRules()
    } catch (error) {
      if (error instanceof SyntaxError) ruleModalError.value = t('common.invalidJson')
      else options.showError(error)
    }
  }

  function toggleAllRules() {
    selectedRuleIds.value = selectedRuleIds.value.length === routingRules.value.length ? [] : routingRules.value.map((rule) => rule.id)
  }

  async function deleteSelectedRules() {
    if (!await options.confirm(t('common.confirmDelete'))) return
    try {
      for (const id of [...selectedRuleIds.value]) {
        await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
      }
      selectedRuleIds.value = []
      options.showNotice(t('common.deleted'))
      await loadRules()
    } catch (error) { options.showError(error) }
  }

  async function exportSelectedRules() {
    const selected = routingRules.value.filter((rule) => selectedRuleIds.value.includes(rule.id)).map(({ id: _id, ...rule }) => rule)
    if (!selected.length) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2))
      options.showNotice(t('common.copySuccess'))
    } catch { options.showNotice(t('common.clipboardUnavailable'), 'error') }
  }

  async function moveRoutingRule(rule: Dict, direction: string) {
    try {
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules/move`, {
        method: 'POST', body: { ruleId: rule.id, direction, position: -1 },
      })
      options.showNotice(options.operationMessage(result))
      await loadRules()
    } catch (error) { options.showError(error) }
  }

  async function moveSelectedRules(direction: string) {
    if (!selectedRuleIds.value.length) return
    const ordered = routingRules.value.filter((rule) => selectedRuleIds.value.includes(rule.id))
    if (direction === 'up' || direction === 'top') ordered.reverse()
    const directionName = direction[0].toUpperCase() + direction.slice(1)
    try {
      for (const rule of ordered) {
        await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules/move`, {
          method: 'POST', body: { ruleId: rule.id, direction: directionName, position: -1 },
        })
      }
      await loadRules()
    } catch (error) { options.showError(error) }
  }

  async function removeRoutingRule(rule: Dict) {
    try {
      const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(selectedRoutingId.value)}/rules/${encodeURIComponent(rule.id)}`, { method: 'DELETE' })
      options.showNotice(options.operationMessage(result))
      await loadRules()
    } catch (error) { options.showError(error) }
  }

  async function copyRoutingRules() {
    try {
      await navigator.clipboard.writeText(rulesRaw.value)
      options.showNotice(t('common.copySuccess'))
    } catch { options.showNotice(t('common.clipboardUnavailable'), 'error') }
  }

  async function saveRoutingStrategies() {
    try {
      const result = await options.request('/api/settings/routing', { method: 'PUT', body: routingForm.value })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function applyPreset(preset: string) {
    try {
      const result = await options.request(`/api/settings/regional-presets/${preset}`, { method: 'POST' })
      options.showNotice(options.operationMessage(result))
      await loadRouting()
    } catch (error) { options.showError(error) }
  }

  const routingPageState = reactive({ routes, activeRoutingId, selectedRoutingId, currentRoute, selectedRoute, routingForm, routingRules, rulesRaw, ruleImportText, appendRules, selectedRouteIds, selectedRuleIds, routingOptions })
  const routeModalState = reactive({ showRouteForm, routeForm, editingRouteId, routingOptions })
  const ruleModalState = reactive({ showRuleForm, ruleForm, ruleAdvancedJson, ruleModalError, editingRuleId })

  return {
    activeRoutingId, selectedRoutingId, routes, routingForm, routingOptions, showRouteForm, loadRouting, loadRules, routingPageState, routeModalState, ruleModalState,
    activateRoute,
    routingPageActions: { importRoutingProfiles, openAddRoute, loadRules, selectRoutingProfile, openEditRoute, deleteRoute, deleteSelectedRoutes, toggleAllRoutes, activateRoute, applyPreset, saveRoutingStrategies, addRoutingRule, openEditRoutingRule, saveRoutingRule, toggleAllRules, deleteSelectedRules, exportSelectedRules, moveSelectedRules, copyRoutingRules, saveRoutingRules, moveRoutingRule, removeRoutingRule, importRoutingRules, importRulesFromClipboard, readRulesFile, importRulesFromUrl },
    routeModalActions: { saveRoute },
    ruleModalActions: { saveRoutingRule },
  }
}
