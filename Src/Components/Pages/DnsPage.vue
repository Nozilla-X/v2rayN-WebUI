<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiCheckbox from '../UiCheckbox.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const activeTab = ref('basic')
const activeCoreType = computed(() => activeTab.value === 'sing-box' ? 'sing_box' : activeTab.value)
const activeDnsProfile = computed(() => state.dnsProfiles.find((profile: Record<string, any>) => String(profile.coreType).toLowerCase().replace('-', '_') === activeCoreType.value) || null)
const isSimpleDnsEnabled = computed(() => {
  const profiles = state.dnsProfiles.filter((profile: Record<string, any>) => ['xray', 'sing_box'].includes(String(profile.coreType).toLowerCase()))
  return !profiles.length || !profiles.every((profile: Record<string, any>) => profile.enabled)
})
const tabs = [
  { id: 'basic', key: 'dns.basicTab' },
  { id: 'advanced', key: 'dns.advancedTab' },
  { id: 'xray', key: 'dns.xrayTab' },
  { id: 'sing-box', key: 'dns.singboxTab' },
]
</script>

<template>
  <section class="page dns-page">
    <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('dns.title') }}</h1></div><button class="button" @click="actions.loadDns">{{ t('common.refresh') }}</button></div>
    <nav class="section-tabs" :aria-label="t('dns.title')"><button v-for="tab in tabs" :key="tab.id" :class="{ selected: activeTab === tab.id }" @click="activeTab = tab.id">{{ t(tab.key) }}</button></nav>

    <section v-if="activeTab === 'basic'" class="settings-section form-section">
      <p v-if="!isSimpleDnsEnabled" class="inline-warning" role="status">{{ t('dns.customDnsConflict') }}</p>
      <fieldset class="dns-editable" :disabled="!isSimpleDnsEnabled">
        <div class="form-grid three-col">
          <label>{{ t('dns.directDns') }}<input v-model="state.simpleDnsForm.directDNS" list="dns-direct-addresses" /><datalist id="dns-direct-addresses"><option v-for="value in state.dnsOptions.directDnsAddresses" :key="value" :value="value" /></datalist></label>
          <label>{{ t('dns.remoteDns') }}<input v-model="state.simpleDnsForm.remoteDNS" list="dns-remote-addresses" /><datalist id="dns-remote-addresses"><option v-for="value in state.dnsOptions.remoteDnsAddresses" :key="value" :value="value" /></datalist></label>
          <label>{{ t('dns.bootstrapDns') }}<input v-model="state.simpleDnsForm.bootstrapDNS" list="dns-bootstrap-addresses" /><datalist id="dns-bootstrap-addresses"><option v-for="value in state.dnsOptions.bootstrapDnsAddresses" :key="value" :value="value" /></datalist></label>
          <label>{{ t('dns.strategyFreedom') }}<select v-model="state.simpleDnsForm.strategy4Freedom"><option v-for="value in state.dnsOptions.domainStrategies4Freedom" :key="value || 'none'" :value="value">{{ value || t('common.none') }}</option><option v-if="state.simpleDnsForm.strategy4Freedom && !state.dnsOptions.domainStrategies4Freedom.includes(state.simpleDnsForm.strategy4Freedom)" :value="state.simpleDnsForm.strategy4Freedom">{{ state.simpleDnsForm.strategy4Freedom }}</option></select></label>
          <label>{{ t('dns.strategyProxy') }}<select v-model="state.simpleDnsForm.strategy4Proxy"><option v-for="value in state.dnsOptions.domainStrategies4Freedom" :key="value || 'none'" :value="value">{{ value || t('common.none') }}</option><option v-if="state.simpleDnsForm.strategy4Proxy && !state.dnsOptions.domainStrategies4Freedom.includes(state.simpleDnsForm.strategy4Proxy)" :value="state.simpleDnsForm.strategy4Proxy">{{ state.simpleDnsForm.strategy4Proxy }}</option></select></label>
          <label>{{ t('dns.strategyProxyDial') }}<select v-model="state.simpleDnsForm.strategy4ProxyDial"><option v-for="value in state.dnsOptions.domainStrategies4Freedom" :key="value || 'none'" :value="value">{{ value || t('common.none') }}</option><option v-if="state.simpleDnsForm.strategy4ProxyDial && !state.dnsOptions.domainStrategies4Freedom.includes(state.simpleDnsForm.strategy4ProxyDial)" :value="state.simpleDnsForm.strategy4ProxyDial">{{ state.simpleDnsForm.strategy4ProxyDial }}</option></select></label>
        </div>
        <div class="settings-checks"><label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.parallelQuery" />{{ t('dns.parallelQuery') }}</label><label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.serveStale" />{{ t('dns.serveStale') }}</label><label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.enableHappyEyeballs" />{{ t('dns.happyEyeballs') }}</label></div>
        <div class="footer-actions settings-footer"><button class="button primary" @click="actions.saveSimpleDns">{{ t('common.save') }}</button></div>
      </fieldset>
    </section>

    <section v-else-if="activeTab === 'advanced'" class="settings-section form-section">
      <p v-if="!isSimpleDnsEnabled" class="inline-warning" role="status">{{ t('dns.customDnsConflict') }}</p>
      <fieldset class="dns-editable" :disabled="!isSimpleDnsEnabled">
        <div class="form-grid three-col">
          <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.useSystemHosts" />{{ t('dns.useSystemHosts') }}</label>
          <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.addCommonHosts" />{{ t('dns.addCommonHosts') }}</label>
          <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.fakeIP" />{{ t('dns.fakeIp') }}</label>
          <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.globalFakeIp" />{{ t('dns.globalFakeIp') }}</label>
          <label>{{ t('dns.fakeIpRange') }}<input v-model="state.simpleDnsForm.fakeIPRange" list="dns-fakeip-ranges" /><datalist id="dns-fakeip-ranges"><option v-for="value in state.dnsOptions.fakeIpRanges" :key="value" :value="value" /></datalist></label>
          <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.blockBindingQuery" />{{ t('dns.blockBindingQuery') }}</label>
          <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.blockAAAAQuery" />{{ t('dns.blockAAAAQuery') }}</label>
          <label>{{ t('dns.directExpectedIPs') }}<input v-model="state.simpleDnsForm.directExpectedIPs" list="dns-expected-ips" /><datalist id="dns-expected-ips"><option v-for="value in state.dnsOptions.expectedIps" :key="value" :value="value" /></datalist></label>
          <label class="wide-field">{{ t('dns.hosts') }}<textarea v-model="state.simpleDnsForm.hosts" class="code-area" spellcheck="false" /></label>
        </div>
        <details class="advanced-editor"><summary>{{ t('dns.jsonEditor') }}</summary><p class="field-hint">{{ t('dns.jsonCompatibilityHint') }}</p><textarea v-model="state.simpleDnsAdvancedRaw" class="code-area dns-code" spellcheck="false" /></details>
        <div class="footer-actions settings-footer"><button class="button primary" @click="actions.saveSimpleDns">{{ t('common.save') }}</button></div>
      </fieldset>
    </section>

    <section v-else class="settings-section form-section dns-core-section">
      <template v-if="activeDnsProfile">
        <header class="section-heading"><div><h2>{{ activeTab === 'xray' ? t('dns.xrayTab') : t('dns.singboxTab') }}</h2></div><label class="check-inline"><UiCheckbox v-model="activeDnsProfile.enabled" />{{ t('dns.enabled') }}</label></header>
        <div class="dns-core-toolbar">
          <a v-if="activeTab === 'xray'" :href="'https://xtls.github.io/config/dns.html#dnsobject'" target="_blank" rel="noopener noreferrer">{{ t('dns.docsXray') }}</a>
          <a v-else :href="'https://sing-box.sagernet.org/zh/configuration/dns/'" target="_blank" rel="noopener noreferrer">{{ t('dns.docsSingbox') }}</a>
          <button class="button compact" @click="actions.importDefaultDns(activeDnsProfile)">{{ t('dns.importDefaultConfig') }}</button>
        </div>
        <div class="form-grid two-col">
          <label>{{ t('dns.remarks') }}<input v-model="activeDnsProfile.remarks" /></label>
          <label>{{ t('dns.httpSocks') }}<textarea v-model="activeDnsProfile.normalDNS" class="code-area dns-code" spellcheck="false" /></label>
          <label>{{ t('dns.tunDns') }}<textarea v-model="activeDnsProfile.tunDNS" class="code-area dns-code" spellcheck="false" /></label>
          <label>{{ t(activeTab === 'xray' ? 'dns.domainStrategy' : 'dns.domainStrategy4Out') }}<select v-model="activeDnsProfile.domainStrategy4Freedom"><option v-for="value in (activeTab === 'xray' ? state.dnsOptions.domainStrategies4Freedom : state.dnsOptions.domainStrategies4Singbox)" :key="value || 'none'" :value="value">{{ value || t('common.none') }}</option><option v-if="activeDnsProfile.domainStrategy4Freedom && !(activeTab === 'xray' ? state.dnsOptions.domainStrategies4Freedom : state.dnsOptions.domainStrategies4Singbox).includes(activeDnsProfile.domainStrategy4Freedom)" :value="activeDnsProfile.domainStrategy4Freedom">{{ activeDnsProfile.domainStrategy4Freedom }}</option></select></label>
          <label>{{ t('dns.domainDnsAddress') }}<input v-model="activeDnsProfile.domainDNSAddress" list="dns-core-addresses" /><datalist id="dns-core-addresses"><option v-for="value in state.dnsOptions.domainDnsAddresses" :key="value" :value="value" /></datalist></label>
          <label v-if="activeTab === 'xray'" class="check-inline"><UiCheckbox v-model="activeDnsProfile.useSystemHosts" />{{ t('dns.useSystemHosts') }}</label>
        </div>
        <div class="footer-actions settings-footer"><button class="button primary" @click="actions.saveDnsProfile(activeDnsProfile)">{{ t('common.save') }}</button></div>
      </template>
      <p v-else class="muted empty-inline">{{ t('dns.coreProfileUnavailable') }}</p>
    </section>
  </section>
</template>
