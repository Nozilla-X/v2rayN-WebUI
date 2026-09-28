export type Dict = Record<string, any>
export type ApiError = Error & { messageKey?: string; code?: string; data?: unknown }
export type NoticeKind = 'success' | 'info' | 'warning' | 'error'
export type Translate = (...args: any[]) => any
export type Notice = (message: string, kind?: NoticeKind) => void
export type ErrorHandler = (error: unknown) => void

export type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown }
export type RequestApi = (path: string, init?: ApiInit) => Promise<Dict>
export type DataApi = (path: string, init?: ApiInit) => Promise<any>

export interface ApiServices {
  request: RequestApi
  data: DataApi
  operationMessage: (payload: Dict, fallback?: string) => string
  queryPath: (path: string, values: Dict) => string
  canonicalCode: (value: unknown, codes: string[]) => string
  coreTypeRoute: (value: string) => string
}

export interface UiServices extends ApiServices {
  t: Translate
  translateKey: (key?: string | null) => string
  showNotice: Notice
  showError: ErrorHandler
}
