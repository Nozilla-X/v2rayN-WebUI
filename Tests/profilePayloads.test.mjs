import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeFormEdits } from '../Src/Composables/profilePayloads.ts'

test('unsaved form fields keep values edited in the advanced JSON', () => {
  const advanced = { wgMtu: 900, customField: 'json-only' }
  const current = { wgMtu: 1450 }
  const initial = { wgMtu: 1450 }
  assert.deepEqual(mergeFormEdits(advanced, current, initial), { wgMtu: 900, customField: 'json-only' })
})

test('values changed in the form win over the advanced JSON', () => {
  assert.deepEqual(mergeFormEdits({ wgMtu: 900 }, { wgMtu: 1500 }, { wgMtu: 1450 }), { wgMtu: 1500 })
})

test('keys removed by the form are removed from the merged result', () => {
  assert.deepEqual(
    mergeFormEdits({ flow: 'xtls-rprx-vision', keep: 1 }, {}, { flow: 'xtls-rprx-vision' }),
    { keep: 1 },
  )
})

test('nested records merge per field instead of replacing the whole object', () => {
  const advanced = { nested: { a: 'json-edit', b: 'original' } }
  const current = { nested: { a: 'original', b: 'form-edit' } }
  const initial = { nested: { a: 'original', b: 'original' } }
  assert.deepEqual(mergeFormEdits(advanced, current, initial), { nested: { a: 'json-edit', b: 'form-edit' } })
})

test('arrays unchanged in the form keep the advanced JSON value', () => {
  const advanced = { childItems: 'A,B' }
  const current = { childItems: ['A', 'B'] }
  const initial = { childItems: ['A', 'B'] }
  assert.deepEqual(mergeFormEdits(advanced, current, initial), { childItems: 'A,B' })
})

test('new form-only keys are added to the merged result', () => {
  assert.deepEqual(mergeFormEdits({}, { added: true }, {}), { added: true })
})
