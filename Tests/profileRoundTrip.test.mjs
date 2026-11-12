import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'
import { normalizeProfileProtocolExtra, normalizeProfileTransportExtra } from '../Src/Composables/profilePayloads.ts'

// Every config type the Web API can store. A profile is imported once, opened
// in the node editor, saved without touching a field, then exported again. The
// export must describe exactly the same node. This is the regression guard for
// case-variant extras: ServiceLib writes PascalCase properties, while the old
// editor defaulted and merged camelCase twins. The backend resolves duplicate
// JSON keys case-insensitively and the last one wins, so a twin silently
// replaces the live value (VlessEncryption being the reported failure).
const editorOptions = {
  configTypes: [
    'VMess', 'Custom', 'Shadowsocks', 'SOCKS', 'VLESS', 'Trojan', 'Hysteria2',
    'TUIC', 'WireGuard', 'HTTP', 'Anytls', 'Naive', 'Outbound', 'MASQUE',
    'PolicyGroup', 'ProxyChain',
  ],
  coreTypes: ['Xray', 'sing_box', 'hysteria2', 'tuic', 'naiveproxy', 'v2fly'],
  networks: ['raw', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'kcp', 'quic', 'h2'],
  defaultNetwork: 'raw',
  defaultSecurity: 'auto',
  defaultVlessEncryption: 'none',
  defaultWireGuardMtu: 1420,
  defaultXhttpMode: 'auto',
  defaultGrpcMode: 'gun',
  rawHeaderTypes: ['none', 'http'],
}

const GET_TYPE_NAMES = {
  VMess: 'vmess',
  Shadowsocks: 'shadowsocks',
  SOCKS: 'socks',
  VLESS: 'vless',
  Trojan: 'trojan',
  Hysteria2: 'hysteria2',
  TUIC: 'tuic',
  WireGuard: 'wireguard',
  HTTP: 'http',
  Anytls: 'anytls',
  Naive: 'naive',
  Outbound: 'outbound',
  MASQUE: 'masque',
  PolicyGroup: 'policyGroup',
  ProxyChain: 'proxyChain',
  Custom: 'custom',
}

const CANONICAL_TYPE_NAMES = Object.fromEntries(
  Object.entries(GET_TYPE_NAMES).map(([name, raw]) => [raw.toLowerCase(), name]),
)
const NETWORK_EXPORT_TYPES = new Set(['vmess', 'vless', 'trojan'])
const SERVER_COPY_FIELDS = [
  'coreType', 'remarks', 'address', 'port', 'username', 'password', 'network',
  'streamSecurity', 'sni', 'allowInsecure', 'fingerprint', 'alpn', 'publicKey',
  'shortId', 'spiderX', 'mldsa65Verify', 'muxEnabled', 'cert', 'certSha',
  'echConfigList', 'verifyPeerCertByName', 'finalmask', 'protoExtra', 'transportExtra',
]
const NETWORKS = new Set(editorOptions.networks)
const FLOWS = ['xtls-rprx-vision', 'xtls-rprx-vision-udp443']
const TUIC_CONGESTION = ['bbr', 'cubic', 'new_reno']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function text(value) {
  return String(value ?? '')
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : value
}

function parseExtra(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ...raw }
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function pascalName(key) {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function camelName(key) {
  return key.charAt(0).toLowerCase() + key.slice(1)
}

// System.Text.Json binds case-insensitively and keeps the last duplicate.
function lastWinsExtra(raw) {
  const result = {}
  for (const [key, value] of Object.entries(parseExtra(raw))) result[pascalName(key)] = value
  return result
}

// The backend-native PascalCase property is the live one; a camelCase twin is
// the legacy WebUI artifact. This is the value the running node actually uses.
function nativeWinsExtra(raw) {
  const grouped = new Map()
  const parsed = parseExtra(raw)
  for (const key of Object.keys(parsed)) {
    const canonical = pascalName(key)
    grouped.set(canonical, [...(grouped.get(canonical) ?? []), key])
  }
  const result = {}
  for (const [canonical, keys] of grouped) {
    const native = keys.find((key) => /^[A-Z]/.test(key)) ?? keys[0]
    result[canonical] = parsed[native]
  }
  return result
}

function dropNullish(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined))
}

