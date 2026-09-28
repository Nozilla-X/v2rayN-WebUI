<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
const props = defineProps<{ disabled?: boolean; ariaLabel?: string }>()
const emit = defineEmits<{ change: [checked: boolean] }>()

function onChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  model.value = checked
  emit('change', checked)
}
</script>

<template>
  <input
    v-bind="$attrs"
    class="ui-checkbox"
    type="checkbox"
    :checked="model"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    @change="onChange"
  />
</template>
