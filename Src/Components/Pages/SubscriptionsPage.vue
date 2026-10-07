<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import ActionDropdown from '../ActionDropdown.vue'
import type { UiProps } from '../types'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const expanded = ref(new Set<string>())
function toggleDetails(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}
</script>

<template>
<section class="page subscriptions-page">
   <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('subscriptions.title') }}</h1><span class="count-tag">{{ state.subscriptions.length }}</span></div><div class="toolbar toolbar-main"><button class="button primary" @click="actions.openAddSubscription"><UiIcon name="plus" /> {{ t('subscriptions.addSubscription') }}</button><span class="desktop-subscription-tools"><span class="toolbar-divider"></span><label class="check-inline"><UiCheckbox v-model="state.subscriptionUseProxy" />{{ t('subscriptions.useProxy') }}</label><button class="button" @click="actions.updateSubscriptions(null, state.subscriptionUseProxy)">{{ t(actions.subscriptionUpdateMessageKey(null, state.subscriptionUseProxy)) }}</button><button class="button" :disabled="!state.selectedGroup" @click="actions.updateSubscriptions(state.selectedGroup || null, state.subscriptionUseProxy)">{{ t(state.subscriptionUseProxy ? 'subscriptions.updateGroupViaProxy' : 'subscriptions.updateGroup') }}</button></span>
     <ActionDropdown class="mobile-subscription-tools" :label="t('common.more')">
       <button class="action-menu-item menu-stay-open" role="menuitemcheckbox" :aria-checked="state.subscriptionUseProxy" @click="state.subscriptionUseProxy = !state.subscriptionUseProxy">{{ t('subscriptions.useProxy') }}<UiIcon v-if="state.subscriptionUseProxy" name="check" :size="12" /></button>
       <button class="action-menu-item" role="menuitem" @click="actions.updateSubscriptions(null, state.subscriptionUseProxy)">{{ t(actions.subscriptionUpdateMessageKey(null, state.subscriptionUseProxy)) }}</button>
       <button class="action-menu-item" role="menuitem" :disabled="!state.selectedGroup" @click="actions.updateSubscriptions(state.selectedGroup, state.subscriptionUseProxy)">{{ t(state.subscriptionUseProxy ? 'subscriptions.updateGroupViaProxy' : 'subscriptions.updateGroup') }}</button>
     </ActionDropdown>
   </div></div>
  <div class="table-container subscription-table-wrap"><table class="data-table subscription-table"><thead><tr><th>{{ t('subscriptions.name') }}</th><th>{{ t('subscriptions.url') }}</th><th>{{ t('common.enabled') }}</th><th>{{ t('subscriptions.interval') }}</th><th>{{ t('subscriptions.updated') }}</th><th>{{ t('subscriptions.userAgent') }}</th><th>{{ t('subscriptions.filter') }}</th><th>{{ t('nodes.actions') }}</th></tr></thead><tbody>
     <tr v-for="item in state.subscriptions" :key="item.id" :data-subscription-id="item.id" :class="{ 'details-open': expanded.has(item.id) }">
       <td class="strong-cell subscription-identity" :data-label="t('subscriptions.name')"><span>{{ item.remarks }}</span><span class="mobile-subscription-status" :class="{ enabled: item.enabled }">{{ t(item.enabled ? 'common.enabled' : 'common.disabled') }}</span></td>
       <td class="url-cell subscription-detail" :class="{ 'empty-detail': !item.url }" :title="item.url" :data-label="t('subscriptions.url')">{{ item.url }}</td>
       <td class="subscription-enabled" :data-label="t('common.enabled')">{{ item.enabled ? t('common.enabled') : t('common.disabled') }}</td>
       <td class="subscription-interval" :data-label="t('subscriptions.interval')"><span class="desktop-subscription-interval">{{ item.autoUpdateInterval }}</span><span class="mobile-subscription-interval">{{ Number(item.autoUpdateInterval) > 0 ? t('subscriptions.intervalSummary', { minutes: item.autoUpdateInterval }) : t('subscriptions.manualUpdate') }}</span></td>
       <td class="subscription-updated" :data-label="t('subscriptions.updated')">{{ item.updateTime ? actions.formatDate(item.updateTime) : t('subscriptions.neverUpdated') }}</td>
       <td class="subscription-detail" :class="{ 'empty-detail': !item.userAgent }" :data-label="t('subscriptions.userAgent')">{{ item.userAgent || '—' }}</td>
       <td class="subscription-detail" :class="{ 'empty-detail': !item.filter }" :data-label="t('subscriptions.filter')">{{ item.filter || '—' }}</td>
       <td class="row-actions desktop-subscription-actions" :data-label="t('nodes.actions')"><button class="link-button danger-text" @click="actions.deleteSubscription(item)">{{ t('common.delete') }}</button><button class="link-button" @click="actions.openEditSubscription(item)">{{ t('common.edit') }}</button><button class="link-button" @click="actions.shareSubscription(item)">{{ t('subscriptions.share') }}</button><button class="link-button" @click="actions.updateSubscription(item.id)">{{ t(state.subscriptionUseProxy ? 'subscriptions.updateViaProxy' : 'subscriptions.update') }}</button></td>
       <td class="mobile-subscription-actions">
         <button v-if="item.url || item.userAgent || item.filter" class="subscription-disclosure" :aria-expanded="expanded.has(item.id)" @click="toggleDetails(item.id)">{{ t(expanded.has(item.id) ? 'nodes.collapseDetails' : 'subscriptions.details') }}<UiIcon name="chevron-down" :size="12" /></button>
         <div class="subscription-action-group"><button class="button primary" @click="actions.updateSubscription(item.id)">{{ t(state.subscriptionUseProxy ? 'subscriptions.updateViaProxy' : 'subscriptions.update') }}</button>
           <ActionDropdown :label="t('common.more')" icon-only>
             <button class="action-menu-item" role="menuitem" @click="actions.openEditSubscription(item)">{{ t('common.edit') }}</button>
             <button class="action-menu-item" role="menuitem" @click="actions.shareSubscription(item)">{{ t('subscriptions.share') }}</button>
             <button class="action-menu-item danger" role="menuitem" @click="actions.deleteSubscription(item)">{{ t('common.delete') }}</button>
           </ActionDropdown>
         </div>
       </td>
     </tr>
    <tr v-if="!state.subscriptions.length"><td colspan="8" class="empty-row">{{ t('subscriptions.noSubscriptions') }}</td></tr>
  </tbody></table></div>
</section>
</template>
