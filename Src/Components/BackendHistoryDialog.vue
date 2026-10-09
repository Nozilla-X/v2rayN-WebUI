<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '../Composables/useModalFocus'
import UiIcon from './UiIcon.vue'
import UiIconButton from './UI/UiIconButton.vue'
import UiButton from './UI/UiButton.vue'

const { t } = useI18n()
const props = defineProps<{ addresses: string[] }>()
const emit = defineEmits<{ select: [address: string]; remove: [address: string]; close: [] }>()
const panel = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(panel)

// Escape works even after a removal drops focus to <body>; capture also keeps it
// out of the application's global shortcut handling while this dialog is open.
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}
onMounted(() => window.addEventListener('keydown', onEscape, true))
onUnmounted(() => window.removeEventListener('keydown', onEscape, true))
</script>

<template>
  <div class="profile-picker-shade" @click.self="emit('close')">
    <section ref="panel" class="profile-picker-panel" role="dialog" aria-modal="true" :aria-label="t('backend.history')" tabindex="-1" @keydown="onModalKeydown">
      <header class="modal-head"><h2>{{ t('backend.history') }}</h2><UiIconButton type="button" :aria-label="t('common.close')" @click="emit('close')"><UiIcon name="close" /></UiIconButton></header>
      <p class="field-hint">{{ t('backend.historyPrivacy') }}</p>
      <div class="profile-picker-list">
        <div v-for="address in props.addresses" :key="address" class="history-row">
          <button class="profile-picker-choice history-choice" type="button" @click="emit('select', address)"><strong>{{ address }}</strong></button>
          <UiIconButton class="danger-text" type="button" :aria-label="t('backend.removeHistory')" :title="t('backend.removeHistory')" @click="emit('remove', address)"><UiIcon name="close" /></UiIconButton>
        </div>
        <p v-if="!props.addresses.length" class="muted empty-inline">{{ t('backend.historyEmpty') }}</p>
      </div>
      <footer class="modal-actions"><UiButton type="button" @click="emit('close')">{{ t('common.close') }}</UiButton></footer>
    </section>
  </div>
</template>
