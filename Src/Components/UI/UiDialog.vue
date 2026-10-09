<script setup lang="ts">
import { ref } from 'vue'
import { useModalFocus } from '../../Composables/useModalFocus'
defineProps<{ label: string; wide?: boolean }>()
const emit = defineEmits<{ close: []; submit: [event: Event] }>()
const dialog = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(dialog)
</script>

<template>
  <div class="modal-shade" @click.self="emit('close')">
    <form ref="dialog" :class="['modal-panel', { 'wide-modal': wide }, 'modal-form']" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1" @keydown="onModalKeydown" @submit="emit('submit', $event)">
      <slot name="header" />
      <div class="modal-content"><slot /></div>
      <slot name="actions" />
    </form>
  </div>
</template>
