<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../../Components/types'
import BackendAddressFields from '../../Components/BackendAddressFields.vue'
import UiButton from '../../Components/UI/UiButton.vue'
const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const brandLogoSrc = './v2rayN.png'
</script>

<template>
  <section v-if="!state.setupStatusReady" class="auth-wrap"><p class="loading-state" role="status">{{ t('common.loading') }}</p></section>
  <section v-else-if="state.setupRequired && !state.setupAllowedFromRequest" class="auth-wrap">
    <div class="auth-box setup-box">
      <div class="auth-title"><img class="brand-glyph" :src="brandLogoSrc" alt="" /><div><strong>{{ t('setup.title') }}</strong><small>{{ t('brand') }}</small></div></div>
      <p>{{ t('setup.localOnly') }}</p>
      <BackendAddressFields v-model="state.backendDraft" :testing="state.connectionTesting" :error="state.backendError" :history="state.backendHistory" @apply="actions.applyBackend" @test="actions.testConnection" @forget="actions.forgetBackendAddress" />
    </div>
  </section>
  <section v-else-if="state.setupRequired" class="auth-wrap">
    <form class="auth-box setup-box" @submit.prevent="actions.configureManagementKey">
      <div class="auth-title"><img class="brand-glyph" :src="brandLogoSrc" alt="" /><div><strong>{{ t('setup.title') }}</strong><small>{{ t('brand') }}</small></div></div>
      <p>{{ t('setup.description') }}</p>
      <BackendAddressFields v-model="state.backendDraft" :testing="state.connectionTesting" :error="state.backendError" :history="state.backendHistory" @apply="actions.applyBackend" @test="actions.testConnection" @forget="actions.forgetBackendAddress" />
      <div class="form-grid">
        <label>{{ t('setup.managementKey') }}<input v-model="state.setupKey" type="password" autocomplete="new-password" minlength="12" maxlength="4096" required /></label>
        <label>{{ t('setup.confirmKey') }}<input v-model="state.setupConfirmKey" type="password" autocomplete="new-password" minlength="12" maxlength="4096" required /></label>
      </div>
      <p v-if="state.setupError" class="setup-error" role="alert">{{ state.setupError }}</p>
      <UiButton class="primary" type="submit" :disabled="state.setupSubmitting">{{ state.setupSubmitting ? t('common.working') : t('setup.submit') }}</UiButton>
    </form>
  </section>
  <section v-else class="auth-wrap">
    <div class="auth-content">
      <form class="auth-box" @submit.prevent="actions.loginToBackend">
        <div class="auth-title"><img class="brand-glyph" :src="brandLogoSrc" alt="" /><div><strong>{{ t('auth.title') }}</strong><small>{{ t('brand') }}</small></div></div>
        <p>{{ t('auth.hint') }}</p>
        <BackendAddressFields v-model="state.backendDraft" :testing="state.connectionTesting" :error="state.backendError" :history="state.backendHistory" @apply="actions.applyBackend" @test="actions.testConnection" @forget="actions.forgetBackendAddress" />
        <label class="field-label" for="management-key">{{ t('auth.token') }}</label>
        <div class="inline-field"><input id="management-key" v-model="state.managementKeyDraft" type="password" autocomplete="current-password" :placeholder="t('auth.placeholder')" /><UiButton class="primary" type="submit">{{ t('auth.connect') }}</UiButton></div>
      </form>
    </div>
  </section>
</template>