function hasCaseDuplicate(raw) {
  const seen = new Set()
  for (const key of Object.keys(parseExtra(raw))) {
    const lower = key.toLowerCase()
    if (seen.has(lower)) return true
    seen.add(lower)
  }
  return false
}

// A healthy ServiceLib profile stores one canonical PascalCase property per
// field. The legacy WebUI artifact adds a camelCase twin; use this helper to
// build an unambiguous import for the literal import/save/export identity test.
function cleanExtra(raw) {
  return JSON.stringify(nativeWinsExtra(raw))
}

function normalizeExtra(raw, kind, configType, mode) {
  const pascal = mode === 'native' ? nativeWinsExtra(raw) : lastWinsExtra(raw)
  const camel = {}
  for (const [key, value] of Object.entries(pascal)) camel[camelName(key)] = value
  const normalized = kind === 'protocol'
    ? normalizeProfileProtocolExtra(camel, configType)
    : normalizeProfileTransportExtra(camel)
  return dropNullish(normalized)
}

// The share exporters read these ProfileItem properties and the effective
// protocol/transport extras. Comparing this view is equivalent to comparing
// the exported node without re-implementing every URI formatter.
function exportSnapshot(profile, mode) {
  const configType = text(profile.configType).toLowerCase()
  // normalizeProfileProtocolExtra keeps HttpHeaders only for the canonical
  // "HTTP" spelling, so hand it the enum name rather than the lower-case form.
  const canonicalType = CANONICAL_TYPE_NAMES[configType] || text(profile.configType)
  return {
    configType,
    coreType: text(profile.coreType).toLowerCase(),
    remarks: text(profile.remarks),
    address: text(profile.address),
    port: Number(profile.port || 0),
    username: text(profile.username),
    password: text(profile.password),
    network: NETWORK_EXPORT_TYPES.has(configType) ? text(profile.network).toLowerCase() : '',
    streamSecurity: text(profile.streamSecurity).toLowerCase(),
    allowInsecure: profile.allowInsecure === 'true',
    sni: text(profile.sni),
    alpn: text(profile.alpn),
    fingerprint: text(profile.fingerprint),
    publicKey: text(profile.publicKey),
    shortId: text(profile.shortId),
    spiderX: text(profile.spiderX),
    mldsa65Verify: text(profile.mldsa65Verify),
    muxEnabled: Boolean(profile.muxEnabled),
    cert: text(profile.cert),
    certSha: text(profile.certSha),
    echConfigList: text(profile.echConfigList),
    verifyPeerCertByName: text(profile.verifyPeerCertByName),
    finalmask: text(profile.finalmask),
    protoExtra: normalizeExtra(profile.protoExtra, 'protocol', canonicalType, mode),
    transportExtra: normalizeExtra(profile.transportExtra, 'transport', canonicalType, mode),
  }
}

// Mirrors the fields ConfigHandler.AddServer copies from the request and the
// normalization performed by the Add*Server methods plus AddServerCommon.
function applyBackendSave(original, body) {
  const stored = clone(original)
  const configType = text(original.configType).toLowerCase()

  if (configType === 'custom' || configType === 'outbound') {
    stored.remarks = body.remarks
    stored.address = body.address
    stored.coreType = body.coreType
    stored.displayLog = body.displayLog
    stored.preSocksPort = body.preSocksPort
    stored.protoExtra = body.protoExtra
    return stored
  }

  for (const field of SERVER_COPY_FIELDS) {
    if (Object.hasOwn(body, field)) stored[field] = body[field]
  }
  normalizeProtocol(stored, configType)
  normalizeServerCommon(stored)
  return stored
}

