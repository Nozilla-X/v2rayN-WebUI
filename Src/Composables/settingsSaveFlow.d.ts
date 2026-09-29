import type { ApiInit, Dict, RequestApi } from './types'

export function saveSettingsAndReload(
  request: RequestApi,
  path: string,
  init: ApiInit,
  reloadSettings: () => Promise<void>,
  loadStatus?: () => Promise<void>,
): Promise<Dict>
