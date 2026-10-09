<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Dict } from '../../Composables/types'
import type { UiProps } from '../../Components/types'
import type { useNodeActions } from './useNodeActions'
import { navigateMenu } from '../../Components/menuContext'
import { preventNativeContextMenu } from '../../Components/contextMenu'
import FlyoutMenu from '../../Components/FlyoutMenu.vue'

const { t } = useI18n()
const contextMenu = defineModel<Dict | null>({ required: true })
const props = defineProps<UiProps & { contextActions: ReturnType<typeof useNodeActions>['contextActions'] }>()
const nodesPageState = props.state
const nodesPageActions = props.actions
const { selectContextProfile, editContextProfile, copySelectedNodes, deleteSelectedNodes, testSelectedNodes, moveSelectedNodes, selectAllNodes, shareSelectedNodes, copySelectedShareLinks, editSubscriptionFromContext, addSubscriptionFromContext, deleteSubscriptionFromContext } = props.contextActions
const contextMenuElement = ref<HTMLElement | null>(null)
const contextMenuPlacement = ref({ left: '-10000px', top: '-10000px' })

function positionContextMenu(menu: Dict) {
  const element = contextMenuElement.value
  if (!element) return
  const margin = 8
  const width = element.offsetWidth
  const height = element.offsetHeight
  const left = Math.max(margin, Math.min(Number(menu.x) || 0, window.innerWidth - width - margin))
  const top = Math.max(margin, Math.min(Number(menu.y) || 0, window.innerHeight - height - margin))
  contextMenuPlacement.value = { left: `${left}px`, top: `${top}px` }
}
function positionOpenContextMenu() { if (contextMenu.value) positionContextMenu(contextMenu.value) }
watch(contextMenu, async (menu) => {
  if (!menu) return
  contextMenuPlacement.value = { left: '-10000px', top: '-10000px' }
  await nextTick()
  positionContextMenu(menu)
  contextMenuElement.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true })
})
onMounted(() => window.addEventListener('resize', positionOpenContextMenu))
onUnmounted(() => window.removeEventListener('resize', positionOpenContextMenu))
</script>

