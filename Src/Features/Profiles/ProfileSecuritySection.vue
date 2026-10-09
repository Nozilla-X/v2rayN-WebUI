<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiCheckbox from '../../Components/UiCheckbox.vue'
import type { UiState } from '../../Components/types'
import { optionValues } from './editorOptionValues'
const { t } = useI18n()
const props = defineProps<{ state: UiState; streamSecurityOptions: string[] }>()
const state = props.state
const protocol = computed(() => state.profileForm.configType)
const isTls = computed(() => ['tls', 'reality'].includes(String(state.profileForm.streamSecurity).toLowerCase()))
const isReality = computed(() => String(state.profileForm.streamSecurity).toLowerCase() === 'reality')
const fingerprintDisabled = computed(() => ['Hysteria2', 'TUIC', 'Naive'].includes(protocol.value))
const alpnDisabled = computed(() => ['Hysteria2', 'Naive'].includes(protocol.value))
const transportOptions = computed(() => state.editorOptions || {})
</script>

<template>
  <fieldset class="editor-section">
    <legend>{{ t('nodes.tlsReality') }}</legend>
    <div class="form-grid three-col">
      <label>{{ t('nodes.streamSecurity') }}<select v-model="state.profileForm.streamSecurity"><option v-for="security in streamSecurityOptions" :key="security || 'none'" :value="security">{{ security === 'tls' ? 'TLS' : security === 'reality' ? 'Reality' : t('common.none') }}</option></select></label>
      <template v-if="isTls">
        <label>{{ t('nodes.sni') }}<input v-model="state.profileForm.sni" /></label>
        <label>{{ t('nodes.alpn') }}<select v-model="state.profileForm.alpn" :disabled="alpnDisabled"><option v-for="alpn in optionValues(transportOptions.alpns, state.profileForm.alpn)" :key="alpn || 'none'" :value="alpn">{{ alpn || t('common.none') }}</option></select></label>
        <label>{{ t('nodes.fingerprint') }}<select v-model="state.profileForm.fingerprint" :disabled="fingerprintDisabled"><option v-for="fingerprint in optionValues(transportOptions.fingerprints, state.profileForm.fingerprint)" :key="fingerprint || 'none'" :value="fingerprint">{{ fingerprint || t('common.none') }}</option></select></label>
        <label class="check-inline"><UiCheckbox v-model="state.profileForm.allowInsecure" :disabled="protocol === 'Naive'" />{{ t('nodes.allowInsecure') }}</label>
      </template>
      <template v-if="isReality">
        <label>{{ t('nodes.publicKey') }}<input v-model="state.profileForm.publicKey" /></label>
        <label>{{ t('nodes.shortId') }}<input v-model="state.profileForm.shortId" /></label>
        <label>{{ t('nodes.spiderX') }}<input v-model="state.profileForm.spiderX" /></label>
        <label>{{ t('nodes.mldsa65Verify') }}<input v-model="state.profileForm.mldsa65Verify" /></label>
      </template>
      <template v-if="state.profileForm.streamSecurity === 'tls'">
        <label>{{ t('nodes.cert') }}<textarea v-model="state.profileForm.cert" /></label>
        <label>{{ t('nodes.certSha') }}<input v-model="state.profileForm.certSha" /></label>
        <label>{{ t('nodes.echConfigList') }}<textarea v-model="state.profileForm.echConfigList" /></label>
        <label>{{ t('nodes.verifyPeerCertByName') }}<input v-model="state.profileForm.verifyPeerCertByName" /></label>
        <label>{{ t('nodes.finalmask') }}<input v-model="state.profileForm.finalmask" /></label>
      </template>
    </div>
  </fieldset>
</template>
