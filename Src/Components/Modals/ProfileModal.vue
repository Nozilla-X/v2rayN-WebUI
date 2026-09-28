<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '../../Composables/useModalFocus'
import { profileEditorOptions, shadowsocksSecurityOptions } from '../../profileEditorOptions'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'

const { t } = useI18n()
const props = defineProps<UiProps & { coreTypeMappings: Record<string, any>[] }>()
const state = props.state
const actions = props.actions
const dialog = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(dialog)
const protocol = computed(() => state.profileForm.configType)
const isGroup = computed(() => ['PolicyGroup', 'ProxyChain'].includes(protocol.value))
const groupConfigTypes = ['PolicyGroup', 'ProxyChain']
const singboxOnlyConfigTypes: readonly string[] = profileEditorOptions.singboxOnlyConfigTypes
const realityConfigTypes = ['VLESS', 'Trojan', 'Anytls']
const transportlessConfigTypes = ['Hysteria2', 'TUIC', 'WireGuard', 'Anytls', 'Naive', ...groupConfigTypes]
const groupProtocolExtraFields = ['groupType', 'childItems', 'subChildItems', 'filter', 'multipleLoad']
const protocolExtraOwners: Record<string, string[]> = {
  alterId: ['VMess'], vmessSecurity: ['VMess'], flow: ['VLESS', 'Trojan'], vlessEncryption: ['VLESS'],
  ssMethod: ['Shadowsocks'], uot: ['Shadowsocks', 'Naive'], httpHeaders: ['HTTP'],
  wgPublicKey: ['WireGuard'], wgPresharedKey: ['WireGuard'], wgInterfaceAddress: ['WireGuard'],
  wgReserved: ['WireGuard'], wgMtu: ['WireGuard'], wgDns: ['WireGuard'],
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
    for (const field of wireGuardIncompatibleFields) form[field] = ''
    form.allowInsecure = false
    form.network = profileEditorOptions.defaultNetwork
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

  if (transportlessConfigTypes.includes(configType)) {
    form.network = profileEditorOptions.defaultNetwork
    removeKeys(form.transportExtra || {}, transportExtraFields)
    advanced.network = profileEditorOptions.defaultNetwork
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
  if (singboxOnlyConfigTypes.includes(configType)) state.profileForm.coreType = 'sing_box'
  if (previous?.[0] && configType !== previous[1]) canonicalizeProtocolChange(configType)
}, { immediate: true })
const isTls = computed(() => ['tls', 'reality'].includes(String(state.profileForm.streamSecurity).toLowerCase()))
const isReality = computed(() => String(state.profileForm.streamSecurity).toLowerCase() === 'reality')
const supportsTransport = computed(() => !['Hysteria2', 'TUIC', 'WireGuard', 'Anytls', 'Naive'].includes(protocol.value))
const streamSecurityOptions = computed(() => ['', 'tls', ...(['VLESS', 'Trojan', 'Anytls'].includes(protocol.value) ? ['reality'] : [])])
const fingerprintDisabled = computed(() => ['Hysteria2', 'TUIC', 'Naive'].includes(protocol.value))
const alpnDisabled = computed(() => ['Hysteria2', 'Naive'].includes(protocol.value))
const shadowsocksMappedCore = computed(() => props.coreTypeMappings.find((mapping) => String(mapping.configType).toLowerCase() === 'shadowsocks')?.coreType || 'Xray')
const shadowsocksMethods = computed(() => shadowsocksSecurityOptions(state.profileForm.coreType, shadowsocksMappedCore.value))
const transportOptions = profileEditorOptions
const showRawHttpFields = computed(() => state.profileForm.network === 'raw' && state.profileForm.transportExtra.rawHeaderType === 'http')

watch([() => state.showProfileForm, protocol, shadowsocksMethods], ([isOpen, configType, methods]) => {
  if (!isOpen || configType !== 'Shadowsocks') return
  if (!methods.includes(String(state.profileForm.protoExtra.ssMethod ?? ''))) state.profileForm.protoExtra.ssMethod = methods[0] || ''
})
</script>

