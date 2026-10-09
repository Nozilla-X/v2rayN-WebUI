<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiCheckbox from '../UiCheckbox.vue'
import SaveBar from '../SaveBar.vue'
import PageFeedback from '../UI/PageFeedback.vue'
import { useDraftState } from '../../UI/useDraftState'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const activeTab = ref('core')
const { dirty, status } = useDraftState('settings', () => ({ settings: { inbound: state.inboundForm, core: state.coreForm, app: state.appForm, speed: state.speedForm, mappings: state.settings.coreTypes } }), () => [state.inboundForm, state.coreForm, state.appForm, state.speedForm, state.settings], () => [])
const tabs = [
  { id: 'core', key: 'settings.coreTab' },
  { id: 'application', key: 'settings.application' },
  { id: 'speedtest', key: 'settings.speedtest' },
  { id: 'coreTypes', key: 'settings.coreTypes' },
]
</script>

<template>
  <section class="page settings-page">
    <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('settings.title') }}</h1></div></div>
    <PageFeedback scope="settings" />
    <nav class="section-tabs" :aria-label="t('settings.title')"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="activeTab === tab.id" :class="{ selected: activeTab === tab.id }" @click="activeTab = tab.id">{{ t(tab.key) }}</button></nav>

    <section v-if="activeTab === 'core'" class="settings-section">
      <div class="form-section settings-subsection"><h2>{{ t('settings.inbound') }}</h2><div class="form-grid three-col">
        <label>{{ t('settings.localPort') }}<input v-model.number="state.inboundForm.localPort" type="number" min="1" max="65535" /></label>
        <label class="check-inline"><UiCheckbox v-model="state.inboundForm.secondLocalPortEnabled" />{{ t('settings.secondPort') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.inboundForm.udpEnabled" />{{ t('settings.udp') }}</label>
        <div class="wide-field settings-sniffing-row">
          <label class="check-inline"><UiCheckbox v-model="state.inboundForm.sniffingEnabled" />{{ t('settings.sniffing') }}</label>
          <div class="settings-multi-select"><span>{{ t('settings.destOverride') }}</span><div class="check-inline-group"><label v-for="protocol in state.settings.options?.destOverrideProtocols || []" :key="protocol" class="check-inline"><UiCheckbox :model-value="state.inboundForm.destOverride?.includes(protocol)" @change="actions.toggleDestOverride(protocol, $event)" />{{ protocol }}</label></div></div>
        </div>
        <label class="check-inline"><UiCheckbox v-model="state.inboundForm.routeOnly" />{{ t('settings.routeOnly') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.inboundForm.allowLANConn" />{{ t('settings.allowLan') }}</label>
        <label class="check-inline"><UiCheckbox v-model="state.inboundForm.newPort4LAN" />{{ t('settings.newLanPort') }}</label>
        <label>{{ t('settings.user') }}<input v-model="state.inboundForm.user" /></label><label>{{ t('settings.pass') }}<input v-model="state.inboundForm.pass" type="password" /></label>
      </div></div>
      <div class="form-section settings-subsection"><h2>{{ t('settings.core') }}</h2><div class="form-grid three-col">
        <label class="check-inline"><UiCheckbox v-model="state.coreForm.logEnabled" />{{ t('settings.logEnabled') }}</label><label>{{ t('settings.loglevel') }}<select v-model="state.coreForm.loglevel"><option v-for="level in state.settings.options?.logLevels || []" :key="level">{{ level }}</option></select></label>
        <label>{{ t('settings.fingerprint') }}<select v-model="state.coreForm.defFingerprint"><option v-for="value in state.settings.options?.fingerprints || []" :key="value || 'none'" :value="value">{{ value || t('common.none') }}</option></select></label><label>{{ t('settings.userAgent') }}<select v-model="state.coreForm.defUserAgent"><option value="">{{ t('common.none') }}</option><option v-for="value in state.settings.options?.userAgents || []" :key="value" :value="value">{{ value }}</option></select></label><label>{{ t('settings.sendThrough') }}<input v-model="state.coreForm.sendThrough" /></label><label>{{ t('settings.bindInterface') }}<input v-model="state.coreForm.bindInterface" /></label>
        <label>{{ t('settings.muxRay') }}<input v-model.number="state.coreForm.mux4RayConcurrency" type="number" min="0" /></label><label>{{ t('settings.muxXudp') }}<input v-model.number="state.coreForm.mux4RayXudpConcurrency" type="number" min="0" /></label><label>{{ t('settings.muxXudp443') }}<select v-model="state.coreForm.mux4RayXudpProxyUDP443"><option value="">{{ t('common.none') }}</option><option v-for="value in state.settings.options?.mux4RayXudpProxyUDP443Options || []" :key="value" :value="value">{{ value }}</option></select></label><label>{{ t('settings.muxSboxProtocol') }}<select v-model="state.coreForm.mux4SboxProtocol"><option v-for="value in state.settings.options?.mux4SboxProtocols || []" :key="value || 'none'" :value="value">{{ value || t('common.none') }}</option></select></label><label class="check-inline"><UiCheckbox v-model="state.coreForm.mux4SboxPadding" />{{ t('settings.muxSboxPadding') }}</label><label class="check-inline"><UiCheckbox v-model="state.coreForm.enableCacheFile4Sbox" />{{ t('settings.cacheSbox') }}</label>
        <label>{{ t('settings.hy2Up') }}<input v-model.number="state.coreForm.hy2UpMbps" type="number" min="0" /></label><label>{{ t('settings.hy2Down') }}<input v-model.number="state.coreForm.hy2DownMbps" type="number" min="0" /></label><label class="check-inline"><UiCheckbox v-model="state.coreForm.enableFragment" />{{ t('settings.fragment') }}</label><label class="check-inline"><UiCheckbox v-model="state.coreForm.enableFinalFragment" />{{ t('settings.finalFragment') }}</label><label>{{ t('settings.fragmentPackets') }}<select v-model="state.coreForm.fragmentPackets"><option value="">{{ t('common.none') }}</option><option v-for="value in state.settings.options?.fragmentPacketsOptions || []" :key="value" :value="value">{{ value }}</option></select></label><label>{{ t('settings.fragmentMaxSplit') }}<input v-model="state.coreForm.fragmentMaxSplit" /></label><label>{{ t('settings.fragmentLengths') }}<textarea v-model="state.coreForm.fragmentLengthsText" /></label><label>{{ t('settings.fragmentDelays') }}<textarea v-model="state.coreForm.fragmentDelaysText" /></label>
      </div></div>
    </section>

    <section v-else-if="activeTab === 'application'" class="settings-section form-section"><div class="form-grid three-col">
       <label class="check-inline"><UiCheckbox v-model="state.appForm.enableStatistics" />{{ t('settings.statistics') }}</label><label class="check-inline"><UiCheckbox v-model="state.appForm.displayRealTimeSpeed" />{{ t('settings.realtimeSpeed') }}</label><label class="check-inline"><UiCheckbox v-model="state.appForm.keepOlderDedupl" />{{ t('settings.keepOlderDedupl') }}</label><label>{{ t('settings.geoAutoUpdate') }}<input v-model.number="state.appForm.geoAutoUpdateInterval" type="number" min="0" /></label><label>{{ t('settings.rootCertProvider') }}<select v-model="state.appForm.rootCertProvider"><option :value="null">{{ t('common.none') }}</option><option v-for="provider in state.settings.options?.rootCertProviders || []" :key="provider" :value="provider">{{ provider }}</option></select></label><label>{{ t('settings.geoSourceUrl') }}<input v-model="state.appForm.geoSourceUrl" list="settings-geo-sources" /><datalist id="settings-geo-sources"><option v-for="value in state.settings.options?.geoFilesSources || []" :key="value" :value="value" /></datalist></label><label>{{ t('settings.srsSourceUrl') }}<input v-model="state.appForm.srsSourceUrl" list="settings-srs-sources" /><datalist id="settings-srs-sources"><option v-for="value in state.settings.options?.singboxRulesetSources || []" :key="value" :value="value" /></datalist></label><label>{{ t('settings.routeRulesSourceUrl') }}<input v-model="state.appForm.routeRulesTemplateSourceUrl" list="settings-routing-sources" /><datalist id="settings-routing-sources"><option v-for="value in state.settings.options?.routingRulesSources || []" :key="value" :value="value" /></datalist></label><label>{{ t('settings.subConvertUrl') }}<input v-model="state.appForm.subConvertUrl" list="settings-subconvert-sources" /><datalist id="settings-subconvert-sources"><option v-for="value in state.settings.options?.subConvertUrls || []" :key="value" :value="value" /></datalist></label>
    </div></section>

    <section v-else-if="activeTab === 'speedtest'" class="settings-section form-section"><div class="form-grid three-col">
      <label>{{ t('settings.speedTimeout') }}<select v-model.number="state.speedForm.speedTestTimeout"><option v-if="!state.settings.options?.speedTestTimeouts?.includes(state.speedForm.speedTestTimeout)" :value="state.speedForm.speedTestTimeout">{{ state.speedForm.speedTestTimeout }}</option><option v-for="value in state.settings.options?.speedTestTimeouts || []" :key="value" :value="value">{{ value }}</option></select></label><label>{{ t('settings.mixedConcurrency') }}<select v-model.number="state.speedForm.mixedConcurrencyCount"><option v-if="!state.settings.options?.mixedConcurrencyCounts?.includes(state.speedForm.mixedConcurrencyCount)" :value="state.speedForm.mixedConcurrencyCount">{{ state.speedForm.mixedConcurrencyCount }}</option><option v-for="value in state.settings.options?.mixedConcurrencyCounts || []" :key="value" :value="value">{{ value }}</option></select></label><label>{{ t('settings.speedUrl') }}<input v-model="state.speedForm.speedTestUrl" list="speed-test-urls" /><datalist id="speed-test-urls"><option v-for="value in state.settings.options?.speedTestUrls || []" :key="value" :value="value" /></datalist></label><label>{{ t('settings.pingUrl') }}<input v-model="state.speedForm.speedPingTestUrl" list="speed-ping-urls" /><datalist id="speed-ping-urls"><option v-for="value in state.settings.options?.speedPingTestUrls || []" :key="value" :value="value" /></datalist></label><label>{{ t('settings.ipApiUrl') }}<input v-model="state.speedForm.ipapiUrl" list="speed-ipapi-urls" /><datalist id="speed-ipapi-urls"><option v-for="value in state.settings.options?.ipapiUrls || []" :key="value" :value="value" /></datalist></label><label>{{ t('settings.udpTarget') }}<input v-model="state.speedForm.udpTestTarget" list="speed-udp-targets" /><datalist id="speed-udp-targets"><option v-for="value in state.settings.options?.udpTestTargets || []" :key="value" :value="value" /></datalist></label>
    </div></section>

    <section v-else class="settings-section form-section"><div class="settings-subsection"><div class="section-heading"><div><h2>{{ t('settings.coreTypes') }}</h2><small>{{ t('settings.coreTypesHint') }}</small></div></div><div class="mapping-list"><div v-for="mapping in state.settings.coreTypes || []" :key="mapping.configType" class="mapping-row"><span>{{ mapping.configType }}</span><select v-model="mapping.coreType"><option v-for="core in state.coreTypes" :key="core" :value="core">{{ core === 'sing_box' ? 'sing-box' : core }}</option></select></div></div></div></section>

    <SaveBar sticky :label="t('settings.saveAll')" :busy="state.saving || Boolean(status.writes)" :dirty="dirty" @save="actions.saveAllSettings" />
  </section>
</template>
