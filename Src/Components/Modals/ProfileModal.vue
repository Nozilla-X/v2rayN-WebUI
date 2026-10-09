<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiDialog from '../UI/UiDialog.vue'
import UiButton from '../UI/UiButton.vue'
import UiIconButton from '../UI/UiIconButton.vue'
import ProfileGroupSection from '../../Features/Profiles/ProfileGroupSection.vue'
import ProfileTransportSection from '../../Features/Profiles/ProfileTransportSection.vue'
import ProfileSecuritySection from '../../Features/Profiles/ProfileSecuritySection.vue'
import { optionValues } from '../../Features/Profiles/editorOptionValues'
import { shadowsocksSecurityOptions } from '../../profileEditorOptions'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'

const { t } = useI18n()
const props = defineProps<UiProps & { coreTypeMappings: Record<string, any>[] }>()
const state = props.state
const actions = props.actions
const protocol = computed(() => state.profileForm.configType)
const isGroup = computed(() => ['PolicyGroup', 'ProxyChain'].includes(protocol.value))
const isCustomConfig = computed(() => ['Custom', 'Outbound'].includes(protocol.value))
const groupConfigTypes = ['PolicyGroup', 'ProxyChain']
const singboxOnlyConfigTypes = computed(() => state.editorOptions.singboxOnlyConfigTypes || [])
const realityConfigTypes = ['VLESS', 'Trojan', 'Anytls']
const transportlessConfigTypes = ['Custom', 'Outbound', 'Hysteria2', 'TUIC', 'WireGuard', 'Anytls', 'Naive', ...groupConfigTypes]
const groupProtocolExtraFields = ['groupType', 'childItems', 'subChildItems', 'filter', 'multipleLoad']
const protocolExtraOwners: Record<string, string[]> = {
  alterId: ['VMess'], vmessSecurity: ['VMess'], flow: ['VLESS', 'Trojan'], vlessEncryption: ['VLESS'],
  ssMethod: ['Shadowsocks'], uot: ['Shadowsocks', 'Naive'], httpHeaders: ['HTTP'],
  wgPublicKey: ['WireGuard'], wgPresharedKey: ['WireGuard'], wgInterfaceAddress: ['WireGuard'],
  wgReserved: ['WireGuard'], wgMtu: ['WireGuard'], wgDns: ['WireGuard'],
  isSingboxEndpoint: ['Outbound'],
  salamanderPass: ['Hysteria2'], upMbps: ['Hysteria2'], downMbps: ['Hysteria2'], ports: ['Hysteria2'],
  hopInterval: ['Hysteria2'], hy2RealmUrl: ['Hysteria2'], geckoMinPacketSize: ['Hysteria2'], geckoMaxPacketSize: ['Hysteria2'],
  congestionControl: ['TUIC', 'Naive'], insecureConcurrency: ['Anytls', 'Naive'], naiveQuic: ['Naive'],
}
const transportExtraFields = ['rawHeaderType', 'host', 'path', 'xhttpMode', 'xhttpExtra', 'grpcAuthority', 'grpcServiceName', 'grpcMode', 'kcpHeaderType', 'kcpSeed', 'kcpMtu']
const realityFields = ['publicKey', 'shortId', 'spiderX', 'mldsa65Verify']
const wireGuardIncompatibleFields = ['streamSecurity', 'sni', 'alpn', 'fingerprint', ...realityFields, 'allowInsecure', 'cert', 'certSha', 'echConfigList', 'verifyPeerCertByName', 'finalmask']

function parseObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value }
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

function removeKeys(target: Record<string, any>, keys: readonly string[]) {
  for (const key of keys) delete target[key]
}