function normalizeProtocol(stored, configType) {
  const extra = lastWinsExtra(stored.protoExtra)
  stored.address = trimText(stored.address)
  stored.password = trimText(stored.password)

  switch (configType) {
    case 'vmess':
      stored.network = trimText(stored.network)
      stored.streamSecurity = trimText(stored.streamSecurity)
      extra.VmessSecurity = trimText(extra.VmessSecurity)
      break
    case 'shadowsocks':
      extra.SsMethod = trimText(extra.SsMethod)
      break
    case 'trojan':
      if (!stored.streamSecurity) stored.streamSecurity = 'tls'
      break
    case 'vless':
      stored.network = trimText(stored.network)
      stored.streamSecurity = trimText(stored.streamSecurity)
      extra.VlessEncryption = trimText(extra.VlessEncryption) || 'none'
      extra.Flow = FLOWS.includes(text(trimText(extra.Flow))) ? trimText(extra.Flow) : FLOWS[0]
      break
    case 'hysteria2':
      stored.fingerprint = ''
      stored.alpn = ''
      stored.network = ''
      if (!stored.streamSecurity) stored.streamSecurity = 'tls'
      extra.SalamanderPass = trimText(extra.SalamanderPass)
      extra.HopInterval = trimText(extra.HopInterval)
      break
    case 'tuic':
      stored.coreType = 'sing_box'
      stored.username = trimText(stored.username)
      stored.password = trimText(stored.password)
      stored.network = ''
      stored.fingerprint = ''
      if (!TUIC_CONGESTION.includes(text(extra.CongestionControl))) extra.CongestionControl = TUIC_CONGESTION[0]
      if (!stored.streamSecurity) stored.streamSecurity = 'tls'
      if (!stored.alpn) stored.alpn = 'h3'
      break
    case 'wireguard':
      extra.WgPublicKey = trimText(extra.WgPublicKey)
      extra.WgPresharedKey = trimText(extra.WgPresharedKey)
      extra.WgInterfaceAddress = trimText(extra.WgInterfaceAddress)
      extra.WgDns = trimText(extra.WgDns)
      if (!(Number(extra.WgMtu) > 0)) extra.WgMtu = 1420
      break
    case 'anytls':
      stored.coreType = 'sing_box'
      stored.network = ''
      if (!stored.streamSecurity) stored.streamSecurity = 'tls'
      break
    case 'naive':
      stored.coreType = 'sing_box'
      stored.username = trimText(stored.username)
      stored.password = trimText(stored.password)
      stored.fingerprint = ''
      stored.alpn = ''
      stored.network = ''
      stored.allowInsecure = ''
      if (!stored.streamSecurity) stored.streamSecurity = 'tls'
      break
    case 'masque':
      stored.username = trimText(stored.username)
      stored.password = trimText(stored.password)
      stored.fingerprint = ''
      stored.alpn = ''
      stored.network = ''
      stored.allowInsecure = ''
      if (!stored.streamSecurity) stored.streamSecurity = 'tls'
      break
  }
  stored.protoExtra = JSON.stringify(dropNullish(extra))
}

function normalizeServerCommon(stored) {
  stored.configVersion = 4
  if (stored.streamSecurity) {
    if (!['tls', 'reality'].includes(stored.streamSecurity)) stored.streamSecurity = ''
    else if (stored.streamSecurity === 'reality' && !stored.fingerprint) stored.fingerprint = 'chrome'
  }
  if (stored.network && !NETWORKS.has(stored.network)) stored.network = 'raw'
  // AddServerCommon always rewrites ProtoExtra through the typed model.
  stored.protoExtra = JSON.stringify(dropNullish(lastWinsExtra(stored.protoExtra)))
}

