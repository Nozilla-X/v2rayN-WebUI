<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from './types'
import UiIcon from './UiIcon.vue'
import ActionDropdown from './ActionDropdown.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const controls = ref<HTMLElement | null>(null)
const controlsOpen = ref(false)
const desktop = window.matchMedia('(min-width: 761px)')
function syncControls() {
  controlsOpen.value = false
}
function openCorePanel() {
  controlsOpen.value = false
  controls.value?.querySelector<HTMLButtonElement>('.header-more')?.focus()
  actions.openCorePanel()
}

function closeControls(event: PointerEvent) {
  if (!desktop.matches && event.target instanceof Node && !controls.value?.contains(event.target)) controlsOpen.value = false
}
function escapeControls(event: KeyboardEvent) {
  if (!desktop.matches && event.key === 'Escape' && controlsOpen.value) {
    controlsOpen.value = false
    controls.value?.querySelector<HTMLButtonElement>('.header-more')?.focus()
  }
}
watch(() => state.authenticated, syncControls)
onMounted(() => {
  syncControls()
  desktop.addEventListener('change', syncControls)
  document.addEventListener('pointerdown', closeControls)
  document.addEventListener('keydown', escapeControls)
})
onUnmounted(() => {
  desktop.removeEventListener('change', syncControls)
  document.removeEventListener('pointerdown', closeControls)
  document.removeEventListener('keydown', escapeControls)
})
</script>

<template>
<header class="app-header">
  <div class="brand" :class="{ unauthenticated: !state.authenticated }"><img class="brand-glyph" :src="state.brandIconSrc" :title="state.brandIconTitle" alt="" /><strong>{{ t('brand') }}</strong></div>
  <nav v-if="state.authenticated" class="main-nav" :aria-label="t('brand')">
    <button v-for="(item, index) in state.navItems" :key="item.id" :class="['nav-tab', { selected: state.activePage === item.id, 'secondary-nav': Number(index) > 2 }]" :aria-current="state.activePage === item.id ? 'page' : undefined" @click="actions.navigate(item.id)">
      <UiIcon class="nav-icon" :name="item.icon" />{{ t(item.key) }}
      <span v-if="item.id === 'subscriptions'" class="nav-badge">{{ state.subscriptions.length }}</span>
    </button>
    <ActionDropdown class="mobile-nav-more" :class="{ selected: state.navItems.slice(3).some((item: any) => item.id === state.activePage) }" :label="t('header.more')">
      <button v-for="item in state.navItems.slice(3)" :key="item.id" class="action-menu-item" role="menuitem" :aria-current="state.activePage === item.id ? 'page' : undefined" @click="actions.navigate(item.id)"><UiIcon :name="item.icon" />{{ t(item.key) }}</button>
    </ActionDropdown>
  </nav>
  <div ref="controls" class="header-controls" :class="{ open: controlsOpen }">
    <button type="button" class="tool-button header-more" :aria-label="t('header.more')" :aria-expanded="controlsOpen" aria-controls="global-controls" @click="controlsOpen = !controlsOpen"><UiIcon name="more" /></button>
    <div id="global-controls" class="header-right">
    <span :class="['connection-tag', { online: state.authenticated }]">{{ state.authenticated ? t('auth.connected') : t('auth.waiting') }}</span>
    <button v-if="state.authenticated" type="button" class="button mobile-core-entry" @click="openCorePanel"><UiIcon name="settings" />{{ t('header.coreStatus') }}</button>
    <label class="header-control-field"><span>{{ t('header.language') }}</span><select v-model="state.locale" class="locale-select" :aria-label="t('header.language')">
      <option value="zh-CN">{{ t('localeNames.zhCN') }}</option><option value="zh-TW">{{ t('localeNames.zhTW') }}</option><option value="en-US">{{ t('localeNames.enUS') }}</option>
    </select></label>
    <label class="header-control-field"><span>{{ t('theme.label') }}</span><select :value="state.themePreference" class="theme-select" :aria-label="t('theme.label')" @change="actions.setTheme(($event.target as HTMLSelectElement).value)">
      <option value="system">{{ t('theme.system') }}</option><option value="light">{{ t('theme.light') }}</option><option value="dark">{{ t('theme.dark') }}</option>
    </select></label>
    <button v-if="state.authenticated" class="tool-button" :aria-label="t('common.refresh')" :title="t('common.refresh')" :disabled="state.loading" @click="actions.refreshBase"><UiIcon name="refresh" /></button>
    <button v-if="state.authenticated" class="tool-button" @click="actions.disconnect">{{ t('auth.disconnect') }}</button>
  </div>
  </div>
</header>
</template>
