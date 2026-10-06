<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '../Composables/useModalFocus'
import UiIcon from './UiIcon.vue'

const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(panel)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  onModalKeydown(event)
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-shade core-panel-shade" @click.self="emit('close')">
      <section ref="panel" class="modal-panel core-panel" role="dialog" aria-modal="true" aria-labelledby="core-panel-title" tabindex="-1" @keydown="handleKeydown">
        <header class="modal-head">
          <h2 id="core-panel-title">{{ t('header.coreStatus') }}</h2>
          <button type="button" class="tool-button" :aria-label="t('common.close')" @click="emit('close')"><UiIcon name="close" /></button>
        </header>
        <div class="core-panel-content"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
