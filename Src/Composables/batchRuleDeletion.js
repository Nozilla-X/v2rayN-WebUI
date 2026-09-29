export async function deleteSelectedRoutingRules(options) {
  const selectedIds = [...options.selectedRuleIds]
  if (options.isDeleting() || !selectedIds.length || !options.routingId) return false

  options.setDeleting(true)
  try {
    if (!await options.confirm(options.confirmMessage)) return false

    const selected = new Set(selectedIds)
    const remainingRules = options.routingRules.filter((rule) => !selected.has(rule.id))
    const result = await options.request(`/api/settings/routing-profiles/${encodeURIComponent(options.routingId)}/rules`, {
      method: 'PUT', body: remainingRules,
    })
    options.clearSelection()
    options.showNotice(options.operationMessage(result))
    await options.loadRules()
    return true
  } catch (error) {
    options.showError(error)
    return false
  } finally {
    options.setDeleting(false)
  }
}
