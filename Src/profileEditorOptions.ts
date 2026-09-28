/**
 * Static profile-editor options mirrored from the current upstream source:
 * ServiceLib/Global.cs (core types, sing-box-only protocols, flows, networks,
 * protocol/security/transport enums) and
 * ServiceLib/Manager/AppManager.cs:GetShadowsocksSecurities (core-specific methods).
 * Keep these mirrors centralized and re-check them against upstream when updating v2rayN.
 */
export const profileEditorOptions = {
  coreTypes: ['Xray', 'sing_box'],
  singboxOnlyConfigTypes: ['TUIC', 'Anytls', 'Naive'],
  networks: ['raw', 'xhttp', 'kcp', 'grpc', 'ws', 'httpupgrade'],
  defaultNetwork: 'raw',
  rawHeaderTypes: ['none', 'http'],
  xhttpModes: ['auto', 'packet-up', 'stream-up', 'stream-one'],
  kcpHeaderTypes: ['none', 'srtp', 'utp', 'wechat-video', 'dtls', 'wireguard', 'dns'],
  grpcModes: ['gun', 'multi'],
  vmessSecurities: ['aes-128-gcm', 'chacha20-poly1305', 'auto', 'none', 'zero'],
  flows: ['', 'xtls-rprx-vision', 'xtls-rprx-vision-udp443'],
  tuicCongestionControls: ['cubic', 'new_reno', 'bbr'],
  naiveCongestionControls: ['bbr', 'bbr2', 'cubic', 'reno'],
  shadowsocksSecuritiesXray: [
    'aes-256-gcm', 'aes-128-gcm', 'chacha20-poly1305', 'chacha20-ietf-poly1305',
    'xchacha20-poly1305', 'xchacha20-ietf-poly1305', 'none', 'plain',
    '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
  ],
  shadowsocksSecuritiesSingbox: [
    'aes-256-gcm', 'aes-192-gcm', 'aes-128-gcm', 'chacha20-ietf-poly1305',
    'xchacha20-ietf-poly1305', 'none', '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm',
    '2022-blake3-chacha20-poly1305', 'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
    'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb', 'rc4-md5', 'chacha20-ietf', 'xchacha20',
  ],
  shadowsocksSecuritiesV2fly: [
    'aes-256-gcm', 'aes-128-gcm', 'chacha20-poly1305', 'chacha20-ietf-poly1305', 'none', 'plain',
  ],
  fingerprints: ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random', 'randomized', ''],
  alpns: ['h3', 'h2', 'http/1.1', 'h3,h2', 'h2,http/1.1', 'h3,h2,http/1.1', ''],
} as const

export function canonicalNetwork(value: unknown): string {
  const network = String(value ?? '').trim().toLowerCase()
  if (network === '' || network === 'tcp') return profileEditorOptions.defaultNetwork
  return (profileEditorOptions.networks as readonly string[]).includes(network)
    ? network
    : profileEditorOptions.defaultNetwork
}

export function shadowsocksSecurityOptions(coreType: unknown, mappedCoreType: unknown = 'Xray'): readonly string[] {
  const selectedCore = String(coreType ?? '').trim()
  const core = (selectedCore || String(mappedCoreType ?? 'Xray')).toLowerCase()
  if (core === 'v2fly') return profileEditorOptions.shadowsocksSecuritiesV2fly
  if (core === 'xray') return profileEditorOptions.shadowsocksSecuritiesXray
  return profileEditorOptions.shadowsocksSecuritiesSingbox
}
