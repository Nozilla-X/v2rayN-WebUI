<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
defineProps<{ ready: boolean; authenticated: boolean }>()
const emit = defineEmits<{ dismissContext: [] }>()
</script>

<template>
  <div class="app-shell" @click="emit('dismissContext')">
    <a v-if="ready && authenticated" class="skip-link" href="#workspace">{{ t('polish.skipContent') }}</a>
    <slot v-if="!ready" name="setup" />
    <template v-else>
      <slot name="header" />
      <slot v-if="!authenticated" name="login" />
      <template v-else>
        <slot name="status" />
        <main id="workspace" class="workspace" tabindex="-1"><slot /></main>
      </template>
      <slot name="overlays" />
    </template>
    <slot name="feedback" />
  </div>
</template>
