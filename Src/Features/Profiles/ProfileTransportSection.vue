<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiCheckbox from '../../Components/UiCheckbox.vue'
import type { UiState } from '../../Components/types'
import { optionValues } from './editorOptionValues'
const { t } = useI18n()
const props = defineProps<{ state: UiState }>()
const state = props.state
const transportOptions = computed(() => state.editorOptions || {})
const showRawHttpFields = computed(() => state.profileForm.network === 'raw' && state.profileForm.transportExtra.rawHeaderType === 'http')

// The provider is a desktop-editor convenience and is not persisted. Derive it
// from the S3 values like AddServerViewModel and apply the same defaults.
const xdriveProvider = ref('')

function deriveXdriveProvider(): string {
  const extra = state.profileForm.transportExtra || {}
  const service = String(extra.xdriveService || '')
  const endpoint = String(extra.xdriveS3Endpoint || '')
  if (service === 'google-drive') return 'Google Drive'
  if (endpoint.includes('r2.cloudflarestorage.com')) return 'Cloudflare R2'
  if (endpoint.includes('amazonaws.com')) return 'AWS S3 (Global)'
  if (endpoint.includes('yandexcloud.net')) return 'Yandex Cloud S3'
  if (endpoint.includes('arvanstorage.ir')) return 'ArvanCloud S3'
  if (String(state.profileForm.remarks || '').toLowerCase().includes('cloudflare')
    || (extra.xdriveS3PathStyle === true && extra.xdriveS3Region === 'auto')) return 'Cloudflare R2'
  if (service === 's3' || endpoint) return 'Custom S3'
  return 'Cloudflare R2'
}

function applyXdriveProviderPreset(provider: string) {
  const form = state.profileForm
  const extra = form.transportExtra || (form.transportExtra = {})
  switch (provider) {
    case 'Cloudflare R2':
      extra.xdriveService = 's3'
      if (!extra.xdriveS3Region) extra.xdriveS3Region = 'auto'
      extra.xdriveS3PathStyle = true
      break
    case 'Google Drive':
      extra.xdriveService = 'google-drive'
      form.streamSecurity = 'tls'
      if (!form.sni) form.sni = 'www.google.com'
      if (!form.alpn) form.alpn = 'h2'
      if (!form.address) form.address = 'www.google.com'
      if (Number(form.port || 0) <= 0) form.port = 443
      break
    case 'AWS S3 (Global)':
      extra.xdriveService = 's3'
      if (!extra.xdriveS3Region) extra.xdriveS3Region = 'ap-northeast-1'
      extra.xdriveS3PathStyle = false
      break
    case 'Yandex Cloud S3':
      extra.xdriveService = 's3'
      if (!extra.xdriveS3Region) extra.xdriveS3Region = 'ru-central1'
      extra.xdriveS3PathStyle = true
      break
    case 'ArvanCloud S3':
      extra.xdriveService = 's3'
      if (!extra.xdriveS3Region) extra.xdriveS3Region = 'ir-tbz-sh1'
      extra.xdriveS3PathStyle = true
      break
    case 'Custom S3':
      extra.xdriveService = 's3'
      break
  }
}

function selectXdriveProvider(value: string) {
  xdriveProvider.value = String(value ?? '')
  applyXdriveProviderPreset(xdriveProvider.value)
}

function selectXdriveService(value: string) {
  state.profileForm.transportExtra.xdriveService = String(value ?? '')
  xdriveProvider.value = deriveXdriveProvider()
}

watch(() => [state.showProfileForm, state.profileForm.network] as const, ([isOpen, network]) => {
  if (!isOpen || network !== 'xdrive') {
    xdriveProvider.value = ''
    return
  }
  const extra = state.profileForm.transportExtra || (state.profileForm.transportExtra = {})
  if (!extra.xdriveService && !extra.xdriveS3Endpoint) {
    xdriveProvider.value = 'Cloudflare R2'
    applyXdriveProviderPreset(xdriveProvider.value)
  } else {
    if (!extra.xdriveService) extra.xdriveService = 's3'
    xdriveProvider.value = deriveXdriveProvider()
  }
}, { immediate: true })
</script>