function canonicalizeProtocolChange(configType: string) {
  const form = state.profileForm
  let advanced: Record<string, any>
  try { advanced = parseObject(JSON.parse(state.profileAdvancedJson || '{}')) } catch { return }
  const protocolExtra = form.protoExtra || (form.protoExtra = {})
  const advancedProtocolExtra = parseObject(advanced.protoExtra)
  if (!groupConfigTypes.includes(configType)) {
    removeKeys(protocolExtra, groupProtocolExtraFields)
    removeKeys(advancedProtocolExtra, groupProtocolExtraFields)
  } else if (configType !== 'PolicyGroup') {
    delete protocolExtra.multipleLoad
    delete advancedProtocolExtra.multipleLoad
  }

  if (!realityConfigTypes.includes(configType) && String(form.streamSecurity).toLowerCase() === 'reality') {
    form.streamSecurity = ''
  }
  if (configType === 'WireGuard') {
    if (protocolExtra.wgMtu == null) protocolExtra.wgMtu = state.editorOptions.defaultWireGuardMtu
    for (const field of wireGuardIncompatibleFields) form[field] = ''
    form.allowInsecure = false
    form.network = state.editorOptions.defaultNetwork
  }
  if (['Hysteria2', 'Naive'].includes(configType)) {
    form.alpn = ''
    form.fingerprint = ''
  } else if (configType === 'TUIC') {
    form.fingerprint = ''
  }
  if (!realityConfigTypes.includes(configType) || String(form.streamSecurity).toLowerCase() !== 'reality') {
    for (const field of realityFields) form[field] = ''
  }
  if (!['VMess', 'VLESS', 'Shadowsocks', 'Trojan'].includes(configType)) form.muxEnabled = null

  for (const [field, owners] of Object.entries(protocolExtraOwners)) {
    const allowed = owners.includes(configType)
      && !(field === 'congestionControl' && configType === 'Naive' && protocolExtra.naiveQuic !== true)
    if (!allowed) {
      delete protocolExtra[field]
      delete advancedProtocolExtra[field]
    }
  }
  if (configType === 'VMess' && !protocolExtra.vmessSecurity) protocolExtra.vmessSecurity = state.editorOptions.defaultSecurity
  if (configType === 'VLESS' && !protocolExtra.vlessEncryption) protocolExtra.vlessEncryption = state.editorOptions.defaultVlessEncryption

  if (transportlessConfigTypes.includes(configType)) {
    form.network = state.editorOptions.defaultNetwork
    removeKeys(form.transportExtra || {}, transportExtraFields)
    advanced.network = state.editorOptions.defaultNetwork
    const advancedTransportExtra = parseObject(advanced.transportExtra)
    removeKeys(advancedTransportExtra, transportExtraFields)
    advanced.transportExtra = typeof advanced.transportExtra === 'string' ? JSON.stringify(advancedTransportExtra) : advancedTransportExtra
    removeKeys(advanced, ['headerType', 'requestHost', 'path', 'extra'])
  }

  if (configType === 'WireGuard') {
    for (const field of wireGuardIncompatibleFields) advanced[field] = ''
  }
  if (['Hysteria2', 'Naive'].includes(configType)) {
    advanced.alpn = ''
    advanced.fingerprint = ''
  } else if (configType === 'TUIC') {
    advanced.fingerprint = ''
  }
  if (!realityConfigTypes.includes(configType) || String(form.streamSecurity).toLowerCase() !== 'reality') {
    for (const field of realityFields) advanced[field] = ''
  }

  advanced.configType = configType
  advanced.protoExtra = typeof advanced.protoExtra === 'string' ? JSON.stringify(advancedProtocolExtra) : advancedProtocolExtra
  form.protoExtra = protocolExtra
  state.profileAdvancedJson = JSON.stringify(advanced, null, 2)
}

watch(() => [state.showProfileForm, protocol.value] as const, ([isOpen, configType], previous) => {
  if (!isOpen) return
  if (singboxOnlyConfigTypes.value.includes(configType)) state.profileForm.coreType = 'sing_box'
  if (['Custom', 'Outbound'].includes(configType) && !state.profileForm.coreType) state.profileForm.coreType = state.editorOptions.coreTypes?.[0] || ''
  if (previous?.[0] && configType !== previous[1]) canonicalizeProtocolChange(configType)
}, { immediate: true })
const supportsTransport = computed(() => !isCustomConfig.value && !['Hysteria2', 'TUIC', 'WireGuard', 'Anytls', 'Naive'].includes(protocol.value))
const streamSecurityOptions = computed(() => optionValues((state.editorOptions.streamSecurityTypes || [])
  .filter((security: string) => security !== 'reality' || ['VLESS', 'Trojan', 'Anytls'].includes(protocol.value)), state.profileForm.streamSecurity))
