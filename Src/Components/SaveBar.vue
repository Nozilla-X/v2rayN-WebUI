<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiButton from './UI/UiButton.vue'
withDefaults(defineProps<{ label?: string; busy?: boolean; sticky?: boolean; submit?: boolean; dirty?: boolean }>(), { label: '', busy: false, sticky: false, submit: false })
const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
</script>

<template>
  <footer class="footer-actions settings-footer save-bar" :class="{ 'settings-global-footer': sticky }">
    <span v-if="dirty !== undefined" class="draft-status" :class="{ dirty }" role="status">{{ t(busy ? 'polish.saving' : dirty ? 'polish.unsaved' : 'polish.saved') }}</span>
    <slot />
    <UiButton class="primary" :type="submit ? 'submit' : 'button'" :disabled="busy" :aria-busy="busy" @click="emit('save')">{{ label || t('common.save') }}</UiButton>
  </footer>
</template>
