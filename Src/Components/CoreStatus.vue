<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiState, UiActions } from './types'
import CorePanel from './CorePanel.vue'
import RuntimeStrip from './RuntimeStrip.vue'
import ConnectionStrip from './ConnectionStrip.vue'

const { t } = useI18n()
const props = defineProps<{
  runtimeState: UiState
  runtimeActions: UiActions
  connectionState: UiState
  connectionActions: UiActions
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()
const query = window.matchMedia('(max-width: 760px)')
const mobile = ref(query.matches)
const nodeName = computed(() => props.runtimeState.currentProfile?.remarks || props.runtimeState.status?.currentProfileName || t('nodes.noneCurrent'))
const runtimeStatus = computed(() => props.runtimeState.status?.runtimeFailure ? 'faulted' : props.runtimeState.status?.runtimeState || (props.runtimeState.status?.coreRunning ? 'running' : 'stopped'))

function updateViewport() {
  mobile.value = query.matches
  if (!mobile.value) emit('close')
}
onMounted(() => query.addEventListener('change', updateViewport))
onUnmounted(() => query.removeEventListener('change', updateViewport))
</script>

<template>
  <section v-if="mobile" class="mobile-core-summary" role="status">
    <span :class="['status-led', { on: runtimeState.status?.coreRunning }]" aria-hidden="true"></span>
    <strong :class="{ 'danger-text': runtimeStatus === 'faulted' }">{{ t(`core.runtime.${runtimeStatus}`) }}</strong>
    <span class="mobile-core-node" :title="nodeName" :aria-label="`${t('nodes.current')}: ${nodeName}`">{{ nodeName }}</span>
  </section>
  <component v-if="!mobile || open" :is="mobile ? CorePanel : 'div'" v-bind="mobile ? {} : { class: 'core-status-host' }" @close="emit('close')">
    <RuntimeStrip :state="runtimeState" :actions="runtimeActions" />
    <ConnectionStrip :state="connectionState" :actions="connectionActions" />
  </component>
</template>
