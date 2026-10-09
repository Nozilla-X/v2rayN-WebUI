<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from './UiIcon.vue'

const { t } = useI18n()
const model = defineModel<string>({ default: '' })
const props = withDefaults(defineProps<{ testing: boolean; error: string; history?: string[] }>(), { history: () => [] })
const emit = defineEmits<{ apply: []; test: []; forget: [address: string] }>()
const open = ref(false)
const combo = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const toggle = ref<HTMLButtonElement | null>(null)

function closeMenu() {
  open.value = false
}
function toggleMenu() {
  if (props.history.length) open.value = !open.value
}
function chooseHistory(address: string) {
  model.value = address
  emit('apply') // Reuse the existing Session cancellation/switch flow; never connects automatically.
  closeMenu()
  input.value?.focus({ preventScroll: true })
}
function forgetAddress(address: string) {
  emit('forget', address)
}
function onPointerDown(event: PointerEvent) {
  if (event.target instanceof Node && !combo.value?.contains(event.target)) closeMenu()
}
function onWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closeMenu()
  toggle.value?.focus({ preventScroll: true })
}
watch(open, value => {
  if (value) {
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onWindowKeydown, true)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('keydown', onWindowKeydown, true)
  }
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('keydown', onWindowKeydown, true)
})
</script>

<template>
  <div class="backend-fields">
    <label class="field-label" for="api-endpoint">{{ t('backend.address') }}</label>
    <div class="inline-field">
      <div ref="combo" class="combo">
        <input id="api-endpoint" ref="input" v-model="model" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://api.example.com" aria-haspopup="menu" :aria-expanded="open" aria-controls="backend-history-menu" @keydown.enter.prevent="emit('test')" @keydown.down.prevent="open = Boolean(props.history.length)" />
        <button v-if="props.history.length" ref="toggle" class="combo-toggle" type="button" :aria-label="t('backend.history')" :title="t('backend.history')" aria-haspopup="menu" aria-controls="backend-history-menu" :aria-expanded="open" @click="toggleMenu"><UiIcon name="chevron-down" /></button>
        <div v-if="open" id="backend-history-menu" class="combo-menu" role="menu" :aria-label="t('backend.history')">
          <div v-for="address in props.history" :key="address" class="history-row">
            <button class="action-menu-item history-choice" type="button" role="menuitem" :title="address" @click="chooseHistory(address)">{{ address }}</button>
            <button class="tool-button danger-text" type="button" role="menuitem" :aria-label="t('backend.removeHistory')" :title="t('backend.removeHistory')" @click="forgetAddress(address)"><UiIcon name="close" /></button>
          </div>
          <p v-if="!props.history.length" class="muted empty-inline">{{ t('backend.historyEmpty') }}</p>
          <p class="field-hint history-note">{{ t('backend.historyPrivacy') }}</p>
        </div>
      </div>
      <button class="button" type="button" @click="emit('apply')">{{ t('backend.apply') }}</button>
      <button class="button primary" type="button" :disabled="props.testing" @click="emit('test')">{{ props.testing ? t('common.working') : t('backend.test') }}</button>
    </div>
    <p class="field-hint">{{ t('backend.hint') }}</p>
    <p v-if="props.error" class="setup-error" role="alert">{{ props.error }}</p>
  </div>
</template>
