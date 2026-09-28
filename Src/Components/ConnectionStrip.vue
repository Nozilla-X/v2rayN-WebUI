<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UiProps } from './types'
import UiIcon from './UiIcon.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
</script>

<template>
<section class="connection-strip">
  <div class="listener-list">
    <strong>{{ t('nodes.listener') }}</strong>
    <span v-for="listener in state.listeners" :key="listener.name" class="listener-item">
      <i :class="['status-led', { on: listener.listening }]"></i>{{ listener.name === 'lan' ? t('nodes.lan') : t('nodes.local') }} {{ actions.listenerDescription(listener) }}
    </span>
    <span v-if="!state.listeners.length" class="muted">{{ t('coreToolbar.noListener') }}</span>
  </div>
  <div class="traffic-list">
    <strong>{{ t('nodes.traffic') }}</strong>
    <span><UiIcon name="arrow-up" :size="11" /> {{ t('nodes.proxyUp') }} <b>{{ actions.formatBytes(state.traffic.proxyUp) }}/s</b></span>
    <span><UiIcon name="arrow-down" :size="11" /> {{ t('nodes.proxyDown') }} <b>{{ actions.formatBytes(state.traffic.proxyDown) }}/s</b></span>
    <span class="muted">{{ t('nodes.directUp') }} {{ actions.formatBytes(state.traffic.directUp) }}/s · {{ t('nodes.directDown') }} {{ actions.formatBytes(state.traffic.directDown) }}/s</span>
  </div>
  <span v-if="state.status && !state.status.statisticsEnabled" class="stats-hint">{{ t('coreToolbar.statsDisabled') }}</span>
  <span v-if="state.runtimeVersion" class="runtime-version">{{ state.runtimeVersion }}</span>
</section>
</template>
