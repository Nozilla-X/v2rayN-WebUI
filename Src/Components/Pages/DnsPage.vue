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
const activeDnsProfile = computed(() => state.dnsProfiles.find((profile: Record<string, any>) => String(profile.coreType).toLowerCase().replace('_', '-') === activeTab.value) || null)
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
      <div class="form-grid three-col">
        <label>{{ t('dns.directDns') }}<textarea v-model="state.simpleDnsForm.directDNS" /></label>
        <label>{{ t('dns.remoteDns') }}<textarea v-model="state.simpleDnsForm.remoteDNS" /></label>
        <label>{{ t('dns.bootstrapDns') }}<textarea v-model="state.simpleDnsForm.bootstrapDNS" /></label>
        <label>{{ t('dns.strategyFreedom') }}<input v-model="state.simpleDnsForm.strategy4Freedom" /></label>
        <label>{{ t('dns.strategyProxy') }}<input v-model="state.simpleDnsForm.strategy4Proxy" /></label>
        <label>{{ t('dns.strategyProxyDial') }}<input v-model="state.simpleDnsForm.strategy4ProxyDial" /></label>
      </div>
      <div class="settings-checks"><label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.parallelQuery" />{{ t('dns.parallelQuery') }}</label><label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.serveStale" />{{ t('dns.serveStale') }}</label><label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.enableHappyEyeballs" />{{ t('dns.happyEyeballs') }}</label></div>
      <div class="footer-actions settings-footer"><button class="button primary" @click="actions.saveSimpleDns">{{ t('common.save') }}</button></div>
    </section>

    <section v-else-if="activeTab === 'advanced'" class="settings-section form-section">
      <div class="form-grid three-col">
        <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.useSystemHosts" />{{ t('dns.useSystemHosts') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.addCommonHosts" />{{ t('dns.addCommonHosts') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.fakeIP" />{{ t('dns.fakeIp') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.globalFakeIp" />{{ t('dns.globalFakeIp') }}</label>
        <label>{{ t('dns.fakeIpRange') }}<input v-model="state.simpleDnsForm.fakeIPRange" /></label>
        <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.blockBindingQuery" />{{ t('dns.blockBindingQuery') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.simpleDnsForm.blockAAAAQuery" />{{ t('dns.blockAAAAQuery') }}</label>
        <label>{{ t('dns.directExpectedIPs') }}<textarea v-model="state.simpleDnsForm.directExpectedIPs" /></label>
        <label class="wide-field">{{ t('dns.hosts') }}<textarea v-model="state.simpleDnsForm.hosts" class="code-area" spellcheck="false" /></label>
      </div>
      <details class="advanced-editor"><summary>{{ t('dns.jsonEditor') }}</summary><p class="field-hint">{{ t('dns.jsonCompatibilityHint') }}</p><textarea v-model="state.simpleDnsAdvancedRaw" class="code-area dns-code" spellcheck="false" /></details>
      <div class="footer-actions settings-footer"><button class="button primary" @click="actions.saveSimpleDns">{{ t('common.save') }}</button></div>
    </section>

    <section v-else class="settings-section form-section dns-core-section">
      <template v-if="activeDnsProfile">
        <header class="section-heading"><div><h2>{{ activeTab === 'xray' ? t('dns.xrayTab') : t('dns.singboxTab') }}</h2><small>{{ t('dns.coreApiLimit') }}</small></div><label class="check-inline"><UiCheckbox v-model="activeDnsProfile.enabled" />{{ t('common.enabled') }}</label></header>
        <div class="form-grid two-col">
          <label>{{ t('dns.remarks') }}<input v-model="activeDnsProfile.remarks" /></label>
          <label>{{ t('dns.normalDns') }}<textarea v-model="activeDnsProfile.normalDNS" /></label>
          <label>{{ t('dns.domainStrategy') }}<input v-model="activeDnsProfile.domainStrategy4Freedom" /></label>
          <label>{{ t('dns.domainDnsAddress') }}<input v-model="activeDnsProfile.domainDNSAddress" /></label>
          <label class="check-inline"><UiCheckbox v-model="activeDnsProfile.useSystemHosts" />{{ t('dns.useSystemHosts') }}</label>
        </div>
        <div class="footer-actions settings-footer"><button class="button primary" @click="actions.saveDnsProfile(activeDnsProfile)">{{ t('common.save') }}</button></div>
      </template>
      <p v-else class="muted empty-inline">{{ t('dns.coreProfileUnavailable') }}</p>
    </section>
    <p class="page-footnote">{{ t('dns.tunHiddenNote') }}</p>
  </section>
</template>
