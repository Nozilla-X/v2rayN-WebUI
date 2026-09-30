import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSettingsApplyBody,
  buildSpeedSettingsBody,
  nullableNumber,
  normalizeNullableNumbers,
} from '../Src/Composables/settingsPayloads.js'

test('nullableNumber preserves null and empty values as null', () => {
  assert.equal(nullableNumber(null), null)
  assert.equal(nullableNumber(undefined), null)
  assert.equal(nullableNumber(''), null)
  assert.equal(nullableNumber('   '), null)
})

test('nullableNumber accepts valid numbers and does not coerce zero to null', () => {
  assert.equal(nullableNumber(25), 25)
  assert.equal(nullableNumber('25'), 25)
  assert.equal(nullableNumber(0), 0)
  assert.equal(nullableNumber('0'), 0)
})

test('nullableNumber rejects invalid and non-finite values', () => {
  for (const value of ['invalid', Number.NaN, Number.POSITIVE_INFINITY, true, {}]) {
    assert.throws(() => nullableNumber(value), TypeError)
  }
})

test('nullable protocol and transport numeric fields preserve empty/null and real zero', () => {
  assert.deepEqual(
    normalizeNullableNumbers(
      { upMbps: null, downMbps: '', wgMtu: 0, insecureConcurrency: '8' },
      ['upMbps', 'downMbps', 'wgMtu', 'insecureConcurrency'],
    ),
    { upMbps: null, downMbps: null, wgMtu: 0, insecureConcurrency: 8 },
  )
  assert.deepEqual(normalizeNullableNumbers({ kcpMtu: undefined }, ['kcpMtu']), { kcpMtu: null })
  assert.throws(() => normalizeNullableNumbers({ kcpMtu: 'invalid' }, ['kcpMtu']), TypeError)
})

test('speed-test save matches Desktop editor fields and does not add non-Desktop settings', () => {
  const unchanged = {
    speedTestTimeout: 10000,
    mixedConcurrencyCount: 4,
    speedTestUrl: 'https://speed.example/file',
    speedPingTestUrl: 'https://ping.example/check',
    ipapiUrl: '',
    udpTestTarget: '',
  }
  assert.deepEqual(buildSpeedSettingsBody(unchanged), unchanged)
  const withLegacyExtras = buildSpeedSettingsBody({ ...unchanged, speedTestPageSize: 20, speedTestDelayInterval: 0 })
  assert.equal('speedTestPageSize' in withLegacyExtras, false)
  assert.equal('speedTestDelayInterval' in withLegacyExtras, false)
  assert.throws(() => buildSpeedSettingsBody({ ...unchanged, speedTestTimeout: 'invalid' }), TypeError)
})

test('atomic settings apply carries all sections and preserves nullable fields', () => {
  const body = buildSettingsApplyBody({
    inbound: { localPort: '10808', destOverride: ['http'] },
    core: { mux4RayConcurrency: null, mux4RayXudpConcurrency: '', fragmentLengthsText: '', fragmentDelaysText: '' },
    app: { geoAutoUpdateInterval: 0 },
    speed: { speedTestTimeout: 10000, mixedConcurrencyCount: 4, speedTestUrl: 'https://speed.example/file' },
    coreTypes: [{ configType: 0, coreType: 'Xray' }],
    routing: { domainStrategy: 'AsIs', domainStrategy4Singbox: 'prefer_ipv4' },
  })

  assert.equal(body.inbound.localPort, 10808)
  assert.equal(body.speedTest.speedTestUrl, 'https://speed.example/file')
  assert.equal(body.core.mux4RayConcurrency, null)
  assert.deepEqual(body.coreTypes, [{ configType: 0, coreType: 'Xray' }])
  assert.equal(body.domainStrategy, 'AsIs')
})
