<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
</script>

<template>
<section class="page">
  <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('subscriptions.title') }}</h1><span class="count-tag">{{ state.subscriptions.length }}</span></div><div class="toolbar toolbar-main"><button class="button primary" @click="actions.openAddSubscription"><UiIcon name="plus" /> {{ t('subscriptions.addSubscription') }}</button><span class="toolbar-divider"></span><label class="check-inline"><UiCheckbox v-model="state.subscriptionUseProxy" />{{ t('subscriptions.useProxy') }}</label><button class="button" @click="actions.updateSubscriptions(null, state.subscriptionUseProxy)">{{ t(actions.subscriptionUpdateMessageKey(null, state.subscriptionUseProxy)) }}</button><button class="button" @click="actions.updateSubscriptions(state.selectedGroup || null, state.subscriptionUseProxy)">{{ t(actions.subscriptionUpdateMessageKey(state.selectedGroup || null, state.subscriptionUseProxy)) }}</button></div></div>
  <div class="table-container subscription-table-wrap"><table class="data-table subscription-table"><thead><tr><th>{{ t('subscriptions.name') }}</th><th>{{ t('subscriptions.url') }}</th><th>{{ t('common.enabled') }}</th><th>{{ t('subscriptions.interval') }}</th><th>{{ t('subscriptions.updated') }}</th><th>{{ t('subscriptions.userAgent') }}</th><th>{{ t('subscriptions.filter') }}</th><th>{{ t('nodes.actions') }}</th></tr></thead><tbody>
    <tr v-for="item in state.subscriptions" :key="item.id"><td class="strong-cell">{{ item.remarks }}</td><td class="url-cell" :title="item.url">{{ item.url }}</td><td>{{ item.enabled ? t('common.enabled') : t('common.disabled') }}</td><td>{{ item.autoUpdateInterval || t('common.none') }}</td><td>{{ item.updateTime ? actions.formatDate(item.updateTime) : t('subscriptions.neverUpdated') }}</td><td>{{ item.userAgent || '—' }}</td><td>{{ item.filter || '—' }}</td><td class="row-actions"><button class="link-button danger-text" @click="actions.deleteSubscription(item)">{{ t('common.delete') }}</button><button class="link-button" @click="actions.openEditSubscription(item)">{{ t('common.edit') }}</button><button class="link-button" @click="actions.shareSubscription(item)">{{ t('subscriptions.share') }}</button><button class="link-button" @click="actions.updateSubscription(item.id)">{{ t(state.subscriptionUseProxy ? 'subscriptions.updateViaProxy' : 'subscriptions.update') }}</button></td></tr>
    <tr v-if="!state.subscriptions.length"><td colspan="8" class="empty-row">{{ t('subscriptions.noSubscriptions') }}</td></tr>
  </tbody></table></div>
</section>
</template>