function makeFixture(configType, overrides = {}) {
  const {
    proto = {},
    stale = {},
    transport = {},
    transportStale = {},
    ...fields
  } = overrides
  return {
    indexId: `node-${configType.toLowerCase()}`,
    configType: GET_TYPE_NAMES[configType],
    subid: '',
    isSub: false,
    configVersion: 4,
    preSocksPort: null,
    displayLog: true,
    remarks: `${configType} imported node`,
    address: 'node.example.com',
    port: 443,
    username: 'user',
    password: 'secret',
    network: 'raw',
    headerType: '',
    requestHost: '',
    path: '',
    streamSecurity: 'tls',
    allowInsecure: '',
    sni: 'node.example.com',
    alpn: '',
    fingerprint: '',
    publicKey: '',
    shortId: '',
    spiderX: '',
    mldsa65Verify: '',
    extra: '',
    muxEnabled: null,
    cert: null,
    certSha: '',
    echConfigList: '',
    verifyPeerCertByName: '',
    finalmask: '',
    protoExtra: JSON.stringify({ ...proto, ...stale }),
    transportExtra: JSON.stringify({ ...transport, ...transportStale }),
    ports: '',
    alterId: 0,
    flow: '',
    id: '',
    security: '',
    ...fields,
  }
}

const fixtures = [
  makeFixture('VMess', {
    coreType: 'xray', network: 'ws', allowInsecure: '', muxEnabled: true,
    proto: { VmessSecurity: 'aes-128-gcm', AlterId: '8' },
    stale: { vmessSecurity: 'auto' },
    transport: { RawHeaderType: 'http', Host: 'vmess.example', Path: '/vmess' },
    transportStale: { rawHeaderType: '', host: 'stale.example' },
  }),
  makeFixture('VLESS', {
    coreType: 'xray', network: 'grpc', streamSecurity: 'reality', sni: 'reality.example',
    allowInsecure: 'false', fingerprint: 'chrome', publicKey: 'public-key', shortId: 'abcd',
    spiderX: '/spider', mldsa65Verify: 'verify-value', certSha: 'sha256-value',
    echConfigList: 'ech-value', verifyPeerCertByName: 'peer.example', finalmask: 'mask-value',
    proto: { Flow: 'xtls-rprx-vision', VlessEncryption: 'mlkem768x25519plus.native.0rtt.seed' },
    stale: { flow: '', vlessEncryption: 'none' },
    transport: { GrpcAuthority: 'grpc.example', GrpcServiceName: 'service', GrpcMode: 'gun' },
    transportStale: { grpcMode: 'multi' },
  }),
  makeFixture('Shadowsocks', {
    coreType: 'xray',
    proto: { SsMethod: 'aes-256-gcm', Uot: true },
    stale: { ssMethod: 'none', uot: null },
    transport: { KcpHeaderType: 'none', KcpSeed: 'seed', KcpMtu: 1350 },
    transportStale: { kcpMtu: 0 },
  }),
  makeFixture('SOCKS', {
    coreType: 'xray',
  }),
  makeFixture('HTTP', {
    coreType: 'xray',
    proto: { HttpHeaders: '{"X-Test":"value"}' },
    stale: { httpHeaders: '' },
    transport: { Host: 'http.example', Path: '/http' },
    transportStale: { host: 'stale.example' },
  }),
  makeFixture('Trojan', {
    coreType: 'xray', allowInsecure: 'true', muxEnabled: false, cert: 'cert-value',
    proto: { Flow: 'xtls-rprx-vision' },
    stale: { flow: '' },
    transport: { XhttpMode: 'auto', XhttpExtra: '{"x":1}' },
    transportStale: { xhttpMode: 'stream-one' },
  }),
  makeFixture('Hysteria2', {
    coreType: 'hysteria2', network: '', password: 'secret',
    proto: {
      SalamanderPass: 'salamander-secret', UpMbps: 100, DownMbps: 200, Ports: '443-8443',
      HopInterval: '30s', Hy2RealmUrl: 'realm://public@realm.example/id?stun=stun.example:3478',
      GeckoMinPacketSize: '512', GeckoMaxPacketSize: '1200',
    },
    stale: { salamanderPass: '', hopInterval: '0s' },
  }),
  makeFixture('TUIC', {
    coreType: 'sing_box', network: '', alpn: 'h3',
    proto: { CongestionControl: 'bbr' },
    stale: { congestionControl: 'cubic' },
  }),
  makeFixture('WireGuard', {
    coreType: 'sing_box', network: '', streamSecurity: '', port: 51820, username: '',
    proto: {
      WgPublicKey: 'wg-public-key', WgPresharedKey: 'wg-preshared-key',
      WgInterfaceAddress: '10.0.0.2/32', WgReserved: '1, 2, 3', WgMtu: 1280, WgDns: '1.1.1.1',
    },
    stale: { wgPublicKey: 'stale-key', wgMtu: 0 },
  }),
  makeFixture('Anytls', {
    coreType: 'sing_box', network: '',
    proto: { InsecureConcurrency: 8 },
    stale: { insecureConcurrency: 0 },
  }),
  makeFixture('Naive', {
    coreType: 'sing_box', network: '', allowInsecure: '',
    proto: { Uot: true, InsecureConcurrency: 4, NaiveQuic: true, CongestionControl: 'bbr' },
    stale: { uot: null, insecureConcurrency: 0, naiveQuic: null, congestionControl: 'cubic' },
  }),
  makeFixture('MASQUE', {
    coreType: 'sing_box', network: '', allowInsecure: '',
    proto: { MasquePath: '/masque', MasqueHeaders: '{"x":1}' },
    stale: { masquePath: '/stale' },
  }),
  makeFixture('Outbound', {
    coreType: 'sing_box', network: '', streamSecurity: '', username: '', password: '',
    address: 'outbound.json',
    proto: { IsSingboxEndpoint: true },
    stale: { isSingboxEndpoint: false },
  }),
  makeFixture('Custom', {
    coreType: 'xray', network: '', streamSecurity: '', username: '', password: '',
    address: 'custom.json',
  }),
  makeFixture('PolicyGroup', {
    coreType: 'Xray', network: '', streamSecurity: '', username: '', password: '', address: '',
    proto: {
      GroupType: 'PolicyGroup', ChildItems: 'child-a,child-b', SubChildItems: '',
      Filter: 'hk|jp', MultipleLoad: 'LeastPing',
    },
    stale: { groupType: '', multipleLoad: 'Random' },
  }),
  makeFixture('ProxyChain', {
    coreType: 'Xray', network: '', streamSecurity: '', username: '', password: '', address: '',
    proto: { GroupType: 'ProxyChain', ChildItems: 'child-a' },
    stale: { groupType: '' },
  }),
]

