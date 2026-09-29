import type { RequestApi, ErrorHandler, Notice, Translate } from './types'

export function deleteSelectedRoutingRules(options: {
  selectedRuleIds: string[]
  routingRules: Array<Record<string, any>>
  routingId: string
  isDeleting: () => boolean
  setDeleting: (value: boolean) => void
  confirm: (message: string) => Promise<boolean>
  confirmMessage: string
  request: RequestApi
  operationMessage: (payload: Record<string, any>) => string
  showNotice: Notice
  showError: ErrorHandler
  clearSelection: () => void
  loadRules: () => Promise<void>
}): Promise<boolean>