<template>
  <fieldset class="editor-section">
    <legend>{{ t('nodes.transport') }}</legend>
    <div class="form-grid three-col">
      <template v-if="state.profileForm.network === 'raw'">
        <label>{{ t('nodes.rawHeaderType') }}<select v-model="state.profileForm.transportExtra.rawHeaderType"><option v-for="type in optionValues(transportOptions.rawHeaderTypes, state.profileForm.transportExtra.rawHeaderType)" :key="type" :value="type">{{ type }}</option></select></label>
        <template v-if="showRawHttpFields">
          <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
          <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
        </template>
      </template>
      <template v-if="state.profileForm.network === 'ws' || state.profileForm.network === 'httpupgrade'">
        <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
        <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
      </template>
      <template v-if="state.profileForm.network === 'grpc'">
        <label>{{ t('nodes.grpcMode') }}<select v-model="state.profileForm.transportExtra.grpcMode"><option v-for="mode in optionValues(transportOptions.grpcModes, state.profileForm.transportExtra.grpcMode)" :key="mode" :value="mode">{{ mode }}</option></select></label>
        <label>{{ t('nodes.grpcAuthority') }}<input v-model="state.profileForm.transportExtra.grpcAuthority" /></label>
        <label>{{ t('nodes.grpcServiceName') }}<input v-model="state.profileForm.transportExtra.grpcServiceName" /></label>
      </template>
      <template v-if="state.profileForm.network === 'xhttp'">
        <label>{{ t('nodes.xhttpMode') }}<select v-model="state.profileForm.transportExtra.xhttpMode"><option v-for="mode in optionValues(transportOptions.xhttpModes, state.profileForm.transportExtra.xhttpMode)" :key="mode" :value="mode">{{ mode }}</option></select></label>
        <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
        <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
        <label class="wide-field">{{ t('nodes.xhttpExtra') }}<textarea v-model="state.profileForm.transportExtra.xhttpExtra" /></label>
      </template>
      <template v-if="state.profileForm.network === 'kcp'">
        <label>{{ t('nodes.kcpHeaderType') }}<select v-model="state.profileForm.transportExtra.kcpHeaderType"><option v-for="type in optionValues(transportOptions.kcpHeaderTypes, state.profileForm.transportExtra.kcpHeaderType)" :key="type" :value="type">{{ type }}</option></select></label>
        <label>{{ t('nodes.kcpSeed') }}<input v-model="state.profileForm.transportExtra.kcpSeed" /></label>
        <label>{{ t('nodes.kcpMtu') }}<input v-model.number="state.profileForm.transportExtra.kcpMtu" type="number" min="0" /></label>
      </template>
      <template v-if="state.profileForm.network === 'xdrive'">
        <label>{{ t('nodes.xdriveProvider') }}<select v-model="xdriveProvider" @change="selectXdriveProvider(($event.target as HTMLSelectElement).value)"><option v-for="provider in optionValues(transportOptions.xdriveProviders, xdriveProvider)" :key="provider" :value="provider">{{ provider }}</option></select></label>
        <label>{{ t('nodes.xdriveService') }}<select :value="state.profileForm.transportExtra.xdriveService || transportOptions.xdriveServices?.[0] || ''" @change="selectXdriveService(($event.target as HTMLSelectElement).value)"><option v-for="service in optionValues(transportOptions.xdriveServices, state.profileForm.transportExtra.xdriveService)" :key="service" :value="service">{{ service }}</option></select></label>
        <label>{{ t('nodes.xdriveRemoteFolder') }}<input v-model="state.profileForm.transportExtra.xdriveRemoteFolder" /></label>
        <label>{{ t('nodes.xdriveSecrets') }}<input v-model="state.profileForm.transportExtra.xdriveSecrets" placeholder="AK,SK / OAuth" /></label>
        <label>{{ t('nodes.xdriveS3Endpoint') }}<input v-model="state.profileForm.transportExtra.xdriveS3Endpoint" /></label>
        <label>{{ t('nodes.xdriveS3Bucket') }}<input v-model="state.profileForm.transportExtra.xdriveS3Bucket" /></label>
        <label>{{ t('nodes.xdriveS3Region') }}<input v-model="state.profileForm.transportExtra.xdriveS3Region" placeholder="auto" /></label>
        <label class="check-inline"><UiCheckbox v-model="state.profileForm.transportExtra.xdriveS3PathStyle" />{{ t('nodes.xdriveS3PathStyle') }}</label>
        <label class="wide-field">{{ t('nodes.xdriveExtra') }}<textarea v-model="state.profileForm.transportExtra.xdriveExtra" class="code-area" spellcheck="false" placeholder="{ }" /><small class="field-hint">{{ t('nodes.xdriveExtraTip') }}</small></label>
      </template>
    </div>
  </fieldset>
</template>