function cleanFixture(fixture) {
  return {
    ...fixture,
    protoExtra: cleanExtra(fixture.protoExtra),
    transportExtra: cleanExtra(fixture.transportExtra),
  }
}

function createApi(profile) {
  const savedBodies = []
  return {
    savedBodies,
    download: async () => ({ blob: new Blob([]), filename: 'export.txt' }),
    data: async (route) => {
      if (route === '/api/editor-options') return { profiles: editorOptions }
      if (route === '/api/profile-groups') return []
      if (route === `/api/profiles/${encodeURIComponent(profile.indexId)}`) return clone(profile)
      if (route.startsWith('/api/profiles')) return [clone(profile)]
      return []
    },
    request: async (route, init) => {
      if (route === `/api/profiles/${encodeURIComponent(profile.indexId)}` && init?.method === 'PUT' && init.body) {
        savedBodies.push(init.body)
      }
      return { success: true }
    },
  }
}

function canonicalCode(value, codes) {
  return codes.find((code) => code.toLowerCase() === text(value).toLowerCase()) || value
}

function createProfiles(harness, api) {
  const { useProfiles } = harness.loadSource('Src/Composables/useProfiles.ts')
  return useProfiles({
    t: (key) => key,
    showNotice() {},
    showError(error) { throw error },
    confirm: async () => true,
    operationMessage: () => 'saved',
    queryPath: (route, values) => {
      const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null).map(([key, value]) => [key, String(value)]))
      return query.size ? `${route}?${query}` : route
    },
    canonicalCode,
    coreTypeRoute: (value) => value,
    loadStatus: async () => {},
    loadOperations: async () => {},
    request: api.request,
    data: api.data,
    download: api.download,
    busy: harness.vue.ref(false),
    operations: harness.vue.ref([]),
    contextMenu: harness.vue.ref(null),
  })
}