<template>
  <div v-if="state.showProfileForm" class="modal-shade" @click.self="state.showProfileForm = false">
    <form ref="dialog" class="modal-panel wide-modal modal-form" role="dialog" aria-modal="true" :aria-label="t(state.editingProfileId ? 'nodes.editNode' : 'nodes.addNode')" tabindex="-1" @keydown="onModalKeydown" @submit.prevent="actions.saveProfile">
      <header class="modal-head">
        <div><h2>{{ t(state.editingProfileId ? 'nodes.editNode' : 'nodes.addNode') }}</h2><small>{{ t('nodes.protocolEditorHint') }}</small></div>
        <button class="tool-button" type="button" :aria-label="t('common.close')" @click="state.showProfileForm = false"><UiIcon name="close" /></button>
      </header>

      <div class="modal-content">
        <fieldset class="editor-section">
          <legend>{{ t('nodes.profileBase') }}</legend>
          <div class="form-grid three-col">
            <label>{{ t('nodes.type') }}<select v-model="state.profileForm.configType" :disabled="!!state.editingProfileId"><option v-for="kind in state.protocolTypes" :key="kind" :value="kind">{{ kind === 'Anytls' ? 'AnyTLS' : kind }}</option><option value="PolicyGroup">PolicyGroup</option><option value="ProxyChain">ProxyChain</option></select></label>
            <label>{{ t('nodes.coreType') }}<select v-model="state.profileForm.coreType" :disabled="singboxOnlyConfigTypes.includes(protocol)"><option value="">{{ t('common.none') }}</option><option v-for="core in state.coreTypes" :key="core" :value="core">{{ core === 'sing_box' ? 'sing-box' : core }}</option></select></label>
            <label>{{ t('nodes.remarks') }}<input v-model="state.profileForm.remarks" required /></label>
            <template v-if="!isGroup">
              <label>{{ t('nodes.address') }}<input v-model="state.profileForm.address" required autocomplete="off" /></label>
              <label>{{ t('nodes.port') }}<input v-model.number="state.profileForm.port" type="number" min="1" max="65535" required /></label>
              <label v-if="supportsTransport">{{ t('nodes.network') }}<select v-model="state.profileForm.network"><option v-for="network in state.networks" :key="network" :value="network">{{ network }}</option></select></label>
            </template>
          </div>
        </fieldset>

        <fieldset v-if="isGroup" class="editor-section">
          <legend>{{ t(protocol === 'PolicyGroup' ? 'nodes.policyGroup' : 'nodes.proxyChain') }}</legend>
          <div class="form-grid two-col">
            <label v-if="protocol === 'PolicyGroup'">{{ t('nodes.groupStrategy') }}<select v-model="state.profileForm.protoExtra.multipleLoad"><option value="LeastPing">{{ t('nodes.strategyLeastPing') }}</option><option value="Fallback">{{ t('nodes.strategyFallback') }}</option><option value="Random">{{ t('nodes.strategyRandom') }}</option><option value="RoundRobin">{{ t('nodes.strategyRoundRobin') }}</option><option value="LeastLoad">{{ t('nodes.strategyLeastLoad') }}</option></select></label>
            <label>{{ t('nodes.groupSubscription') }}<select v-model="state.profileForm.protoExtra.subChildItems"><option value="">{{ t('common.none') }}</option><option v-for="group in state.groups" :key="group.id" :value="group.id">{{ group.name || t('common.allGroups') }}</option></select></label>
            <label>{{ t('nodes.groupFilter') }}<input v-model="state.profileForm.protoExtra.filter" /></label>
            <div class="wide-field group-member-editor"><strong>{{ t('nodes.groupMembers') }}</strong><small class="field-hint">{{ t('nodes.groupMembersHint') }}</small><div class="group-member-columns"><div class="group-profile-choices"><label v-for="item in state.profileCatalog" :key="item.indexId" class="group-profile-choice"><UiCheckbox :disabled="item.indexId === state.editingProfileId" :model-value="state.groupChildIds.includes(item.indexId)" @change="actions.toggleGroupChild(item.indexId)" /><span>{{ item.remarks }}<small>{{ item.configType }} · {{ item.address }}:{{ item.port }}</small></span></label></div><div class="group-member-order"><div v-for="(id, index) in state.groupChildIds" :key="id" class="group-member-row"><span>{{ state.profileCatalog.find((item: Record<string, any>) => item.indexId === id)?.remarks || id }}</span><button class="tool-button" type="button" :disabled="index === 0" :aria-label="t('nodes.moveMemberUp')" @click="actions.moveGroupChild(id, 'up')"><UiIcon name="arrow-up" /></button><button class="tool-button" type="button" :disabled="index === state.groupChildIds.length - 1" :aria-label="t('nodes.moveMemberDown')" @click="actions.moveGroupChild(id, 'down')"><UiIcon name="arrow-down" /></button><button class="tool-button danger-text" type="button" :aria-label="t('common.delete')" @click="actions.toggleGroupChild(id)"><UiIcon name="close" /></button></div><p v-if="!state.groupChildIds.length" class="muted">{{ t('common.empty') }}</p></div></div></div>
          </div>
        </fieldset>

        <template v-else>
          <fieldset class="editor-section">
            <legend>{{ t('nodes.authentication') }}</legend>
            <div class="form-grid three-col">
              <label v-if="!['HTTP', 'SOCKS', 'Naive', 'WireGuard'].includes(protocol)">{{ t(protocol === 'VMess' || protocol === 'VLESS' ? 'nodes.uuid' : 'nodes.password') }}<input v-model="state.profileForm.password" :required="['VMess', 'VLESS', 'Shadowsocks', 'Trojan', 'Hysteria2', 'TUIC', 'Anytls'].includes(protocol)" autocomplete="off" /></label>
              <label v-if="['HTTP', 'SOCKS', 'Naive'].includes(protocol)">{{ t('nodes.username') }}<input v-model="state.profileForm.username" autocomplete="off" /></label>
              <label v-if="protocol === 'TUIC'">{{ t('nodes.uuid') }}<input v-model="state.profileForm.username" required autocomplete="off" /></label>
              <label v-if="['HTTP', 'SOCKS', 'Naive'].includes(protocol)">{{ t('nodes.password') }}<input v-model="state.profileForm.password" :required="protocol === 'Naive'" autocomplete="off" /></label>
              <label v-if="protocol === 'VMess'">{{ t('nodes.alterId') }}<input v-model="state.profileForm.protoExtra.alterId" /></label>
              <label v-if="protocol === 'VMess'">{{ t('nodes.security') }}<select v-model="state.profileForm.protoExtra.vmessSecurity"><option v-for="security in transportOptions.vmessSecurities" :key="security" :value="security">{{ security }}</option></select></label>
              <label v-if="['VLESS', 'Trojan'].includes(protocol)">{{ t('nodes.flow') }}<select v-model="state.profileForm.protoExtra.flow"><option v-for="flow in transportOptions.flows" :key="flow || 'none'" :value="flow">{{ flow || t('common.none') }}</option></select></label>
              <label v-if="protocol === 'VLESS'">{{ t('nodes.encryption') }}<input v-model="state.profileForm.protoExtra.vlessEncryption" /></label>
              <label v-if="protocol === 'Shadowsocks'">{{ t('nodes.method') }}<select v-model="state.profileForm.protoExtra.ssMethod" required><option v-for="method in shadowsocksMethods" :key="method" :value="method">{{ method }}</option></select></label>
              <label v-if="['Shadowsocks', 'Naive'].includes(protocol)" class="check-inline"><UiCheckbox v-model="state.profileForm.protoExtra.uot" />{{ t('nodes.udpOverTcp') }}</label>
              <label v-if="protocol === 'TUIC'">{{ t('nodes.congestionControl') }}<select v-model="state.profileForm.protoExtra.congestionControl"><option v-for="control in transportOptions.tuicCongestionControls" :key="control" :value="control">{{ control }}</option></select></label>
              <label v-if="protocol === 'Naive' && state.profileForm.protoExtra.naiveQuic">{{ t('nodes.congestionControl') }}<select v-model="state.profileForm.protoExtra.congestionControl"><option v-for="control in transportOptions.naiveCongestionControls" :key="control" :value="control">{{ control }}</option></select></label>
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

          <fieldset v-if="supportsTransport" class="editor-section">
            <legend>{{ t('nodes.transport') }}</legend>
            <div class="form-grid three-col">
              <template v-if="state.profileForm.network === 'raw'">
                <label>{{ t('nodes.rawHeaderType') }}<select v-model="state.profileForm.transportExtra.rawHeaderType"><option v-for="type in transportOptions.rawHeaderTypes" :key="type" :value="type">{{ type }}</option></select></label>
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
                <label>{{ t('nodes.grpcMode') }}<select v-model="state.profileForm.transportExtra.grpcMode"><option v-for="mode in transportOptions.grpcModes" :key="mode" :value="mode">{{ mode }}</option></select></label>
                <label>{{ t('nodes.grpcAuthority') }}<input v-model="state.profileForm.transportExtra.grpcAuthority" /></label>
                <label>{{ t('nodes.grpcServiceName') }}<input v-model="state.profileForm.transportExtra.grpcServiceName" /></label>
              </template>
              <template v-if="state.profileForm.network === 'xhttp'">
                <label>{{ t('nodes.xhttpMode') }}<select v-model="state.profileForm.transportExtra.xhttpMode"><option v-for="mode in transportOptions.xhttpModes" :key="mode" :value="mode">{{ mode }}</option></select></label>
                <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
                <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
                <label class="wide-field">{{ t('nodes.xhttpExtra') }}<textarea v-model="state.profileForm.transportExtra.xhttpExtra" /></label>
              </template>
              <template v-if="state.profileForm.network === 'kcp'">
                <label>{{ t('nodes.kcpHeaderType') }}<select v-model="state.profileForm.transportExtra.kcpHeaderType"><option v-for="type in transportOptions.kcpHeaderTypes" :key="type" :value="type">{{ type }}</option></select></label>
                <label>{{ t('nodes.kcpSeed') }}<input v-model="state.profileForm.transportExtra.kcpSeed" /></label>
                <label>{{ t('nodes.kcpMtu') }}<input v-model.number="state.profileForm.transportExtra.kcpMtu" type="number" min="0" /></label>
              </template>
            </div>
          </fieldset>

          <fieldset v-if="protocol !== 'WireGuard'" class="editor-section">
            <legend>{{ t('nodes.tlsReality') }}</legend>
            <div class="form-grid three-col">
              <label>{{ t('nodes.streamSecurity') }}<select v-model="state.profileForm.streamSecurity"><option v-for="security in streamSecurityOptions" :key="security || 'none'" :value="security">{{ security === 'tls' ? 'TLS' : security === 'reality' ? 'Reality' : t('common.none') }}</option></select></label>
              <template v-if="isTls">
                <label>{{ t('nodes.sni') }}<input v-model="state.profileForm.sni" /></label>
                <label>{{ t('nodes.alpn') }}<select v-model="state.profileForm.alpn" :disabled="alpnDisabled"><option v-for="alpn in transportOptions.alpns" :key="alpn || 'none'" :value="alpn">{{ alpn || t('common.none') }}</option></select></label>
                <label>{{ t('nodes.fingerprint') }}<select v-model="state.profileForm.fingerprint" :disabled="fingerprintDisabled"><option v-for="fingerprint in transportOptions.fingerprints" :key="fingerprint || 'none'" :value="fingerprint">{{ fingerprint || t('common.none') }}</option></select></label>
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

        <details class="advanced-editor">
          <summary>{{ t('nodes.advancedProfileFields') }}</summary>
          <p class="field-hint">{{ t('nodes.advancedProfileHint') }}</p>
          <textarea v-model="state.profileAdvancedJson" class="code-area advanced-profile-json" spellcheck="false" />
        </details>
        <p v-if="state.profileModalError" class="inline-error" role="alert">{{ state.profileModalError }}</p>
      </div>

      <footer class="modal-actions">
        <button class="button" type="button" @click="state.showProfileForm = false">{{ t('common.cancel') }}</button>
        <button class="button primary" type="submit">{{ t('common.save') }}</button>
      </footer>
    </form>
  </div>
</template>
