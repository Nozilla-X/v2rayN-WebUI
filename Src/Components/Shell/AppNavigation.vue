<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiIcon from '../UiIcon.vue'
import ActionDropdown from '../ActionDropdown.vue'
const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
</script>

<template>
  <nav class="main-nav" :aria-label="t('brand')">
    <button v-for="(item, index) in state.navItems" :key="item.id" :class="['nav-tab', { selected: state.activePage === item.id, 'secondary-nav': Number(index) > 2 }]" :aria-current="state.activePage === item.id ? 'page' : undefined" @click="actions.navigate(item.id)">
      <UiIcon class="nav-icon" :name="item.icon" />{{ t(item.key) }}
      <span v-if="item.id === 'subscriptions'" class="nav-badge">{{ state.subscriptions.length }}</span>
    </button>
    <ActionDropdown class="mobile-nav-more" prefix="more" :class="{ selected: state.navItems.slice(3).some((item: any) => item.id === state.activePage) }" :label="t('header.more')">
      <button v-for="item in state.navItems.slice(3)" :key="item.id" class="action-menu-item" role="menuitem" :aria-current="state.activePage === item.id ? 'page' : undefined" @click="actions.navigate(item.id)"><UiIcon :name="item.icon" />{{ t(item.key) }}</button>
    </ActionDropdown>
  </nav>
</template>
