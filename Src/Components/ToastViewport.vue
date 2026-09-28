<script setup lang="ts">
import type { NoticeKind } from '../Composables/types'
import UiIcon from './UiIcon.vue'

defineProps<{
  toasts: Array<{ id: number; message: string; kind: NoticeKind }>
  closeLabel: string
}>()

const emit = defineEmits<{ dismiss: [id: number] }>()
</script>

<template>
  <div class="toast-viewport" aria-label="Notifications">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', `toast-${toast.kind}`]"
      :role="toast.kind === 'error' ? 'alert' : 'status'"
      :aria-live="toast.kind === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      <span class="toast-message">{{ toast.message }}</span>
      <button class="tool-button toast-close" type="button" :aria-label="closeLabel" @click="emit('dismiss', toast.id)">
        <UiIcon name="close" />
      </button>
    </div>
  </div>
</template>
