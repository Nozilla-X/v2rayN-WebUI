<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../../Components/types'
import UiCheckbox from '../../Components/UiCheckbox.vue'
const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const webTargetType = computed(() => state.updateSettings.webTarget?.name === 'v2rayN.Web' ? 'v2rayN.Web' : 'v2rayN.WebAPI')
</script>

<template>
  <div class="form-section update-section web-app-update">
    <div class="section-heading">
      <div>
        <h2>{{ state.updateSettings.webTarget?.name || t('maintenance.webApp') }}</h2>
        <small>{{ t('polish.targetWeb') }}</small>
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
      <span v-if="state.updateResults[webTargetType]?.updateAvailable" class="update-state">{{ t('maintenance.updateAvailable', { version: state.updateResults[webTargetType].latestVersion }) }}</span>
      <span v-else-if="state.updateResults[webTargetType] && !state.updateResults[webTargetType].updateAvailable" class="muted">{{ t('maintenance.upToDateGeneric') }}</span>
    </div>
    <div class="update-core-row">
      <label class="check-inline"><UiCheckbox v-model="state.updateSettings.webSelected" :disabled="!state.updateSettings.webTarget?.isSupported" />{{ t('maintenance.includeWebUpdate') }}</label>
      <label v-if="state.updateSettings.webTarget" class="check-inline"><UiCheckbox :model-value="state.updateSettings.checkPreReleaseCoreTypes.includes(webTargetType)" @change="actions.setPreReleaseTarget(webTargetType, $event)" />{{ t('maintenance.preRelease') }}</label>
      <span v-if="state.updateProgress[webTargetType] && !state.updateProgress[webTargetType].isComplete" class="update-state">{{ t(`maintenance.phase.${state.updateProgress[webTargetType].phase}`) }}</span>
      <span v-else-if="state.updateProgress[webTargetType]?.isComplete" :class="state.updateProgress[webTargetType].success ? 'update-state' : 'danger-note'">{{ t(state.updateProgress[webTargetType].success ? 'maintenance.phase.completed' : 'maintenance.phase.failed') }}</span>
    </div>
    <p v-if="state.updateProgress[webTargetType]?.detail" class="field-hint update-detail">{{ state.updateProgress[webTargetType].detail }}</p>
    <p v-if="state.updateProgress[webTargetType]?.isComplete && state.updateProgress[webTargetType].success === false && state.updateProgress[webTargetType].rollbackSucceeded !== null && state.updateProgress[webTargetType].rollbackSucceeded !== undefined" class="field-hint update-detail">{{ t(state.updateProgress[webTargetType].rollbackSucceeded ? 'maintenance.webRollbackSucceeded' : 'maintenance.webRollbackFailed') }}</p>
    <p v-if="state.updateResults[webTargetType]?.detail" class="field-hint update-detail">{{ state.updateResults[webTargetType].detail }}</p>
    <div class="button-row">
      <button class="button" :disabled="!state.updateSettings.webTarget?.canCheck || state.operations.includes('core-update-batch') || state.operations.includes('web-update')" @click="actions.checkWebUpdate">{{ t('maintenance.checkWebUpdate') }}</button>
      <button class="button primary" :disabled="!state.updateSettings.webSelected || !state.updateSettings.webTarget?.canInstall || state.operations.includes('core-update-batch') || state.operations.includes('web-update')" @click="actions.updateWeb">{{ t('maintenance.installWebUpdate') }}</button>
    </div>
  </div>
</template>
