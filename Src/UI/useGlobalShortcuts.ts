import { nextTick, onMounted, onUnmounted, type Ref } from 'vue'
import type { Dict } from '../Composables/types'
import type { useNodeActions } from '../Features/Profiles/useNodeActions'

export function useGlobalShortcuts(options: {
  activePage: Ref<string>
  contextMenu: Ref<Dict | null>
  confirmationOpen: () => boolean
  cancelConfirmation: () => Promise<void>
  /** Priority is deliberately the same as the former App.vue Escape chain. */
  modalLayers: Array<{ isOpen: () => boolean; close: () => void }>
  nodes: ReturnType<typeof useNodeActions>['contextActions']
}) {
  function isEditableTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('button, a[href], summary, input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
  }
  function closeTopLayerOnEscape(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape') return false
    if (options.confirmationOpen()) {
      void options.cancelConfirmation()
      event.preventDefault()
      event.stopImmediatePropagation()
      return true
    }
    const flyout = document.querySelector<HTMLElement>('.flyout-menu-popup')
    if (flyout) flyout.dispatchEvent(new Event('menu-escape', { bubbles: true }))
    else {
      const dropdown = document.querySelector<HTMLElement>('.action-menu-popup:not(.flyout-menu-popup)')
      if (dropdown) dropdown.dispatchEvent(new Event('menu-escape', { bubbles: true }))
      else if (options.contextMenu.value) {
        const profileId = options.contextMenu.value.profile?.indexId
        options.contextMenu.value = null
        void nextTick(() => {
          const row = [...document.querySelectorAll<HTMLElement>('[data-profile-id]')].find((item) => item.dataset.profileId === profileId)
          row?.focus({ preventScroll: true })
        })
      } else {
        const layer = options.modalLayers.find((layer) => layer.isOpen())
        if (!layer) return false
        layer.close()
      }
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }
  function handleGlobalKeydown(event: KeyboardEvent) {
    if (closeTopLayerOnEscape(event)) return
    if (options.activePage.value !== 'nodes' || isEditableTarget(event.target)) return
    if (document.querySelector('.modal-shade, .context-menu, .action-menu-popup')) return
    const key = event.key.toLowerCase()
    const control = event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey
    let handled = true
    const actions = options.nodes
    if (control) {
      switch (key) {
        case 'a': actions.selectAllNodes(); break
        case 'c': actions.copySelectedShareLinks(); break
        case 'd': actions.editContextProfile(); break
        case 'f': actions.shareSelectedNodes(); break
        case 'o': actions.testSelectedNodes('tcping'); break
        case 'r': actions.testSelectedNodes('realping'); break
        case 't': actions.testSelectedNodes('speedtest'); break
        default: handled = false
      }
    } else if (!event.ctrlKey && !event.altKey && !event.metaKey) {
      switch (key) {
        case 'enter': actions.selectContextProfile(); break
        case 'backspace':
        case 'delete': actions.deleteSelectedNodes(); break
        case 't': actions.moveSelectedNodes('top'); break
        case 'u': actions.moveSelectedNodes('up'); break
        case 'd': actions.moveSelectedNodes('down'); break
        case 'b': actions.moveSelectedNodes('bottom'); break
        default: handled = false
      }
    } else handled = false
    if (handled) event.preventDefault()
  }
  onMounted(() => document.addEventListener('keydown', handleGlobalKeydown, true))
  onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown, true))
  return { handleGlobalKeydown, closeTopLayerOnEscape }
}
