<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const model = defineModel<string>({ default: '' })
const props = defineProps<{ testing: boolean; error: string }>()
const emit = defineEmits<{ apply: []; test: [] }>()
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
  </div>
</template>
