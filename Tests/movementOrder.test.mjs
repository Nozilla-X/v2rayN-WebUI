import assert from 'node:assert/strict'
import test from 'node:test'
import { planSelectedMoves } from '../Src/Composables/movementOrder.js'

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
