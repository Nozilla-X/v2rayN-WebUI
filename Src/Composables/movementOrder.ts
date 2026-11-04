export function planSelectedMoves(orderedIds: readonly string[], selectedIds: readonly string[], direction: string): string[] {
  const selected = new Set(selectedIds)
  const order = [...orderedIds]
  const items = order.filter((id) => selected.has(id))
  const move = direction.toLowerCase()
  if (move === 'top') return items.reverse()
  if (move === 'bottom') return items
  if (move !== 'up' && move !== 'down') return items

  if (move === 'down') items.reverse()
  const moves: string[] = []
  for (const id of items) {
    const index = order.indexOf(id)
    const next = index + (move === 'up' ? -1 : 1)
    // A block already at an edge must not move through another selected item.
    if (next < 0 || next >= order.length || selected.has(order[next])) continue
    ;[order[index], order[next]] = [order[next], order[index]]
    moves.push(id)
  }
  return moves
}

export function planSelectedPositionMoves(
  orderedIds: readonly string[],
  selectedIds: readonly string[],
  targetPosition: number,
): Array<{ id: string; position: number }> {
  const selected = new Set(selectedIds)
  const selectedItems = orderedIds.filter((id) => selected.has(id))
  if (!selectedItems.length) return []

  const remaining = orderedIds.filter((id) => !selected.has(id))
  const target = Math.max(0, Math.min(targetPosition, remaining.length))
  const desired = [...remaining.slice(0, target), ...selectedItems, ...remaining.slice(target)]
  const current = [...orderedIds]
  const moves: Array<{ id: string; position: number }> = []

  for (let index = 0; index < desired.length; index += 1) {
    while (current[index] !== desired[index]) {
      const id = selected.has(desired[index]) ? desired[index] : selected.has(current[index]) ? current[index] : ''
      if (!id) break
      const position = selected.has(desired[index]) ? index : desired.indexOf(id)
      const from = current.indexOf(id)
      if (from < 0 || from === position) break
      current.splice(from, 1)
      current.splice(position, 0, id)
      moves.push({ id, position })
    }
  }

  return moves
}
