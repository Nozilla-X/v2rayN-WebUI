<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UiProps } from './types'
import UiIcon from './UiIcon.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions

function changeActiveRoute(event: Event) {
  const select = event.target as HTMLSelectElement
  const requestedId = select.value
  select.value = state.activeRoutingId
  void actions.activateRoute(requestedId)
}
</script>

<template>
<section class="runtime-strip">
  <div class="runtime-main">
    <span :class="['status-led', { on: state.status?.coreRunning }]"></span>
    <strong>{{ state.status?.coreRunning
      ? (state.status.coreType || t('nodes.core'))
      : t(`core.runtime.${state.status?.runtimeState || 'stopped'}`) }}</strong>
    <span v-if="state.status?.runtimeFailure" class="danger-note" :title="state.status.runtimeFailure">{{ t('status.runtimeFault') }}</span>
    <span v-if="state.status?.configuredProxyPort && state.status?.runningProxyPort && state.status.configuredProxyPort !== state.status.runningProxyPort" class="warning-note">
      {{ t('status.portMismatch', { configured: state.status.configuredProxyPort, running: state.status.runningProxyPort }) }}
    </span>
    <span class="runtime-separator"></span>
    <span>{{ t('nodes.current') }}:</span><b class="current-runtime-name">{{ state.currentProfile?.remarks || state.status?.currentProfileName || t('nodes.noneCurrent') }}</b>
    <span class="runtime-separator"></span>
    <label class="compact-select-label">{{ t('coreToolbar.route') }}</label>
    <select :value="state.activeRoutingId" class="compact-select route-select" @change="changeActiveRoute">
      <option value="">{{ t('common.none') }}</option>
      <option v-for="route in state.routes" :key="route.id" :value="route.id">{{ route.remarks }}</option>
    </select>
  </div>
  <div class="core-actions">
    <button class="button compact primary" :disabled="state.busy || state.status?.coreRunning || ['starting', 'stopping', 'restarting'].includes(state.status?.runtimeState)" @click="actions.coreAction('start')"><UiIcon name="play" /> {{ t('nodes.start') }}</button>
    <button class="button compact" :disabled="state.busy || !state.status?.coreRunning" @click="actions.coreAction('restart')"><UiIcon name="refresh" /> {{ t('nodes.restart') }}</button>
    <button class="button compact danger" :disabled="state.busy || (!state.status?.coreRunning && !state.status?.coreProcessIds?.length)" @click="actions.coreAction('stop')"><UiIcon name="stop" /> {{ t('nodes.stop') }}</button>
  </div>
</section>
</template>
