<script setup lang="ts">
import { useI18n } from 'vue-i18n'
withDefaults(defineProps<{ label?: string; hint?: string; busy?: boolean; sticky?: boolean; submit?: boolean }>(), { label: '', hint: '', busy: false, sticky: false, submit: false })
const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
</script>

<template>
  <footer class="footer-actions settings-footer save-bar" :class="{ 'settings-global-footer': sticky }">
    <span v-if="hint" class="muted save-bar-hint">{{ hint }}</span>
    <slot />
    <button class="button primary" :type="submit ? 'submit' : 'button'" :disabled="busy" :aria-busy="busy" @click="emit('save')">{{ label || t('common.save') }}</button>
  </footer>
</template>
