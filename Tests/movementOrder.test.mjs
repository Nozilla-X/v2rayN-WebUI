import assert from 'node:assert/strict'
import test from 'node:test'
import { planSelectedMoves, planSelectedPositionMoves } from '../Src/Composables/movementOrder.ts'

function applyMoves(order, selected, direction) {
  const result = [...order]
  for (const id of planSelectedMoves(order, selected, direction)) {
    const index = result.indexOf(id)
    const target = direction === 'top' ? 0 : direction === 'bottom' ? result.length - 1
      : index + (direction === 'up' ? -1 : 1)
    result.splice(index, 1)
    result.splice(target, 0, id)
  }
  return result
}

test('adjacent selected nodes/rules move up or down as a stable block', () => {
  assert.deepEqual(applyMoves(['A', 'B', 'C', 'D'], ['B', 'C'], 'up'), ['B', 'C', 'A', 'D'])
  assert.deepEqual(applyMoves(['A', 'B', 'C', 'D'], ['B', 'C'], 'down'), ['A', 'D', 'B', 'C'])
})

test('selected blocks at a boundary do not reverse or cross each other', () => {
  assert.deepEqual(applyMoves(['A', 'B', 'C', 'D'], ['A', 'B'], 'up'), ['A', 'B', 'C', 'D'])
  assert.deepEqual(applyMoves(['A', 'B', 'C', 'D'], ['C', 'D'], 'down'), ['A', 'B', 'C', 'D'])
  assert.deepEqual(planSelectedMoves(['A', 'B'], ['A', 'B'], 'up'), [])
  assert.deepEqual(planSelectedMoves(['A', 'B'], ['A', 'B'], 'down'), [])
})

test('non-adjacent selections and top/bottom moves preserve selection order', () => {
  const order = ['A', 'B', 'C', 'D']
  assert.deepEqual(applyMoves(order, ['B', 'D'], 'up'), ['B', 'A', 'D', 'C'])
  assert.deepEqual(applyMoves(order, ['A', 'C'], 'down'), ['B', 'A', 'D', 'C'])
  assert.deepEqual(applyMoves(order, ['B', 'C'], 'top'), ['B', 'C', 'A', 'D'])
  assert.deepEqual(applyMoves(order, ['B', 'C'], 'bottom'), ['A', 'D', 'B', 'C'])
})

function applyPositionMoves(order, moves) {
  const result = [...order]
  for (const { id, position } of moves) {
    const from = result.indexOf(id)
    assert.notEqual(from, -1, `move target ${id} must exist in the list`)
    result.splice(from, 1)
    result.splice(position, 0, id)
  }
  return result
}

test('multi-selection moved to a position keeps its original order', () => {
  const order = ['A', 'B', 'C', 'D']
  assert.deepEqual(applyPositionMoves(order, planSelectedPositionMoves(order, ['B', 'D'], 0)), ['B', 'D', 'A', 'C'])
  assert.deepEqual(applyPositionMoves(order, planSelectedPositionMoves(order, ['A', 'D'], 1)), ['B', 'A', 'D', 'C'])
  assert.deepEqual(applyPositionMoves(order, planSelectedPositionMoves(order, ['A', 'C'], 2)), ['B', 'D', 'A', 'C'])
})

test('position moves clamp to the remaining list and no-op when already placed', () => {
  const order = ['A', 'B', 'C']
  assert.deepEqual(applyPositionMoves(order, planSelectedPositionMoves(order, ['A', 'B'], 99)), ['C', 'A', 'B'])
  assert.deepEqual(planSelectedPositionMoves(order, ['B'], 1), [])
  assert.deepEqual(planSelectedPositionMoves(order, [], 0), [])
  assert.deepEqual(planSelectedPositionMoves(order, ['missing-id'], 0), [])
})

test('every planned position move targets an existing row', () => {
  const order = ['A', 'B', 'C', 'D', 'E']
  for (const selected of [['A'], ['A', 'C', 'E'], ['B', 'C'], ['E', 'A'], ['C', 'B', 'D']]) {
    for (let target = 0; target <= order.length + 1; target += 1) {
      const moves = planSelectedPositionMoves(order, selected, target)
      const result = applyPositionMoves(order, moves)
      assert.equal(result.length, order.length)
      for (const move of moves) {
        assert.ok(Number.isInteger(move.position) && move.position >= 0 && move.position < order.length)
      }
      const expected = (() => {
        const chosen = new Set(selected)
        const remaining = order.filter((id) => !chosen.has(id))
        const at = Math.max(0, Math.min(target, remaining.length))
        return [...remaining.slice(0, at), ...order.filter((id) => chosen.has(id)), ...remaining.slice(at)]
      })()
      assert.deepEqual(result, expected)
    }
  }
})
