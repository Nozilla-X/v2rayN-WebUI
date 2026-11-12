import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeFormEdits, reconcileProfileExtraKeys } from '../Src/Composables/profilePayloads.ts'

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

test('an unchanged save keeps the backend value instead of a stale case-variant default', () => {
  // Real VLESS profiles can contain ServiceLib's PascalCase VlessEncryption
  // next to a camelCase "none" twin left by an older save. The backend reads
  // case-insensitively and its last duplicate wins, so sending both values
  // silently downgrades the node to no encryption.
  const initial = {
    Flow: 'xtls-rprx-vision',
    VlessEncryption: 'mlkem768x25519plus.native.0rtt.seed',
    vlessEncryption: 'none',
  }
  const advanced = JSON.parse(JSON.stringify(initial))
  const current = JSON.parse(JSON.stringify(initial))
  const merged = mergeFormEdits(advanced, current, initial)
  assert.deepEqual(
    reconcileProfileExtraKeys(merged, 'protocol', { advanced, current, initial }),
    { flow: 'xtls-rprx-vision', vlessEncryption: 'mlkem768x25519plus.native.0rtt.seed' },
  )
})

test('the form still wins over a stale case-variant twin', () => {
  const initial = { VlessEncryption: 'mlkem768x25519plus.native.0rtt.seed', vlessEncryption: 'none' }
  const advanced = JSON.parse(JSON.stringify(initial))
  const current = { ...initial, vlessEncryption: 'edited-encryption' }
  const merged = mergeFormEdits(advanced, current, initial)
  assert.equal(
    reconcileProfileExtraKeys(merged, 'protocol', { advanced, current, initial }).vlessEncryption,
    'edited-encryption',
  )
})

test('an advanced-JSON edit still wins over the backend case variant', () => {
  const initial = { VlessEncryption: 'mlkem768x25519plus.native.0rtt.seed', vlessEncryption: 'none' }
  const advanced = { ...initial, vlessEncryption: 'advanced-encryption' }
  const current = JSON.parse(JSON.stringify(initial))
  const merged = mergeFormEdits(advanced, current, initial)
  assert.equal(
    reconcileProfileExtraKeys(merged, 'protocol', { advanced, current, initial }).vlessEncryption,
    'advanced-encryption',
  )
})

test('case reconciliation covers every protocol and transport field, not only VLESS', () => {
  const protocolExtra = {
    Uot: true, uot: null,
    VmessSecurity: 'aes-128-gcm', vmessSecurity: 'auto',
    SsMethod: 'aes-256-gcm', ssMethod: 'none',
    WgPublicKey: 'public-key', wgPublicKey: 'stale',
    WgMtu: 1280, wgMtu: 0,
    SalamanderPass: 'secret', salamanderPass: '',
    MasquePath: '/masque', masquePath: '/stale',
  }
  const protocolContext = { advanced: protocolExtra, current: protocolExtra, initial: protocolExtra }
  assert.deepEqual(reconcileProfileExtraKeys(protocolExtra, 'protocol', protocolContext), {
    uot: true,
    vmessSecurity: 'aes-128-gcm',
    ssMethod: 'aes-256-gcm',
    wgPublicKey: 'public-key',
    wgMtu: 1280,
    salamanderPass: 'secret',
    masquePath: '/masque',
  })

  const transportExtra = {
    RawHeaderType: 'none', rawHeaderType: '',
    Host: 'example.test', host: 'stale.test',
    KcpMtu: 1350, kcpMtu: 0,
  }
  const transportContext = { advanced: transportExtra, current: transportExtra, initial: transportExtra }
  assert.deepEqual(reconcileProfileExtraKeys(transportExtra, 'transport', transportContext), {
    rawHeaderType: 'none',
    host: 'example.test',
    kcpMtu: 1350,
  })
})

test('canonical camelCase is emitted for a profile that only has PascalCase keys', () => {
  const raw = { Flow: 'xtls-rprx-vision', VlessEncryption: 'mlkem768x25519plus.native.0rtt.seed' }
  assert.deepEqual(
    reconcileProfileExtraKeys(raw, 'protocol', { advanced: raw, current: raw, initial: raw }),
    { flow: 'xtls-rprx-vision', vlessEncryption: 'mlkem768x25519plus.native.0rtt.seed' },
  )
})
