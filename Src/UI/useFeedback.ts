import { nextTick, onUnmounted, ref } from 'vue'
import type { ApiError, Dict, NoticeKind, Translate } from '../Composables/types'

interface ToastEntry { id: number; message: string; kind: NoticeKind }
interface ConfirmationRequest { message: string; resolve: (confirmed: boolean) => void }

/** Local UI feedback only. The application still owns API/session orchestration. */
export function useFeedback(t: Translate, translateKey: (key?: string | null) => string) {
  const toasts = ref<ToastEntry[]>([])
  const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextToastId = 1
  const activeConfirmation = ref<ConfirmationRequest | null>(null)
  const confirmationQueue: ConfirmationRequest[] = []
  let confirmationOpen = false

  function activateNextConfirmation() {
    if (confirmationOpen || !confirmationQueue.length) return
    confirmationOpen = true
    activeConfirmation.value = confirmationQueue.shift()!
  }
  function confirmDestructive(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmationQueue.push({ message, resolve })
      activateNextConfirmation()
    })
  }
  async function resolveConfirmation(confirmed: boolean) {
    const current = activeConfirmation.value
    if (!current) return
    activeConfirmation.value = null
    current.resolve(confirmed)
    await nextTick()
    confirmationOpen = false
    activateNextConfirmation()
  }
  function dismissToast(id: number) {
    const timer = toastTimers.get(id)
    if (timer) clearTimeout(timer)
    toastTimers.delete(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }
  function showNotice(message: string, kind: NoticeKind = 'success') {
    const normalized = String(message || '').trim()
    if (!normalized) return
    const duplicate = toasts.value.find((toast) => toast.kind === kind && toast.message === normalized)
    const id = duplicate?.id ?? nextToastId++
    if (duplicate) {
      const timer = toastTimers.get(id)
      if (timer) clearTimeout(timer)
    } else {
      if (toasts.value.length >= 4) dismissToast(toasts.value[0].id)
      toasts.value = [...toasts.value, { id, message: normalized, kind }]
    }
    const timeout = kind === 'error' ? 12000 : kind === 'warning' ? 9000 : 3500
    toastTimers.set(id, setTimeout(() => dismissToast(id), timeout))
  }
  function showError(error: unknown) {
    const issue = error as ApiError
    if (issue.name === 'AbortError') return
    const baseMessage = issue.code === 'profile_group_empty'
      ? t('nodes.groupGenerationEmpty')
      : issue.messageKey ? translateKey(issue.messageKey) : issue.message || t('common.unknownError')
    const detail = (issue.data as Dict | undefined)?.detail
    showNotice(typeof detail === 'string' && detail.length > 0 ? `${baseMessage}: ${detail}` : baseMessage, 'error')
  }
  function reset() {
    activeConfirmation.value?.resolve(false)
    activeConfirmation.value = null
    for (const confirmation of confirmationQueue.splice(0)) confirmation.resolve(false)
    confirmationOpen = false
    for (const timer of toastTimers.values()) clearTimeout(timer)
    toastTimers.clear()
    toasts.value = []
  }
  onUnmounted(() => {
    for (const timer of toastTimers.values()) clearTimeout(timer)
    toastTimers.clear()
  })
  return { toasts, activeConfirmation, confirmDestructive, resolveConfirmation, dismissToast, showNotice, showError, reset }
}
