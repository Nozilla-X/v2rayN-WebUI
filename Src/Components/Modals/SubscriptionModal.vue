<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '../../Composables/useModalFocus'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const dialog = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(dialog)
</script>

<template>
  <div v-if="state.showSubscriptionForm" class="modal-shade" @click.self="state.showSubscriptionForm = false">
    <form ref="dialog" class="modal-panel wide-modal modal-form" role="dialog" aria-modal="true" :aria-label="t(state.editingSubscriptionId ? 'subscriptions.editSubscription' : 'subscriptions.addSubscription')" tabindex="-1" @keydown="onModalKeydown" @submit.prevent="actions.saveSubscription">
      <header class="modal-head"><h2>{{ t(state.editingSubscriptionId ? 'subscriptions.editSubscription' : 'subscriptions.addSubscription') }}</h2><button class="tool-button" type="button" :aria-label="t('common.close')" @click="state.showSubscriptionForm = false"><UiIcon name="close" /></button></header>
      <div class="modal-content">
        <fieldset class="editor-section"><legend>{{ t('subscriptions.source') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.name') }}<input v-model="state.subscriptionForm.remarks" required /></label>
            <label>{{ t('subscriptions.url') }}<input v-model="state.subscriptionForm.url" inputmode="url" /></label>
            <label class="check-inline"><UiCheckbox v-model="state.subscriptionForm.enabled" />{{ t('subscriptions.enabled') }}</label>
            <label>{{ t('subscriptions.interval') }}<input v-model.number="state.subscriptionForm.autoUpdateInterval" type="number" min="0" /></label>
          </div>
          <details class="secondary-fields"><summary>{{ t('subscriptions.moreUrl') }}</summary><label>{{ t('subscriptions.moreUrl') }}<textarea v-model="state.subscriptionForm.moreUrl" /></label></details>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.filter') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.filter') }}<input v-model="state.subscriptionForm.filter" /></label>
            <label>{{ t('subscriptions.convertTarget') }}<select v-model="state.subscriptionForm.convertTarget"><option v-for="target in state.convertTargets" :key="target || 'none'" :value="target">{{ target || t('common.none') }}</option></select></label>
          </div>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.requestOptions') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.userAgent') }}<input v-model="state.subscriptionForm.userAgent" /></label>
            <label class="wide-field">{{ t('subscriptions.requestHeaders') }}<textarea v-model="state.subscriptionForm.requestHeaders" class="code-area" spellcheck="false" /></label>
            <label>{{ t('subscriptions.sort') }}<input v-model.number="state.subscriptionForm.sort" type="number" /></label>
          </div>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.proxyChain') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.prevProfile') }}<select v-model="state.subscriptionForm.prevProfile"><option value="">{{ t('common.none') }}</option><option v-if="state.subscriptionForm.prevProfile && !state.profileOptions.some((profile: Record<string, any>) => profile.remarks === state.subscriptionForm.prevProfile)" :value="state.subscriptionForm.prevProfile">{{ state.subscriptionForm.prevProfile }} · {{ t('subscriptions.profileNotListed') }}</option><option v-for="profile in state.profileOptions" :key="`prev-${profile.indexId}`" :value="profile.remarks">{{ profile.remarks }} · {{ profile.configType }}</option></select></label>
            <label>{{ t('subscriptions.nextProfile') }}<select v-model="state.subscriptionForm.nextProfile"><option value="">{{ t('common.none') }}</option><option v-if="state.subscriptionForm.nextProfile && !state.profileOptions.some((profile: Record<string, any>) => profile.remarks === state.subscriptionForm.nextProfile)" :value="state.subscriptionForm.nextProfile">{{ state.subscriptionForm.nextProfile }} · {{ t('subscriptions.profileNotListed') }}</option><option v-for="profile in state.profileOptions" :key="`next-${profile.indexId}`" :value="profile.remarks">{{ profile.remarks }} · {{ profile.configType }}</option></select></label>
            <label>{{ t('subscriptions.customCoreType') }}<select v-model="state.subscriptionForm.customCoreType"><option :value="null">{{ t('common.none') }}</option><option v-for="core in state.coreTypes" :key="core" :value="core">{{ core === 'sing_box' ? 'sing-box' : core }}</option></select></label>
            <label>{{ t('subscriptions.preSocksPort') }}<input v-model.number="state.subscriptionForm.preSocksPort" type="number" min="0" max="65535" /></label>
          </div>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.memo') }}</legend><label>{{ t('subscriptions.memo') }}<textarea v-model="state.subscriptionForm.memo" /></label></fieldset>
      </div>
      <footer class="modal-actions"><button class="button" type="button" @click="state.showSubscriptionForm = false">{{ t('common.cancel') }}</button><button class="button primary" type="submit">{{ t('common.save') }}</button></footer>
    </form>
  </div>
</template>
