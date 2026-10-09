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
