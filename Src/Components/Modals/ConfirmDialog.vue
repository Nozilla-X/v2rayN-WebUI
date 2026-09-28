<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '../../Composables/useModalFocus'

defineProps<{ message: string }>()
const emit = defineEmits<{ resolve: [confirmed: boolean] }>()
const { t } = useI18n()
const dialog = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(dialog)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('resolve', false)
    return
  }
  onModalKeydown(event)
}
</script>

<template>
  <div class="modal-shade confirm-shade" @click.self="emit('resolve', false)">
    <section
      ref="dialog"
      class="modal-panel confirm-panel"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      tabindex="-1"
      @keydown="handleKeydown"
    >
      <header class="modal-head"><h2 id="confirm-dialog-title">{{ t('common.confirmTitle') }}</h2></header>
      <p id="confirm-dialog-message" class="confirm-message">{{ message }}</p>
      <footer class="modal-actions">
        <button class="button" type="button" @click="emit('resolve', false)">{{ t('common.cancel') }}</button>
        <button class="button danger" type="button" @click="emit('resolve', true)">{{ t('common.confirm') }}</button>
      </footer>
    </section>
  </div>
</template>
