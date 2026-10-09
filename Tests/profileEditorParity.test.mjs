import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalizeProfileProtocolExtra, normalizeProfileTransportExtra } from '../Src/Composables/profilePayloads.ts'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src')

test('profile editor option values come from the Web API and profile fields remain editable', async () => {
  const [options, composable, ...editorSections] = await Promise.all([
    readFile(path.join(sourceRoot, 'profileEditorOptions.ts'), 'utf8'),
    readFile(path.join(sourceRoot, 'Composables/useProfiles.ts'), 'utf8'),
    readFile(path.join(sourceRoot, 'Components/Modals/ProfileModal.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Features/Profiles/ProfileGroupSection.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Features/Profiles/ProfileTransportSection.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Features/Profiles/ProfileSecuritySection.vue'), 'utf8'),
  ])
  const modal = editorSections.join('\n')

  assert.match(composable, /options\.data\('\/api\/editor-options'\)/)
  assert.match(composable, /editorOptions\.value\.configTypes/)
  assert.match(composable, /editorOptions\.value\.coreTypes/)
  assert.doesNotMatch(options, /\[['"](?:Xray|sing_box|raw|xhttp|mixed|v2ray)['"]\s*,/)

  for (const field of [
    'configType', 'coreType', 'remarks', 'address', 'port', 'password', 'username', 'network',
    'alterId', 'vmessSecurity', 'flow', 'vlessEncryption', 'ssMethod', 'uot', 'muxEnabled',
    'upMbps', 'downMbps', 'salamanderPass', 'ports', 'hopInterval', 'hy2RealmUrl',
    'congestionControl', 'insecureConcurrency', 'naiveQuic', 'wgPublicKey', 'wgPresharedKey',
    'wgInterfaceAddress', 'wgReserved', 'wgMtu', 'wgDns', 'rawHeaderType', 'xhttpMode',
    'xhttpExtra', 'grpcAuthority', 'grpcServiceName', 'grpcMode', 'kcpHeaderType', 'kcpSeed',
    'kcpMtu', 'streamSecurity', 'sni', 'alpn', 'fingerprint', 'allowInsecure', 'publicKey',
    'shortId', 'spiderX', 'mldsa65Verify', 'cert', 'certSha', 'echConfigList',
    'verifyPeerCertByName', 'finalmask', 'httpHeaders', 'customConfigPath', 'isSingboxEndpoint',
  ]) {
    assert.ok(modal.includes(field), `ProfileModal exposes or preserves ${field}`)
  }
})

test('Core sniffing status is canonical and absent when sniffing is disabled', async () => {
  const [runtime, strip] = await Promise.all([
    readFile(path.join(sourceRoot, 'Composables/useRuntime.ts'), 'utf8'),
    readFile(path.join(sourceRoot, 'Components/RuntimeStrip.vue'), 'utf8'),
  ])
  assert.match(runtime, /options\.data\('\/api\/status'\)/)
  assert.match(strip, /v-if="state\.status\?\.sniffingEnabled"[\s\S]*?destOverride[\s\S]*?join\(' \/ '\)/)
})

test('profile save normalization preserves Desktop nullable and zero semantics', () => {
  assert.deepEqual(normalizeProfileProtocolExtra({
    alterId: '0', flow: '', ssMethod: 'aes-256-gcm', uot: false,
    wgMtu: 575, insecureConcurrency: '0', geckoMinPacketSize: '0',
    httpHeaders: '{"X-Test":"value"}', isSingboxEndpoint: false,
  }, 'VLESS'), {
    alterId: null, flow: null, ssMethod: 'aes-256-gcm', uot: null,
    wgMtu: null, insecureConcurrency: null, geckoMinPacketSize: null,
    httpHeaders: null, isSingboxEndpoint: null,
  })
  assert.deepEqual(normalizeProfileProtocolExtra({
    alterId: '8', upMbps: 0, downMbps: null, wgMtu: 1280, httpHeaders: '{"X-Test":"value"}', uot: true,
  }, 'HTTP'), {
    alterId: '8', upMbps: 0, downMbps: null, wgMtu: 1280, httpHeaders: '{"X-Test":"value"}', uot: true,
  })
  assert.deepEqual(normalizeProfileTransportExtra({
    rawHeaderType: '', host: 'example.test', kcpMtu: 0, grpcMode: 'gun',
  }), { rawHeaderType: null, host: 'example.test', kcpMtu: null, grpcMode: 'gun' })
})
