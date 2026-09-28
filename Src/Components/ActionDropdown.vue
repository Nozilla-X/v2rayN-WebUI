<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, provide, ref } from 'vue'
import { closeActionDropdownKey } from './menuContext'
import { focusFirstMenuItem, navigateMenu } from './menuContext'
import UiIcon from './UiIcon.vue'

withDefaults(defineProps<{
  label: string
  prefix?: string
  variant?: 'default' | 'primary'
  disabled?: boolean
}>(), {
  prefix: '',
  variant: 'default',
  disabled: false,
})

const root = ref<HTMLElement | null>(null)
const popup = ref<HTMLElement | null>(null)
const open = ref(false)
const popupStyle = ref<Record<string, string>>({ left: '-10000px', top: '-10000px', visibility: 'hidden' })

function close() {
  open.value = false
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await updatePosition()
  focusFirstMenuItem(popup.value)
}

async function updatePosition() {
  await nextTick()
  const anchor = root.value?.querySelector<HTMLButtonElement>('.action-menu-trigger')?.getBoundingClientRect()
  const menu = popup.value
  if (!anchor || !menu) return
  const margin = 8
  const maxWidth = Math.max(150, window.innerWidth - margin * 2)
  const width = Math.min(menu.offsetWidth, maxWidth)
  const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin))
  const below = window.innerHeight - anchor.bottom - margin
  const above = anchor.top - margin
  const preferredHeight = Math.min(menu.scrollHeight, Math.floor(window.innerHeight * 0.68), window.innerHeight - margin * 2)
  const openBelow = below >= Math.min(preferredHeight, 180) || below >= above
  const availableHeight = Math.max(100, openBelow ? below : above)
  const height = Math.min(preferredHeight, availableHeight)
  const top = openBelow ? anchor.bottom + 3 : Math.max(margin, anchor.top - height - 3)
  popupStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${height}px`, visibility: 'visible' }
}

function onResize() {
  if (open.value) void updatePosition()
}

provide(closeActionDropdownKey, close)

function closeFromClick(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.menu-stay-open, .menu-submenu-toggle')) return
  close()
}

function onPointerDown(event: PointerEvent) {
  if (event.target instanceof Element && event.target.closest('.flyout-menu-popup')) return
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}

function onMenuEscape() {
  close()
  root.value?.querySelector<HTMLButtonElement>('.action-menu-trigger')?.focus()
}

function onPopupKeydown(event: KeyboardEvent) {
  navigateMenu(event, popup.value)
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onResize)
  document.addEventListener('scroll', onResize, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('scroll', onResize, true)
})
</script>

<template>
  <div ref="root" class="action-dropdown" :class="{ open }">
    <button
      type="button"
      class="button action-menu-trigger"
      :class="{ primary: variant === 'primary' }"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <UiIcon v-if="prefix === 'plus'" name="plus" />
      {{ label }}<UiIcon class="menu-caret" name="chevron-down" :size="12" />
    </button>
    <div v-if="open" ref="popup" class="action-menu-popup" :style="popupStyle" role="menu" @keydown="onPopupKeydown" @menu-escape.stop="onMenuEscape" @click="closeFromClick">
      <slot />
    </div>
  </div>
</template>
