<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const activeTab = ref('updates')
</script>

<template>
  <section class="page maintenance-page">
    <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('maintenance.title') }}</h1></div><button class="button" @click="actions.loadMaintenance">{{ t('common.refresh') }}</button></div>
    <nav class="section-tabs" :aria-label="t('maintenance.title')"><button :class="{ selected: activeTab === 'updates' }" @click="activeTab = 'updates'">{{ t('maintenance.updates') }}</button><button :class="{ selected: activeTab === 'backup' }" @click="activeTab = 'backup'">{{ t('maintenance.backupRestore') }}</button></nav>

    <section v-if="activeTab === 'updates'" class="settings-section">
      <div class="panel update-preferences">
        <div class="section-heading"><div><h2>{{ t('maintenance.updateSettings') }}</h2><small>{{ t('maintenance.updateSettingsHint') }}</small></div></div>
        <div class="settings-checks">
          <label class="check-inline"><UiCheckbox v-model="state.updateSettings.preRelease" />{{ t('maintenance.preRelease') }}</label>
          <label class="check-inline"><UiCheckbox v-model="state.updateSettings.useProxy" />{{ t('maintenance.useProxy') }}</label>
          <button class="button" @click="actions.saveUpdateSettings">{{ t('maintenance.saveUpdateSettings') }}</button>
          <button class="button" :disabled="state.operations.includes('core-update-batch')" @click="actions.runSelectedUpdateBatch(false)">{{ t('maintenance.batchCheck') }}</button>
          <button class="button primary" :disabled="state.operations.includes('core-update-batch')" @click="actions.runSelectedUpdateBatch(true)">{{ t('maintenance.batchUpdate') }}</button>
        </div>
      </div>

      <div class="form-section update-section web-app-update">
        <div class="section-heading">
          <div>
            <h2>{{ t('maintenance.webApp') }}</h2>
            <small v-if="state.updateSettings.webTarget">{{ t('maintenance.webCurrentVersion', { version: state.updateSettings.webTarget.version }) }}</small>
            <small v-if="state.updateSettings.webTarget?.latestVersion">{{ t('maintenance.webLatestVersion', { version: state.updateSettings.webTarget.latestVersion }) }}</small>
            <small v-if="state.updateSettings.webTarget">{{ t('maintenance.webBuildIdentity', {
              commit: state.updateSettings.webTarget.commit,
              buildDate: state.updateSettings.webTarget.buildDate,
              rid: state.updateSettings.webTarget.rid,
              deployment: state.updateSettings.webTarget.deployment,
            }) }}</small>
            <small v-if="state.updateSettings.webTarget?.installReasonKey" class="field-hint">{{ t(state.updateSettings.webTarget.installReasonKey) }}</small>
          </div>
          <span v-if="state.updateResults['v2rayN.Web']?.updateAvailable" class="update-state">{{ t('maintenance.updateAvailable', { version: state.updateResults['v2rayN.Web'].latestVersion }) }}</span>
          <span v-else-if="state.updateResults['v2rayN.Web'] && !state.updateResults['v2rayN.Web'].updateAvailable" class="muted">{{ t('maintenance.upToDateGeneric') }}</span>
        </div>
        <div class="update-core-row">
          <label class="check-inline"><UiCheckbox v-model="state.updateSettings.webSelected" :disabled="!state.updateSettings.webTarget?.isSupported" />{{ t('maintenance.includeWebUpdate') }}</label>
          <span v-if="state.updateProgress['v2rayN.Web'] && !state.updateProgress['v2rayN.Web'].isComplete" class="update-state">{{ t(`maintenance.phase.${state.updateProgress['v2rayN.Web'].phase}`) }}</span>
          <span v-else-if="state.updateProgress['v2rayN.Web']?.isComplete" :class="state.updateProgress['v2rayN.Web'].success ? 'update-state' : 'danger-note'">{{ t(state.updateProgress['v2rayN.Web'].success ? 'maintenance.phase.completed' : 'maintenance.phase.failed') }}</span>
        </div>
        <p v-if="state.updateProgress['v2rayN.Web']?.detail" class="field-hint update-detail">{{ state.updateProgress['v2rayN.Web'].detail }}</p>
        <p v-if="state.updateProgress['v2rayN.Web']?.isComplete && state.updateProgress['v2rayN.Web'].success === false && state.updateProgress['v2rayN.Web'].rollbackSucceeded !== null && state.updateProgress['v2rayN.Web'].rollbackSucceeded !== undefined" class="field-hint update-detail">{{ t(state.updateProgress['v2rayN.Web'].rollbackSucceeded ? 'maintenance.webRollbackSucceeded' : 'maintenance.webRollbackFailed') }}</p>
        <p v-if="state.updateResults['v2rayN.Web']?.detail" class="field-hint update-detail">{{ state.updateResults['v2rayN.Web'].detail }}</p>
        <div class="button-row">
          <button class="button" :disabled="!state.updateSettings.webTarget?.canCheck || state.operations.includes('core-update-batch') || state.operations.includes('web-update')" @click="actions.checkWebUpdate">{{ t('maintenance.checkWebUpdate') }}</button>
          <button class="button primary" :disabled="!state.updateSettings.webSelected || !state.updateSettings.webTarget?.canInstall || state.operations.includes('core-update-batch') || state.operations.includes('web-update')" @click="actions.updateWeb">{{ t('maintenance.installWebUpdate') }}</button>
        </div>
      </div>

      <div v-for="target in state.updateSettings.targets" :key="target.coreType" class="form-section update-section">
        <div class="section-heading">
          <div><h2>{{ t(target.nameKey) }}</h2><small v-if="target.unsupportedReasonKey">{{ t(target.unsupportedReasonKey) }}</small></div>
          <span v-if="state.updateResults[target.coreType]?.updateAvailable" class="update-state">{{ t('maintenance.updateAvailable', { version: state.updateResults[target.coreType].version }) }}</span>
          <span v-else-if="state.updateResults[target.coreType]?.isUpToDate" class="muted">{{ t('maintenance.upToDateGeneric') }}</span>
        </div>
        <div class="update-core-row">
          <label class="check-inline"><UiCheckbox v-model="target.selected" :disabled="!target.isSupported" />{{ t('maintenance.includeCoreUpdate') }}</label>
          <span v-if="state.updateProgress[target.coreType] && !state.updateProgress[target.coreType].isComplete" class="update-state">{{ t(`maintenance.phase.${state.updateProgress[target.coreType].phase}`) }}</span>
          <span v-else-if="state.updateProgress[target.coreType]?.isComplete" :class="state.updateProgress[target.coreType].success ? 'update-state' : 'danger-note'">{{ t(state.updateProgress[target.coreType].success ? 'maintenance.phase.completed' : 'maintenance.phase.failed') }}</span>
        </div>
        <p v-if="state.updateProgress[target.coreType]?.detail" class="field-hint update-detail">{{ state.updateProgress[target.coreType].detail }}</p>
        <div class="button-row">
          <button class="button" :disabled="!target.isSupported || !target.selected || state.operations.includes('core-update-batch') || state.operations.includes(`core-update-${String(target.coreType).toLowerCase()}`)" @click="actions.checkCoreUpdate(target.coreType)">{{ t('maintenance.checkOnly') }}</button>
          <button class="button primary" :disabled="!target.canInstall || !target.selected || state.operations.includes('core-update-batch') || state.operations.includes(`core-update-${String(target.coreType).toLowerCase()}`)" @click="actions.updateCore(target.coreType)">{{ t('maintenance.checkAndUpdate') }}</button>
        </div>
      </div>

      <div class="form-section settings-subsection">
        <div class="section-heading"><div><h2>{{ t('maintenance.geoFiles') }}</h2><small>{{ t('maintenance.geoUpdateHint') }}</small></div></div>
        <div class="update-core-row"><label class="check-inline"><UiCheckbox v-model="state.updateSettings.geoFilesSelected" />{{ t('maintenance.includeGeoFiles') }}</label><span v-if="state.updateProgress.GeoFiles && !state.updateProgress.GeoFiles.isComplete" class="update-state">{{ t(`maintenance.phase.${state.updateProgress.GeoFiles.phase}`) }}</span></div>
        <p v-if="state.updateProgress.GeoFiles?.detail" class="field-hint update-detail">{{ state.updateProgress.GeoFiles.detail }}</p>
        <button class="button" :disabled="!state.updateSettings.geoFilesSelected || state.operations.includes('core-update-batch') || state.operations.includes('geo-update')" @click="actions.updateGeo">{{ t('maintenance.updateGeo') }}</button>
      </div>
      <div class="form-section settings-subsection"><div class="section-heading"><div><h2>{{ t('maintenance.statistics') }}</h2><small>{{ t('maintenance.statistics') }} · {{ state.status?.statisticsEnabled ? t('common.enabled') : t('status.statisticsOff') }}</small></div></div><button class="button danger" @click="actions.clearStatistics">{{ t('maintenance.clearStatistics') }}</button></div>
      <div class="form-section settings-subsection"><div class="section-heading"><h2>{{ t('maintenance.operationList') }}</h2><button class="tool-button" :aria-label="t('common.refresh')" :title="t('common.refresh')" @click="actions.loadOperations"><UiIcon name="refresh" /></button></div><div v-if="state.operations.length" class="operation-list"><span v-for="operation in state.operations" :key="operation" class="operation-pill"><i class="status-led on"></i>{{ operation }}</span></div><p v-else class="muted">{{ t('maintenance.noOperations') }}</p></div>
    </section>

    <section v-else class="settings-section backup-section">
      <div class="form-section settings-subsection"><h2>{{ t('maintenance.localBackup') }}</h2><div class="button-row"><button class="button primary" @click="actions.downloadBackup">{{ t('maintenance.downloadBackup') }}</button><label class="button danger file-button">{{ t('maintenance.restoreUpload') }}<input type="file" accept=".zip,application/zip" @change="actions.uploadRestore" /></label></div><p class="field-hint danger-note">{{ t('maintenance.restoreWarning') }}</p></div>
      <div class="settings-subsection"><div class="section-heading"><h2>{{ t('maintenance.webdav') }}</h2><span v-if="state.webdavForm.hasPassword" class="muted">{{ t('maintenance.passwordStored') }}</span></div><div class="form-grid two-col"><label>{{ t('maintenance.webdavUrl') }}<input v-model="state.webdavForm.url" /></label><label>{{ t('maintenance.webdavDir') }}<input v-model="state.webdavForm.dirName" /></label><label>{{ t('maintenance.webdavUser') }}<input v-model="state.webdavForm.userName" /></label><label>{{ t('maintenance.webdavPassword') }}<input v-model="state.webdavForm.password" type="password" /></label></div><div class="button-row"><button class="button primary" @click="actions.saveWebdav">{{ t('maintenance.webdavSettings') }}</button><button class="button" @click="actions.webdavAction('check')">{{ t('maintenance.checkWebdav') }}</button><button class="button" @click="actions.webdavAction('backup')">{{ t('maintenance.backupWebdav') }}</button><button class="button danger" @click="actions.webdavAction('restore')">{{ t('maintenance.restoreWebdav') }}</button></div><p class="field-hint danger-note">{{ t('maintenance.webdavRestoreWarning') }}</p></div>
    </section>
  </section>
</template>
