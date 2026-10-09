import type { ApiInit, Dict, RequestApi } from './types'

export async function saveSettingsAndReload(
  request: RequestApi,
  path: string,
  init: ApiInit,
  reloadSettings: () => Promise<void>,
  loadStatus?: () => Promise<void>,
): Promise<Dict> {
  const result = await request(path, init)
  await reloadSettings()
  if (loadStatus) await loadStatus()
  return result
}
