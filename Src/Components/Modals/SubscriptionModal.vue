<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiDialog from '../UI/UiDialog.vue'
import UiButton from '../UI/UiButton.vue'
import UiIconButton from '../UI/UiIconButton.vue'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const showProfilePicker = ref(false)
const profilePickerTarget = ref<'prevProfile' | 'nextProfile'>('prevProfile')
const profilePickerFilter = ref('')
const selectableProfiles = computed(() => (state.profileOptions || []).filter((profile: Record<string, any>) => String(profile.protocol).toLowerCase() !== 'custom'))
const filteredSelectableProfiles = computed(() => {
  const filter = profilePickerFilter.value.trim().toLowerCase()
  return selectableProfiles.value.filter((profile: Record<string, any>) => !filter
    || String(profile.remarks || '').toLowerCase().includes(filter)
    || String(profile.address || '').toLowerCase().includes(filter))
})

function openProfilePicker(target: 'prevProfile' | 'nextProfile') {
  profilePickerTarget.value = target
  profilePickerFilter.value = ''
  showProfilePicker.value = true
}

function chooseProfile(profile: Record<string, any>) {
  state.subscriptionForm[profilePickerTarget.value] = profile.remarks
  showProfilePicker.value = false
}
</script>

<template>
  <UiDialog v-if="state.showSubscriptionForm" wide :label="t(state.editingSubscriptionId ? 'subscriptions.editSubscription' : 'subscriptions.addSubscription')" @close="state.showSubscriptionForm = false" @submit.prevent="actions.saveSubscription">
    <template #header><header class="modal-head"><h2>{{ t(state.editingSubscriptionId ? 'subscriptions.editSubscription' : 'subscriptions.addSubscription') }}</h2><UiIconButton type="button" :aria-label="t('common.close')" @click="state.showSubscriptionForm = false"><UiIcon name="close" /></UiIconButton></header></template>
        <fieldset class="editor-section"><legend>{{ t('subscriptions.source') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.name') }}<input v-model="state.subscriptionForm.remarks" required /></label>
            <label>{{ t('subscriptions.url') }}<input v-model="state.subscriptionForm.url" inputmode="url" /></label>
            <label class="check-inline"><UiCheckbox v-model="state.subscriptionForm.enabled" />{{ t('subscriptions.enabled') }}</label>
            <label>{{ t('subscriptions.interval') }}<input v-model.number="state.subscriptionForm.autoUpdateInterval" type="number" min="0" /></label>
          </div>
          <details class="secondary-fields"><summary>{{ t('subscriptions.moreUrl') }}</summary><textarea v-model="state.subscriptionForm.moreUrl" :aria-label="t('subscriptions.moreUrl')" /></details>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.filter') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.filter') }}<input v-model="state.subscriptionForm.filter" /></label>
            <label>{{ t('subscriptions.convertTarget') }}<select v-model="state.subscriptionForm.convertTarget"><option v-for="target in state.convertTargets" :key="target || 'none'" :value="target">{{ target || t('common.none') }}</option><option v-if="state.subscriptionForm.convertTarget && !state.convertTargets.includes(state.subscriptionForm.convertTarget)" :value="state.subscriptionForm.convertTarget">{{ state.subscriptionForm.convertTarget }}</option></select></label>
          </div>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.requestOptions') }}</legend>
          <div class="form-grid two-col">
            <label>{{ t('subscriptions.userAgent') }}<input v-model="state.subscriptionForm.userAgent" /></label>
            <label class="wide-field">{{ t('subscriptions.requestHeaders') }}<textarea v-model="state.subscriptionForm.requestHeaders" class="code-area" spellcheck="false" /><small class="field-hint">{{ t('subscriptions.requestHeadersTip') }}</small></label>
            <label>{{ t('subscriptions.sort') }}<input v-model.number="state.subscriptionForm.sort" type="number" /></label>
          </div>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.proxyChain') }}</legend>
          <div class="form-grid two-col">
            <div class="profile-alias-field"><label>{{ t('subscriptions.prevProfile') }}<div class="profile-alias-input"><input v-model="state.subscriptionForm.prevProfile" /><button class="button compact" type="button" @click="openProfilePicker('prevProfile')">{{ t('subscriptions.chooseProfile') }}</button></div></label></div>
            <div class="profile-alias-field"><label>{{ t('subscriptions.nextProfile') }}<div class="profile-alias-input"><input v-model="state.subscriptionForm.nextProfile" /><button class="button compact" type="button" @click="openProfilePicker('nextProfile')">{{ t('subscriptions.chooseProfile') }}</button></div></label></div>
            <label>{{ t('subscriptions.customCoreType') }}<select v-model="state.subscriptionForm.customCoreType"><option :value="null">{{ t('common.none') }}</option><option v-if="state.subscriptionForm.customCoreType && !state.coreTypes.includes(state.subscriptionForm.customCoreType)" :value="state.subscriptionForm.customCoreType">{{ state.subscriptionForm.customCoreType }}</option><option v-for="core in state.coreTypes" :key="core" :value="core">{{ core === 'sing_box' ? 'sing-box' : core }}</option></select></label>
            <label>{{ t('subscriptions.preSocksPort') }}<input v-model.number="state.subscriptionForm.preSocksPort" type="number" min="0" max="65535" /></label>
          </div>
        </fieldset>

        <fieldset class="editor-section"><legend>{{ t('subscriptions.memo') }}</legend><label>{{ t('subscriptions.memo') }}<textarea v-model="state.subscriptionForm.memo" /></label></fieldset>
    <template #actions><footer class="modal-actions"><UiButton type="button" @click="state.showSubscriptionForm = false">{{ t('common.cancel') }}</UiButton><UiButton class="primary" type="submit">{{ t('common.save') }}</UiButton></footer></template>
  </UiDialog>
  <div v-if="showProfilePicker" class="profile-picker-shade" @click.self="showProfilePicker = false" @keydown.esc.stop.prevent="showProfilePicker = false">
    <section class="profile-picker-panel" role="dialog" aria-modal="true" :aria-label="t('subscriptions.chooseProfile')">
      <header class="modal-head"><h2>{{ t('subscriptions.chooseProfile') }}</h2><button class="tool-button" type="button" :aria-label="t('common.close')" @click="showProfilePicker = false"><UiIcon name="close" /></button></header>
      <label class="profile-picker-search">{{ t('common.search') }}<input v-model="profilePickerFilter" autofocus /></label>
      <div class="profile-picker-list">
        <button v-for="profile in filteredSelectableProfiles" :key="profile.indexId" class="profile-picker-choice" type="button" @click="chooseProfile(profile)">
          <strong>{{ profile.remarks }}</strong><small>{{ profile.protocol }} · {{ profile.address }}:{{ profile.port }}</small>
        </button>
        <p v-if="!filteredSelectableProfiles.length" class="muted empty-inline">{{ t('common.noResults') }}</p>
      </div>
      <footer class="modal-actions"><button class="button" type="button" @click="showProfilePicker = false">{{ t('common.cancel') }}</button></footer>
    </section>
  </div>
</template>
