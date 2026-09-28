<script setup lang="ts">
import { inject, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { closeActionDropdownKey } from './menuContext'
import { focusFirstMenuItem, navigateMenu } from './menuContext'
import UiIcon from './UiIcon.vue'

const props = withDefaults(defineProps<{
  label: string
  title?: string
  disabled?: boolean
  context?: boolean
}>(), {
  title: '',
  disabled: false,
  context: false,
})

const emit = defineEmits<{ select: [] }>()
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const panelStyle = ref<Record<string, string>>({ left: '-10000px', top: '-10000px', visibility: 'hidden' })
const closeActionDropdown = inject(closeActionDropdownKey, null)

async function updatePosition() {
  await nextTick()
  const anchor = trigger.value?.getBoundingClientRect()
  const menu = panel.value
  if (!anchor || !menu) return

  const margin = 8
  const gap = 4
  const maxWidth = Math.max(150, window.innerWidth - margin * 2)
  const preferredWidth = Math.min(menu.offsetWidth, maxWidth)
  const spaceRight = window.innerWidth - margin - anchor.right - gap
  const spaceLeft = anchor.left - gap - margin
  const openRight = spaceRight >= Math.min(preferredWidth, 180) || spaceRight >= spaceLeft
  const availableSpace = Math.max(150, openRight ? spaceRight : spaceLeft)
  const width = Math.min(preferredWidth, availableSpace)
  menu.style.width = `${width}px`
  let left = openRight ? anchor.right + gap : anchor.left - width - gap
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
  const preferredHeight = Math.min(menu.scrollHeight, Math.floor(window.innerHeight * 0.48), window.innerHeight - margin * 2)
  const below = window.innerHeight - anchor.top - margin
  const above = anchor.bottom - margin
  const alignBottom = below < Math.min(preferredHeight, 180) && above > below
  const availableHeight = Math.max(100, alignBottom ? above : below)
  const height = Math.min(preferredHeight, availableHeight)
  const top = alignBottom ? anchor.bottom - height : Math.max(margin, anchor.top)
  panelStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${height}px`, visibility: 'visible' }
}

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    await updatePosition()
    focusFirstMenuItem(panel.value)
  }
}

function close() {
  open.value = false
}

function onPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Node)) return
  if (trigger.value?.contains(event.target) || panel.value?.contains(event.target)) return
  close()
}

function onMenuEscape() {
  close()
  trigger.value?.focus()
}

function onPanelKeydown(event: KeyboardEvent) {
  navigateMenu(event, panel.value)
}

function onPanelClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element) || target.closest('.menu-stay-open, .menu-submenu-toggle')) return
  close()
  closeActionDropdown?.()
  emit('select')
}

function onResize() {
  if (open.value) void updatePosition()
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
  <div class="flyout-menu" :class="{ disabled }">
    <button
      ref="trigger"
      type="button"
      class="action-menu-item menu-submenu-toggle flyout-menu-trigger"
      :class="{ 'context-flyout-trigger': context }"
      :disabled="disabled"
      :title="title"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      {{ label }}<UiIcon class="submenu-caret" name="chevron-right" :size="12" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="action-menu-popup flyout-menu-popup"
        :class="{ 'context-submenu-list': context }"
        :style="panelStyle"
        role="menu"
        @keydown="onPanelKeydown"
        @menu-escape.stop="onMenuEscape"
        @click.stop="onPanelClick"
      >
        <slot />
      </div>
    </Teleport>
  </div>
</template>
