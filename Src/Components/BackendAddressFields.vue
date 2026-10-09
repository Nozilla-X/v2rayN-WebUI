<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from './UiIcon.vue'
import BackendHistoryDialog from './BackendHistoryDialog.vue'

const { t } = useI18n()
const model = defineModel<string>({ default: '' })
const props = withDefaults(defineProps<{ testing: boolean; error: string; history?: string[] }>(), { history: () => [] })
const emit = defineEmits<{ apply: []; test: []; forget: [address: string] }>()
const showHistory = ref(false)
const historyTrigger = ref<HTMLButtonElement | null>(null)

function openHistory() {
  showHistory.value = true
}
async function closeHistory() {
  showHistory.value = false
  await nextTick()
  historyTrigger.value?.focus({ preventScroll: true })
}
function chooseHistory(address: string) {
  model.value = address
  emit('apply') // Reuse the existing Session cancellation/switch flow; never connects automatically.
  void closeHistory()
}
function forgetAddress(address: string) {
  emit('forget', address)
}
</script>

<template>
  <div class="backend-fields">
    <label class="field-label" for="api-endpoint">{{ t('backend.address') }}</label>
    <div class="inline-field">
      <input id="api-endpoint" v-model="model" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://api.example.com" @keydown.enter.prevent="emit('test')" />
      <button class="button" type="button" @click="emit('apply')">{{ t('backend.apply') }}</button>
      <button class="button primary" type="button" :disabled="props.testing" @click="emit('test')">{{ props.testing ? t('common.working') : t('backend.test') }}</button>
    </div>
    <p class="field-hint">{{ t('backend.hint') }}</p>
    <p v-if="props.error" class="setup-error" role="alert">{{ props.error }}</p>
    <button v-if="props.history.length" ref="historyTrigger" class="button backend-history-trigger" type="button" aria-haspopup="dialog" @click="openHistory">
      <UiIcon name="list" />{{ t('backend.history') }}<span class="count-tag">{{ props.history.length }}</span>
    </button>
    <BackendHistoryDialog v-if="showHistory" :addresses="props.history" @select="chooseHistory" @remove="forgetAddress" @close="closeHistory" />
  </div>
</template>
