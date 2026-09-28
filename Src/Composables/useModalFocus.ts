import { nextTick, onMounted, onUnmounted, type Ref } from 'vue'

export function useModalFocus(panel: Ref<HTMLElement | null>) {
  let returnFocus: HTMLElement | null = null

  onMounted(async () => {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    const dialog = panel.value
    const firstField = dialog?.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)')
    const firstFocusable = firstField || dialog?.querySelector<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')
    firstFocusable?.focus({ preventScroll: true })
  })

  function onModalKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return
    const dialog = panel.value
    if (!dialog) return
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0)
    if (!focusable.length) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  onUnmounted(() => {
    if (returnFocus?.isConnected && returnFocus !== document.body && returnFocus !== document.documentElement) {
      returnFocus.focus({ preventScroll: true })
      return
    }
    const selectedProfile = document.querySelector<HTMLElement>('.profile-table tbody tr.selected')
    if (selectedProfile) {
      selectedProfile.focus({ preventScroll: true })
      return
    }
    document.querySelector<HTMLElement>('.page-toolbar button')?.focus({ preventScroll: true })
  })

  return { onModalKeydown }
}
