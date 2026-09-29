export async function saveSettingsAndReload(request, path, init, reloadSettings, loadStatus) {
  const result = await request(path, init)
  await reloadSettings()
  if (loadStatus) await loadStatus()
  return result
}