const shadowsocksMappedCore = computed(() => props.coreTypeMappings.find((mapping) => String(mapping.configType).toLowerCase() === 'shadowsocks')?.coreType || state.editorOptions.coreTypes?.[0] || '')
const shadowsocksMethods = computed(() => shadowsocksSecurityOptions(state.profileForm.coreType, shadowsocksMappedCore.value, state.editorOptions.shadowsocksSecurities || {}))
const transportOptions = computed(() => state.editorOptions || {})
</script>

<template>
  <UiDialog v-if="state.showProfileForm" wide :label="t(state.editingProfileId ? 'nodes.editNode' : 'nodes.addNode')" @close="state.showProfileForm = false" @submit.prevent="actions.saveProfile">
    <template #header>
      <header class="modal-head">
        <div><h2>{{ t(state.editingProfileId ? 'nodes.editNode' : 'nodes.addNode') }}</h2><small>{{ t('nodes.protocolEditorHint') }}</small></div>
        <UiIconButton type="button" :aria-label="t('common.close')" @click="state.showProfileForm = false"><UiIcon name="close" /></UiIconButton>
      </header>

    </template>
        <fieldset class="editor-section">
          <legend>{{ t('nodes.profileBase') }}</legend>
          <div class="form-grid three-col">
            <label>{{ t('nodes.type') }}<select v-model="state.profileForm.configType" :disabled="!!state.editingProfileId"><option v-for="kind in state.protocolTypes" :key="kind" :value="kind">{{ kind === 'Anytls' ? 'AnyTLS' : kind }}</option></select></label>
              <label>{{ t('nodes.coreType') }}<select v-model="state.profileForm.coreType" :disabled="singboxOnlyConfigTypes.includes(protocol)"><option value="">{{ t('common.none') }}</option><option v-if="state.profileForm.coreType && !state.coreTypes.includes(state.profileForm.coreType)" :value="state.profileForm.coreType">{{ state.profileForm.coreType }}</option><option v-for="core in state.coreTypes" :key="core" :value="core">{{ core === 'sing_box' ? 'sing-box' : core }}</option></select></label>
            <label>{{ t('nodes.remarks') }}<input v-model="state.profileForm.remarks" required /></label>
            <template v-if="!isGroup">
              <label>{{ t(isCustomConfig ? 'nodes.customConfigPath' : 'nodes.address') }}<input v-model="state.profileForm.address" required autocomplete="off" :placeholder="isCustomConfig ? t('nodes.customConfigPathHint') : undefined" /></label>
              <label v-if="!isCustomConfig">{{ t('nodes.port') }}<input v-model.number="state.profileForm.port" type="number" min="1" max="65535" required /></label>
              <label v-if="supportsTransport">{{ t('nodes.network') }}<select v-model="state.profileForm.network"><option v-for="network in state.editorOptions.networks" :key="network" :value="network">{{ network }}</option></select></label>
            </template>
          </div>
        </fieldset>

        <ProfileGroupSection v-if="isGroup" :state="state" :actions="actions" />

        <template v-else>
          <fieldset v-if="isCustomConfig" class="editor-section">
            <legend>{{ t('nodes.customConfiguration') }}</legend>
            <div class="form-grid two-col">
              <label v-if="protocol === 'Custom'" class="check-inline"><UiCheckbox v-model="state.profileForm.displayLog" />{{ t('nodes.displayLog') }}</label>
              <label v-if="protocol === 'Custom'">{{ t('nodes.preSocksPort') }}<input v-model.number="state.profileForm.preSocksPort" type="number" min="0" max="65535" /></label>
              <label v-if="protocol === 'Outbound'" class="check-inline"><UiCheckbox v-model="state.profileForm.protoExtra.isSingboxEndpoint" />{{ t('nodes.singboxEndpoint') }}</label>
            </div>
          </fieldset>

          <template v-if="!isCustomConfig">
          <fieldset class="editor-section">
            <legend>{{ t('nodes.authentication') }}</legend>
            <div class="form-grid three-col">
              <label v-if="!['HTTP', 'SOCKS', 'Naive', 'WireGuard'].includes(protocol)">{{ t(protocol === 'VMess' || protocol === 'VLESS' ? 'nodes.uuid' : 'nodes.password') }}<input v-model="state.profileForm.password" :required="['VMess', 'VLESS', 'Shadowsocks', 'Trojan', 'Hysteria2', 'TUIC', 'Anytls'].includes(protocol)" autocomplete="off" /></label>
              <label v-if="['HTTP', 'SOCKS', 'Naive'].includes(protocol)">{{ t('nodes.username') }}<input v-model="state.profileForm.username" autocomplete="off" /></label>
              <label v-if="protocol === 'TUIC'">{{ t('nodes.uuid') }}<input v-model="state.profileForm.username" required autocomplete="off" /></label>
              <label v-if="['HTTP', 'SOCKS', 'Naive'].includes(protocol)">{{ t('nodes.password') }}<input v-model="state.profileForm.password" :required="protocol === 'Naive'" autocomplete="off" /></label>
              <label v-if="protocol === 'VMess'">{{ t('nodes.alterId') }}<input v-model="state.profileForm.protoExtra.alterId" /></label>
              <label v-if="protocol === 'VMess'">{{ t('nodes.security') }}<select v-model="state.profileForm.protoExtra.vmessSecurity"><option v-for="security in optionValues(transportOptions.vmessSecurities, state.profileForm.protoExtra.vmessSecurity)" :key="security" :value="security">{{ security }}</option></select></label>
              <label v-if="['VLESS', 'Trojan'].includes(protocol)">{{ t('nodes.flow') }}<select v-model="state.profileForm.protoExtra.flow"><option v-for="flow in optionValues(transportOptions.flows, state.profileForm.protoExtra.flow)" :key="flow || 'none'" :value="flow">{{ flow || t('common.none') }}</option></select></label>
              <label v-if="protocol === 'VLESS'">{{ t('nodes.encryption') }}<input v-model="state.profileForm.protoExtra.vlessEncryption" /></label>
              <label v-if="protocol === 'Shadowsocks'">{{ t('nodes.method') }}<select v-model="state.profileForm.protoExtra.ssMethod" required><option v-for="method in optionValues(shadowsocksMethods, state.profileForm.protoExtra.ssMethod)" :key="method" :value="method">{{ method }}</option></select></label>
              <label v-if="['Shadowsocks', 'Naive'].includes(protocol)" class="check-inline"><UiCheckbox v-model="state.profileForm.protoExtra.uot" />{{ t('nodes.udpOverTcp') }}</label>
              <label v-if="protocol === 'TUIC'">{{ t('nodes.congestionControl') }}<select v-model="state.profileForm.protoExtra.congestionControl"><option v-for="control in optionValues(transportOptions.tuicCongestionControls, state.profileForm.protoExtra.congestionControl)" :key="control" :value="control">{{ control }}</option></select></label>
              <label v-if="protocol === 'Naive' && state.profileForm.protoExtra.naiveQuic">{{ t('nodes.congestionControl') }}<select v-model="state.profileForm.protoExtra.congestionControl"><option v-for="control in optionValues(transportOptions.naiveCongestionControls, state.profileForm.protoExtra.congestionControl)" :key="control" :value="control">{{ control }}</option></select></label>
              <template v-if="protocol === 'Hysteria2'">
                <label>{{ t('nodes.uploadBandwidth') }}<input v-model.number="state.profileForm.protoExtra.upMbps" type="number" min="0" /></label>
                <label>{{ t('nodes.downloadBandwidth') }}<input v-model.number="state.profileForm.protoExtra.downMbps" type="number" min="0" /></label>
                <label>{{ t('nodes.salamanderPassword') }}<input v-model="state.profileForm.protoExtra.salamanderPass" /></label>
                <label>{{ t('nodes.portHopping') }}<input v-model="state.profileForm.protoExtra.ports" /></label>
                <label>{{ t('nodes.hopInterval') }}<input v-model="state.profileForm.protoExtra.hopInterval" /></label>
                <label>{{ t('nodes.realmUrl') }}<input v-model="state.profileForm.protoExtra.hy2RealmUrl" /></label>
                <label>{{ t('nodes.geckoMinPacket') }}<input v-model="state.profileForm.protoExtra.geckoMinPacketSize" /></label>
                <label>{{ t('nodes.geckoMaxPacket') }}<input v-model="state.profileForm.protoExtra.geckoMaxPacketSize" /></label>
              </template>
              <template v-if="protocol === 'WireGuard'">
                <label>{{ t('nodes.wgPrivateKey') }}<input v-model="state.profileForm.password" required autocomplete="off" /></label>
                <label>{{ t('nodes.wgPublicKey') }}<input v-model="state.profileForm.protoExtra.wgPublicKey" /></label>
                <label>{{ t('nodes.wgPresharedKey') }}<input v-model="state.profileForm.protoExtra.wgPresharedKey" /></label>
                <label>{{ t('nodes.wgAddress') }}<input v-model="state.profileForm.protoExtra.wgInterfaceAddress" /></label>
                <label>{{ t('nodes.wgReserved') }}<input v-model="state.profileForm.protoExtra.wgReserved" /></label>
                <label>{{ t('nodes.wgMtu') }}<input v-model.number="state.profileForm.protoExtra.wgMtu" type="number" min="0" /></label>
                <label>{{ t('nodes.wgDns') }}<input v-model="state.profileForm.protoExtra.wgDns" /></label>
              </template>
              <label v-if="['Anytls', 'Naive'].includes(protocol)">{{ t('nodes.insecureConcurrency') }}<input v-model.number="state.profileForm.protoExtra.insecureConcurrency" type="number" min="0" /></label>
              <label v-if="protocol === 'Naive'" class="check-inline"><UiCheckbox v-model="state.profileForm.protoExtra.naiveQuic" />{{ t('nodes.naiveQuic') }}</label>
              <label v-if="protocol === 'HTTP'">{{ t('nodes.httpHeaders') }}<textarea v-model="state.profileForm.protoExtra.httpHeaders" /></label>
              <label v-if="['VMess', 'VLESS', 'Shadowsocks', 'Trojan'].includes(protocol)" class="check-inline"><UiCheckbox v-model="state.profileForm.muxEnabled" />{{ t('nodes.mux') }}</label>
            </div>
          </fieldset>

          <ProfileTransportSection v-if="supportsTransport" :state="state" />
          <ProfileSecuritySection v-if="protocol !== 'WireGuard'" :state="state" :stream-security-options="streamSecurityOptions" />
          </template>
        </template>

        <details class="advanced-editor">
          <summary>{{ t('nodes.advancedProfileFields') }}</summary>
          <p class="field-hint">{{ t('nodes.advancedProfileHint') }}</p>
          <textarea v-model="state.profileAdvancedJson" class="code-area advanced-profile-json" spellcheck="false" />
        </details>
        <p v-if="state.profileModalError" class="inline-error" role="alert">{{ state.profileModalError }}</p>
    <template #actions>
      <footer class="modal-actions">
        <UiButton type="button" @click="state.showProfileForm = false">{{ t('common.cancel') }}</UiButton>
        <UiButton class="primary" type="submit">{{ t('common.save') }}</UiButton>
      </footer>
    </template>
  </UiDialog>
</template>
