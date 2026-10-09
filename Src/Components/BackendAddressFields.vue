<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import UiIcon from './UiIcon.vue'

const { t } = useI18n()
const model = defineModel<string>({ default: '' })
const props = withDefaults(defineProps<{ testing: boolean; error: string; history?: string[] }>(), { history: () => [] })
const emit = defineEmits<{ apply: []; test: []; forget: [address: string] }>()
function selectHistory(event: Event) {
  const address = (event.target as HTMLSelectElement).value
  if (!address) return
  model.value = address
  emit('apply') // Reuse the original Session cancellation/switch flow; do not auto-connect.
}
async function forgetCurrent() {
  emit('forget', model.value)
  await nextTick()
  document.getElementById('api-endpoint')?.focus()
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
    <div v-if="props.history.length" class="backend-history">
      <label class="field-label" for="backend-history">{{ t('backend.history') }}</label>
      <div class="inline-field">
        <select id="backend-history" :value="props.history.includes(model) ? model : ''" :aria-label="t('backend.history')" @change="selectHistory">
          <option value="" disabled>{{ t('backend.chooseHistory') }}</option>
          <option v-for="address in props.history" :key="address" :value="address" :title="address">{{ address }}</option>
        </select>
        <button class="tool-button danger-text" type="button" :disabled="!props.history.includes(model)" :aria-label="t('backend.removeHistory')" :title="t('backend.removeHistory')" @click="forgetCurrent"><UiIcon name="close" /></button>
      </div>
      <p class="field-hint">{{ t('backend.historyPrivacy') }}</p>
    </div>
    <p v-if="props.error" class="setup-error" role="alert">{{ props.error }}</p>
  </div>
</template>
