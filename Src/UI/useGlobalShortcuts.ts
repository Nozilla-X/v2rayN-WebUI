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
    if (event.isComposing) return
    if (closeTopLayerOnEscape(event)) return
    if (options.activePage.value !== 'nodes' || isEditableTarget(event.target)) return
    if (document.querySelector('.modal-shade, .context-menu, .action-menu-popup')) return
    if (!(event.target instanceof Element) || !event.target.closest('.profile-table [data-profile-id]')) return
    // Browser/OS shortcuts cannot all be canceled (e.g. Ctrl+T). Never bind them.
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
    const key = event.key.toLowerCase()
    let handled = true
    const actions = options.nodes
    switch (key) {
      case 'a': actions.selectAllNodes(); break
      case 'c': actions.copySelectedShareLinks(); break
      case 'e': actions.editContextProfile(); break
      case 's': actions.shareSelectedNodes(); break
      case '1': actions.testSelectedNodes('tcping'); break
      case '2': actions.testSelectedNodes('realping'); break
      case '3': actions.testSelectedNodes('speedtest'); break
      case '4': actions.testSelectedNodes('udpTest'); break
      case '5': actions.testSelectedNodes('fastRealping'); break
      case '6': actions.testSelectedNodes('mixedtest'); break
      case 'enter': actions.selectContextProfile(); break
      case 'delete': actions.deleteSelectedNodes(); break
      case 't': actions.moveSelectedNodes('top'); break
      case 'u': actions.moveSelectedNodes('up'); break
      case 'd': actions.moveSelectedNodes('down'); break
      case 'b': actions.moveSelectedNodes('bottom'); break
      default: handled = false
    }
    if (handled) event.preventDefault()
  }
  onMounted(() => document.addEventListener('keydown', handleGlobalKeydown, true))
  onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown, true))
  return { handleGlobalKeydown, closeTopLayerOnEscape }
}