test('every imported node type survives an unchanged save and exports identically', async (t) => {
  const harness = createSourceHarness()
  try {
    for (const importedFixture of fixtures) {
      const fixture = cleanFixture(importedFixture)
      await t.test(importedFixture.configType, async () => {
        const api = createApi(fixture)
        const profiles = createProfiles(harness, api)

        await profiles.openEditProfile({ indexId: fixture.indexId })
        await profiles.profileModalActions.saveProfile()

        const body = api.savedBodies.at(-1)
        assert.ok(body, `${fixture.configType}: the editor did not submit a save payload`)
        assert.equal(hasCaseDuplicate(body.protoExtra), false, `${fixture.configType}: protoExtra contains ambiguous case twins`)
        assert.equal(hasCaseDuplicate(body.transportExtra), false, `${fixture.configType}: transportExtra contains ambiguous case twins`)
        // Untouched top-level fields keep the exact imported representation
        // instead of churning ""/null into "false"/"".
        for (const field of ['allowInsecure', 'muxEnabled', 'cert']) {
          if (Object.hasOwn(body, field)) {
            assert.deepEqual(body[field], fixture[field], `${fixture.configType}: ${field} was rewritten`)
          }
        }

        // Both sides use the real backend rule: case-insensitive, last duplicate
        // wins. The clean import has no duplicates, so this is literal identity.
        const imported = exportSnapshot(fixture, 'last')
        const exported = exportSnapshot(applyBackendSave(fixture, body), 'last')
        assert.deepEqual(exported, imported, `${fixture.configType}: save changed the exported node`)
      })
    }
  } finally {
    await harness.dispose()
  }
})

test('legacy case-variant twins are repaired to the backend-native values on save', async (t) => {
  const harness = createSourceHarness()
  try {
    for (const fixture of fixtures) {
      await t.test(fixture.configType, async () => {
        const api = createApi(fixture)
        const profiles = createProfiles(harness, api)

        await profiles.openEditProfile({ indexId: fixture.indexId })
        await profiles.profileModalActions.saveProfile()

        const body = api.savedBodies.at(-1)
        assert.ok(body, `${fixture.configType}: the editor did not submit a save payload`)
        assert.equal(hasCaseDuplicate(body.protoExtra), false, `${fixture.configType}: protoExtra contains ambiguous case twins`)
        assert.equal(hasCaseDuplicate(body.transportExtra), false, `${fixture.configType}: transportExtra contains ambiguous case twins`)

        // The PascalCase set is what ServiceLib exposes through its typed
        // model; the camelCase twin is the legacy WebUI artifact that silently
        // downgraded the node. A no-op save must restore the typed values.
        const working = exportSnapshot(fixture, 'native')
        const repaired = exportSnapshot(applyBackendSave(fixture, body), 'last')
        assert.deepEqual(repaired, working, `${fixture.configType}: save did not restore the backend-native values`)
        if (hasCaseDuplicate(fixture.protoExtra) || hasCaseDuplicate(fixture.transportExtra)) {
          assert.notDeepEqual(exportSnapshot(fixture, 'last'), working, `${fixture.configType}: fixture is not ambiguous`)
        }
      })
    }
  } finally {
    await harness.dispose()
  }
})

test('the raw legacy payload exports the downgraded value under backend rules', () => {
  const vless = fixtures.find((fixture) => fixture.configType === 'vless')
  assert.ok(vless)
  const working = exportSnapshot(vless, 'native')
  assert.equal(working.protoExtra.vlessEncryption, 'mlkem768x25519plus.native.0rtt.seed')

  // This is the stored string the old editor produced: the backend-native
  // PascalCase property followed by the stale camelCase default. The backend's
  // case-insensitive last-wins reader would export "none" from it.
  const legacy = exportSnapshot(vless, 'last')
  assert.equal(legacy.protoExtra.vlessEncryption, 'none')
  assert.notDeepEqual(legacy, working)
})
