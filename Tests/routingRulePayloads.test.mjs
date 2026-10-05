import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRoutingRuleBody } from '../Src/Composables/routingRulePayloads.js'

const rule = { id: 'rule-1', enabled: true, type: 'field', remarks: 'old', outboundTag: 'proxy', domain: ['old.example'] }
const form = { ...rule, domainText: 'old.example', inboundTagText: '', protocolText: '', ipText: '', processText: '' }

test('advanced rule JSON edits survive unchanged structured form fields', () => {
  const body = buildRoutingRuleBody({ ...rule, id: 'changed-id', remarks: 'new', outboundTag: 'direct', domain: ['new.example'], customField: 'retained' }, form, form, rule.id)
  assert.equal(body.id, rule.id)
  assert.equal(body.remarks, 'new')
  assert.equal(body.outboundTag, 'direct')
  assert.deepEqual(body.domain, ['new.example'])
  assert.equal(body.customField, 'retained')
})

test('explicit form edits override only their corresponding JSON fields', () => {
  const body = buildRoutingRuleBody({ ...rule, remarks: 'JSON remarks', domain: ['json.example'] },
    { ...form, outboundTag: 'direct', domainText: 'form.example\nsecond.example' }, form, rule.id)
  assert.equal(body.remarks, 'JSON remarks')
  assert.equal(body.outboundTag, 'direct')
  assert.deepEqual(body.domain, ['form.example', 'second.example'])
  assert.equal(Object.hasOwn(body, 'domainText'), false)
})

test('clearing a structured list clears it instead of restoring the JSON copy', () => {
  const body = buildRoutingRuleBody(rule, { ...form, domainText: '' }, form, rule.id)
  assert.deepEqual(body.domain, [])
})

test('invalid JSON rule shapes and non-array match lists are rejected before PUT', () => {
  for (const invalid of [null, [], 'rule', { ...rule, domain: 'not-an-array' }]) {
    assert.throws(() => buildRoutingRuleBody(invalid, form, form, rule.id), SyntaxError)
  }
})