<template>
  <div v-if="contextMenu" ref="contextMenuElement" class="context-menu" :style="contextMenuPlacement" role="menu" @keydown="navigateMenu($event, contextMenuElement)" @click="contextMenu = null" @contextmenu="preventNativeContextMenu">
    <template v-if="contextMenu.type === 'subscription'">
      <button role="menuitem" :disabled="!contextMenu.group.id" @click="editSubscriptionFromContext">{{ t('nodes.groupEdit') }}</button>
      <button role="menuitem" @click="addSubscriptionFromContext">{{ t('nodes.groupAdd') }}</button>
      <button role="menuitem" class="danger-text" :disabled="!contextMenu.group.id" @click="deleteSubscriptionFromContext">{{ t('nodes.groupDelete') }}</button>
    </template>
    <template v-else>
      <button role="menuitem" :disabled="contextMenu.profile.isCurrent" @click="selectContextProfile">{{ contextMenu.profile.isCurrent ? t('nodes.current') : t('nodes.switch') }}<span class="menu-shortcut">Enter</span></button>
      <button role="menuitem" @click="editContextProfile">{{ t('common.edit') }}<span class="menu-shortcut">E</span></button>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="copySelectedNodes">{{ t('nodes.copySelected') }}</button>
      <button role="menuitem" class="danger-text" :disabled="!nodesPageState.selectedIds.length" @click="deleteSelectedNodes">{{ t('nodes.removeSelected') }}<span class="menu-shortcut">Delete</span></button>
      <button role="menuitem" @click="nodesPageActions.runProfileAction('deduplicate')">{{ t('nodes.deduplicate') }}</button>
      <button role="menuitem" @click="nodesPageActions.runProfileAction('remove-invalid')">{{ t('nodes.removeInvalid') }}</button>
      <div class="context-separator"></div>
      <FlyoutMenu context :label="t('nodes.testMenu')" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" @click="testSelectedNodes('tcping')">{{ t('nodes.tcping') }}<span class="menu-shortcut">1</span></button>
        <button class="action-menu-item" role="menuitem" @click="testSelectedNodes('realping')">{{ t('nodes.realping') }}<span class="menu-shortcut">2</span></button>
        <button class="action-menu-item" role="menuitem" @click="testSelectedNodes('speedtest')">{{ t('nodes.speedtest') }}<span class="menu-shortcut">3</span></button>
        <button class="action-menu-item" role="menuitem" @click="testSelectedNodes('udpTest')">{{ t('nodes.udp') }}<span class="menu-shortcut">4</span></button>
        <button class="action-menu-item" role="menuitem" @click="testSelectedNodes('fastRealping')">{{ t('nodes.fastRealping') }}<span class="menu-shortcut">5</span></button>
        <button class="action-menu-item" role="menuitem" @click="testSelectedNodes('mixedtest')">{{ t('nodes.mixedtest') }}<span class="menu-shortcut">6</span></button>
        <div class="action-menu-separator" role="separator"></div>
        <button class="action-menu-item" role="menuitem" @click="nodesPageActions.sortProfiles('DelayVal')">{{ t('nodes.sortByTestResults') }}</button>
      </FlyoutMenu>
      <div class="context-separator"></div>
      <FlyoutMenu context :label="t('nodes.moveGroup')" :disabled="!nodesPageState.selectedIds.length" @select="contextMenu = null">
        <button v-for="group in nodesPageState.groups" :key="group.id || 'all-target'" class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.moveSelectedToGroup(group.id)">{{ group.name || t('common.allGroups') }}</button>
      </FlyoutMenu>
      <FlyoutMenu context :label="t('nodes.move')" :disabled="!nodesPageState.selectedIds.length" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('top')">{{ t('nodes.top') }}<span class="menu-shortcut">T</span></button>
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('up')">{{ t('nodes.up') }}<span class="menu-shortcut">U</span></button>
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('down')">{{ t('nodes.down') }}<span class="menu-shortcut">D</span></button>
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('bottom')">{{ t('nodes.bottom') }}<span class="menu-shortcut">B</span></button>
      </FlyoutMenu>
      <button role="menuitem" :disabled="!nodesPageState.filteredProfiles.length" @click="selectAllNodes">{{ t('nodes.selectAll') }}<span class="menu-shortcut">A</span></button>
      <div class="context-separator"></div>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="shareSelectedNodes">{{ t('nodes.shareProfile') }}<span class="menu-shortcut">S</span></button>
      <FlyoutMenu context :label="t('nodes.exportMenu')" :disabled="!nodesPageState.selectedIds.length" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportFullConfig">{{ t('nodes.exportFullConfig') }}</button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportFullConfigToClipboard">{{ t('nodes.exportFullConfigClipboard') }}</button>
        <div class="action-menu-separator" role="separator"></div>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="copySelectedShareLinks">{{ t('nodes.exportShareLinkClipboard') }}<span class="menu-shortcut">C</span></button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportShareLinksBase64">{{ t('nodes.exportShareLinkBase64') }}</button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportInnerUris">{{ t('nodes.exportInnerUri') }}</button>
      </FlyoutMenu>
      <div class="context-separator"></div>
      <FlyoutMenu context :label="t('nodes.generatePolicyGroups')" :disabled="!nodesPageState.selectedGroup" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedGroup" @click="nodesPageActions.generateGroups(false)">{{ t('nodes.allProfiles') }}</button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedGroup || !nodesPageState.profiles.length" @click="nodesPageActions.generateGroups(true)">{{ t('nodes.generateRegionGroups') }}</button>
      </FlyoutMenu>
      <div class="context-separator"></div>
      <div class="context-web-only-label">{{ t('nodes.webOnlyActions') }}</div>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.moveSelectedPosition">{{ t('nodes.position') }}…</button>
      <button role="menuitem" :disabled="!nodesPageState.operations.includes('speedtest')" @click="nodesPageActions.stopSpeedTests">{{ t('nodes.stopTest') }}</button>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportSelected">{{ t('nodes.customExport') }}…</button>
    </template>
  </div>
</template>
