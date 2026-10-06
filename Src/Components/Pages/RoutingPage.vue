<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionDropdown from '../ActionDropdown.vue'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const allRoutesSelected = computed(() => state.routes.length > 0 && state.selectedRouteIds.length === state.routes.length)
const allRulesSelected = computed(() => state.routingRules.length > 0 && state.selectedRuleIds.length === state.routingRules.length)
const ruleImportInput = ref<HTMLInputElement | null>(null)
function ruleSummary(rule: Record<string, any>) {
  return [...(rule.domain || []), ...(rule.ip || []), ...(rule.process || []), rule.port, rule.network, ...(rule.protocol || [])].filter(Boolean).join(', ') || '—'
}
function fallbackRuleName(rule: Record<string, any>) {
  return rule.domain?.[0] || rule.ip?.[0] || rule.process?.[0] || rule.outboundTag || '—'
}
</script>

<template>
  <section class="page routing-page">
     <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('routing.title') }}</h1><span class="count-tag">{{ state.routes.length }}</span></div><div class="toolbar toolbar-main"><button class="button primary" @click="actions.openAddRoute"><UiIcon name="plus" /> {{ t('routing.create') }}</button><span class="desktop-routing-tools"><button class="button danger" :disabled="!state.selectedRouteIds.length || state.deletingSelectedRoutes" @click="actions.deleteSelectedRoutes">{{ state.deletingSelectedRoutes ? t('common.loading') : t('common.deleteSelected', { count: state.selectedRouteIds.length }) }}</button><button class="button" :disabled="!state.selectedRoutingId" @click="actions.activateRoute(state.selectedRoutingId)">{{ t('routing.setDefault') }}</button><ActionDropdown :label="t('routing.importProfiles')"><button class="action-menu-item" role="menuitem" @click="actions.importRoutingProfiles">{{ t('routing.importProfiles') }}</button></ActionDropdown></span>
       <ActionDropdown class="mobile-routing-tools" :label="t('common.more')">
         <button class="action-menu-item" role="menuitem" :disabled="!state.selectedRoutingId" @click="actions.activateRoute(state.selectedRoutingId)">{{ t('routing.setDefault') }}</button>
         <button class="action-menu-item" role="menuitem" @click="actions.importRoutingProfiles">{{ t('routing.importProfiles') }}</button>
         <button class="action-menu-item danger" role="menuitem" :disabled="!state.selectedRouteIds.length || state.deletingSelectedRoutes" @click="actions.deleteSelectedRoutes">{{ t('common.deleteSelected', { count: state.selectedRouteIds.length }) }}</button>
       </ActionDropdown>
     </div></div>

    <div class="routing-strategy-bar">
      <label>{{ t('routing.domainStrategy') }}<select v-model="state.routingForm.domainStrategy"><option v-for="strategy in state.routingOptions.routingBasicDomainStrategies || []" :key="strategy" :value="strategy">{{ strategy }}</option></select></label>
      <label>{{ t('routing.domainStrategySingbox') }}<select v-model="state.routingForm.domainStrategy4Singbox"><option v-for="strategy in state.routingOptions.routingBasicDomainStrategies4Singbox || []" :key="strategy || 'none'" :value="strategy">{{ strategy || t('common.none') }}</option></select></label>
      <button class="button compact" @click="actions.saveRoutingStrategies">{{ t('common.save') }}</button>
    </div>

    <div class="split-pane split-workspace routing-workspace">
      <section class="panel subpanel route-list-panel">
        <div class="subpanel-heading"><div class="heading-check"><UiCheckbox :model-value="allRoutesSelected" :aria-label="t('common.selectAll')" @change="actions.toggleAllRoutes" /><h2>{{ t('routing.profiles') }}</h2><span class="count-tag">{{ state.routes.length }}</span></div><div class="row-actions"><button class="tool-button" :aria-label="t('common.selectAll')" :title="t('common.selectAll')" @click="actions.toggleAllRoutes"><UiIcon name="check-all" /></button><button class="tool-button" :aria-label="t('common.refresh')" :title="t('common.refresh')" @click="actions.loadRouting"><UiIcon name="refresh" /></button></div></div>
        <div v-for="route in state.routes" :key="route.id" :class="['route-row', { selected: route.id === state.selectedRoutingId, current: route.id === state.activeRoutingId }]">
          <UiCheckbox :model-value="state.selectedRouteIds.includes(route.id)" :aria-label="route.remarks" @change="state.selectedRouteIds = state.selectedRouteIds.includes(route.id) ? state.selectedRouteIds.filter((id: string) => id !== route.id) : [...state.selectedRouteIds, route.id]" @click.stop />
          <button class="route-select" @click="actions.selectRoutingProfile(route.id)"><span class="route-info"><strong>{{ route.remarks }}</strong><small>{{ route.ruleNum }} · {{ route.enabled ? t('common.enabled') : t('common.disabled') }}</small></span><span v-if="route.id === state.activeRoutingId" class="current-label">{{ t('routing.default') }}</span></button>
          <div class="row-actions"><button class="tool-button" :aria-label="t('common.edit')" :title="t('common.edit')" @click="actions.openEditRoute(route)"><UiIcon name="edit" /></button><button class="tool-button danger-text" :aria-label="t('common.delete')" :title="t('common.delete')" @click="actions.deleteRoute(route)"><UiIcon name="close" /></button></div>
        </div>
        <p v-if="!state.routes.length" class="muted empty-inline">{{ t('routing.noRouting') }}</p>
        <div class="preset-bar"><span>{{ t('routing.regionalPreset') }}</span><button class="link-button" :disabled="Boolean(state.applyingPreset)" :aria-busy="state.applyingPreset === 'Default'" @click="actions.applyPreset('Default')">{{ state.applyingPreset === 'Default' ? t('common.loading') : t('routing.presetDefault') }}</button><button class="link-button" :disabled="Boolean(state.applyingPreset)" :aria-busy="state.applyingPreset === 'Russia'" @click="actions.applyPreset('Russia')">{{ state.applyingPreset === 'Russia' ? t('common.loading') : t('routing.presetRussia') }}</button><button class="link-button" :disabled="Boolean(state.applyingPreset)" :aria-busy="state.applyingPreset === 'Iran'" @click="actions.applyPreset('Iran')">{{ state.applyingPreset === 'Iran' ? t('common.loading') : t('routing.presetIran') }}</button></div>
      </section>

      <section class="panel subpanel rules-panel">
        <div class="subpanel-heading rules-heading"><div><h2>{{ t('routing.rules') }}</h2><small>{{ state.selectedRoute?.remarks || t('common.none') }} · {{ state.routingRules.length }}</small></div><button class="button compact primary" :disabled="!state.selectedRoutingId" @click="actions.addRoutingRule"><UiIcon name="plus" /> {{ t('routing.addRule') }}</button></div>
        <div class="mobile-rule-actions">
          <span class="muted">{{ t('common.selected', { count: state.selectedRuleIds.length }) }}</span>
          <ActionDropdown :label="t('routing.batchActions')">
            <button class="action-menu-item" role="menuitem" :disabled="!state.routingRules.length" @click="actions.toggleAllRules">{{ t(allRulesSelected ? 'common.clearSelection' : 'common.selectAll') }}</button>
            <button class="action-menu-item" role="menuitem" :disabled="!state.selectedRuleIds.length" @click="actions.exportSelectedRules">{{ t('routing.exportSelected') }}</button>
            <button v-for="direction in ['top', 'up', 'down', 'bottom']" :key="direction" class="action-menu-item" role="menuitem" :disabled="!state.selectedRuleIds.length" @click="actions.moveSelectedRules(direction)">{{ t(`nodes.${direction}`) }}</button>
            <button class="action-menu-item danger" role="menuitem" :disabled="!state.selectedRuleIds.length || state.deletingSelectedRules" @click="actions.deleteSelectedRules">{{ t('common.deleteSelected', { count: state.selectedRuleIds.length }) }}</button>
          </ActionDropdown>
          <ActionDropdown :label="t('routing.importMenu')">
            <button class="action-menu-item menu-stay-open" role="menuitemcheckbox" :aria-checked="state.appendRules" @click="state.appendRules = !state.appendRules">{{ t('routing.append') }}<UiIcon v-if="state.appendRules" name="check" :size="12" /></button>
            <div class="action-menu-separator" role="separator"></div>
            <button class="action-menu-item" role="menuitem" @click="ruleImportInput?.click()">{{ t('routing.importFromFile') }}</button>
            <button class="action-menu-item" role="menuitem" @click="actions.importRulesFromClipboard">{{ t('routing.importFromClipboard') }}</button>
            <button class="action-menu-item" role="menuitem" :disabled="!state.selectedRoute?.url" @click="actions.importRulesFromUrl">{{ t('routing.importFromUrl') }}</button>
          </ActionDropdown>
          <input ref="ruleImportInput" hidden type="file" accept=".json,application/json,text/plain" @change="actions.readRulesFile" />
        </div>
        <div class="rule-toolbar toolbar">
          <button class="button compact danger" :disabled="!state.selectedRuleIds.length || state.deletingSelectedRules" @click="actions.deleteSelectedRules">{{ state.deletingSelectedRules ? t('common.loading') : t('common.deleteSelected', { count: state.selectedRuleIds.length }) }}</button>
          <button class="button compact" :disabled="!state.routingRules.length" @click="actions.toggleAllRules">{{ allRulesSelected ? t('common.clearSelection') : t('common.selectAll') }}</button>
          <button class="button compact" :disabled="!state.selectedRuleIds.length" @click="actions.exportSelectedRules">{{ t('routing.exportSelected') }}</button>
          <span class="toolbar-divider"></span>
          <button class="button compact" :disabled="!state.selectedRuleIds.length" @click="actions.moveSelectedRules('top')">{{ t('nodes.top') }}</button>
          <button class="button compact" :disabled="!state.selectedRuleIds.length" @click="actions.moveSelectedRules('up')">{{ t('nodes.up') }}</button>
          <button class="button compact" :disabled="!state.selectedRuleIds.length" @click="actions.moveSelectedRules('down')">{{ t('nodes.down') }}</button>
          <button class="button compact" :disabled="!state.selectedRuleIds.length" @click="actions.moveSelectedRules('bottom')">{{ t('nodes.bottom') }}</button>
          <span class="toolbar-divider"></span>
          <label class="button compact file-button">{{ t('routing.importFromFile') }}<input type="file" accept=".json,application/json,text/plain" @change="actions.readRulesFile" /></label>
          <button class="button compact" @click="actions.importRulesFromClipboard">{{ t('routing.importFromClipboard') }}</button>
          <button class="button compact" :disabled="!state.selectedRoute?.url" :title="state.selectedRoute?.url || t('routing.urlRequired')" @click="actions.importRulesFromUrl">{{ t('routing.importFromUrl') }}</button>
        </div>
        <div class="rule-import-options"><label class="check-inline"><UiCheckbox v-model="state.appendRules" />{{ t('routing.append') }}</label><small>{{ t('routing.importParserHint') }}</small></div>
        <div class="rules-mini-table">
          <div class="rule-grid-head"><UiCheckbox :model-value="allRulesSelected" :aria-label="t('common.selectAll')" @change="actions.toggleAllRules" /><span>{{ t('routing.remarks') }}</span><span>{{ t('routing.ruleType') }}</span><span>{{ t('routing.outboundTag') }}</span><span>{{ t('routing.matchers') }}</span><span>{{ t('nodes.actions') }}</span></div>
          <div v-for="rule in state.routingRules" :key="rule.id" class="rule-row" :class="{ selected: state.selectedRuleIds.includes(rule.id) }" @dblclick="actions.openEditRoutingRule(rule)">
             <label class="rule-select-label" @click.stop @dblclick.stop><UiCheckbox :model-value="state.selectedRuleIds.includes(rule.id)" :aria-label="rule.remarks || rule.outboundTag" @change="state.selectedRuleIds = state.selectedRuleIds.includes(rule.id) ? state.selectedRuleIds.filter((id: string) => id !== rule.id) : [...state.selectedRuleIds, rule.id]" @click.stop /></label>
             <button class="rule-edit-button" :title="t('common.edit')" @click="actions.openEditRoutingRule(rule)"><i :class="['rule-state', { off: !rule.enabled }]" aria-hidden="true"></i><strong :class="{ 'empty-rule-name': !rule.remarks }">{{ rule.remarks || '—' }}</strong><strong v-if="!rule.remarks" class="mobile-rule-fallback">{{ fallbackRuleName(rule) }}</strong><span class="mobile-rule-outbound" :title="rule.outboundTag">{{ rule.outboundTag || '—' }}</span></button>
              <span class="rule-type" :class="{ empty: !rule.ruleType }" :data-label="t('routing.ruleType')">{{ rule.ruleType || '—' }}</span><span class="rule-outbound" :data-label="t('routing.outboundTag')">{{ rule.outboundTag || '—' }}</span>
              <span class="rule-details" :class="{ 'duplicate-rule-summary': !rule.remarks && ruleSummary(rule) === fallbackRuleName(rule) }" :data-label="t('routing.matchers')" :title="ruleSummary(rule)">{{ ruleSummary(rule) }}</span>
             <div class="row-actions"><button class="tool-button" :aria-label="t('common.edit')" :title="t('common.edit')" @click="actions.openEditRoutingRule(rule)"><UiIcon name="edit" /></button><button class="tool-button danger-text" :disabled="state.deletingSelectedRules || state.deletingRuleId === rule.id" :aria-busy="state.deletingRuleId === rule.id" :aria-label="t('common.delete')" :title="t('common.delete')" @click="actions.removeRoutingRule(rule)"><UiIcon name="close" /></button></div>
             <ActionDropdown class="mobile-rule-menu" :label="t('common.more')" icon-only>
               <button class="action-menu-item" role="menuitem" @click="actions.openEditRoutingRule(rule)">{{ t('common.edit') }}</button>
               <button class="action-menu-item danger" role="menuitem" :disabled="state.deletingSelectedRules || state.deletingRuleId === rule.id" @click="actions.removeRoutingRule(rule)">{{ t('common.delete') }}</button>
             </ActionDropdown>
          </div>
          <p v-if="!state.routingRules.length" class="muted empty-inline">{{ t('common.empty') }}</p>
        </div>
        <details class="advanced-editor routing-raw-editor"><summary>{{ t('routing.advancedJson') }}</summary><p class="field-hint">{{ t('routing.ruleJsonHint') }}</p><textarea v-model="state.rulesRaw" class="code-area rules-json" spellcheck="false"></textarea><div class="button-row"><button class="button compact" @click="actions.copyRoutingRules">{{ t('common.copy') }}</button><button class="button compact primary" :disabled="!state.selectedRoutingId" @click="actions.saveRoutingRules">{{ t('routing.saveRules') }}</button></div></details>
      </section>
    </div>
  </section>
</template>
