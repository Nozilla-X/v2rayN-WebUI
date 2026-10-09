import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteSelectedRoutingRules } from '../Src/Composables/batchRuleDeletion.ts'

function makeOptions(overrides = {}) {
  const state = { deleting: false, selectedIds: ['r1'], requests: [], reloads: 0, notices: [], errors: [] }
  const options = {
    selectedRuleIds: state.selectedIds,
    routingRules: [{ id: 'r1' }, { id: 'r2' }],
    routingId: 'route/a',
    isDeleting: () => state.deleting,
    setDeleting: (value) => { state.deleting = value },
    confirm: async () => true,
    confirmMessage: 'Confirm delete?',
    request: async (...args) => { state.requests.push(args); return { code: 'ok' } },
    operationMessage: () => 'deleted',
    showNotice: (message) => state.notices.push(message),
    showError: (error) => state.errors.push(error),
    clearSelection: () => { state.selectedIds = [] },
    loadRules: async () => { state.reloads += 1 },
    ...overrides,
  }
  return { options, state }
}

test('unconfirmed batch deletion performs no PUT and does not reload', async () => {
  const { options, state } = makeOptions({ confirm: async (message) => { assert.equal(message, 'Confirm delete?'); return false } })
  assert.equal(await deleteSelectedRoutingRules(options), false)
  assert.deepEqual(state.requests, [])
  assert.equal(state.reloads, 0)
  assert.equal(state.deleting, false)
})

test('confirmed batch deletion sends one atomic PUT with remaining rules then reloads', async () => {
  const { options, state } = makeOptions()
  assert.equal(await deleteSelectedRoutingRules(options), true)
  assert.equal(state.requests.length, 1)
  assert.equal(state.requests[0][0], '/api/settings/routing-profiles/route%2Fa/rules')
  assert.deepEqual(state.requests[0][1], { method: 'PUT', body: [{ id: 'r2' }] })
  assert.equal(state.reloads, 1)
  assert.deepEqual(state.notices, ['deleted'])
  assert.deepEqual(state.errors, [])
  assert.equal(state.deleting, false)
})

test('duplicate batch deletion attempts are ignored while a delete is active', async () => {
  const { options, state } = makeOptions({ isDeleting: () => true })
  assert.equal(await deleteSelectedRoutingRules(options), false)
  assert.deepEqual(state.requests, [])
  assert.equal(state.reloads, 0)
})
