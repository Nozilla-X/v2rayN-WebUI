import { nullableNumber } from './settingsPayloads.ts'
import type { Dict } from './types'

const nullableTextFields = [
  'ports', 'flow', 'vlessEncryption', 'ssMethod', 'wgPublicKey', 'wgPresharedKey',
  'wgInterfaceAddress', 'wgReserved', 'wgDns', 'salamanderPass', 'hopInterval',
  'hy2RealmUrl', 'congestionControl', 'groupType', 'childItems', 'subChildItems',
  'filter', 'multipleLoad',
]

const nullableTransportTextFields = [
  'rawHeaderType', 'host', 'path', 'xhttpMode', 'xhttpExtra', 'grpcAuthority',
  'grpcServiceName', 'grpcMode', 'kcpHeaderType', 'kcpSeed',
]

function nullWhenEmpty(value: unknown): unknown {
  return value === '' ? null : value
}

function positiveIntString(value: unknown): string | null {
  const number = nullableNumber(value)
  return number != null && Number.isInteger(number) && number > 0 ? String(number) : null
}

export function normalizeProfileProtocolExtra(value: Dict, configType: string): Dict {
  const extra: Dict = { ...value }
  for (const field of nullableTextFields) {
    if (Object.hasOwn(extra, field)) extra[field] = nullWhenEmpty(extra[field])
  }

  if (Object.hasOwn(extra, 'alterId')) {
    const alterId = nullableNumber(extra.alterId)
    extra.alterId = alterId != null && Number.isInteger(alterId) && alterId > 0 ? String(alterId) : null
  }
  for (const field of ['wgMtu', 'insecureConcurrency']) {
    if (!Object.hasOwn(extra, field)) continue
    const number = nullableNumber(extra[field])
    extra[field] = number != null && Number.isInteger(number) && number > (field === 'wgMtu' ? 575 : 0) ? number : null
  }
  for (const field of ['geckoMinPacketSize', 'geckoMaxPacketSize']) {
    if (!Object.hasOwn(extra, field)) continue
    extra[field] = positiveIntString(extra[field])
  }
  if (Object.hasOwn(extra, 'httpHeaders')) extra.httpHeaders = configType === 'HTTP' ? nullWhenEmpty(extra.httpHeaders) : null
  for (const field of ['uot', 'naiveQuic', 'isSingboxEndpoint']) {
    if (Object.hasOwn(extra, field)) extra[field] = extra[field] === true ? true : null
  }
  return extra
}

export function normalizeProfileTransportExtra(value: Dict): Dict {
  const extra: Dict = { ...value }
  for (const field of nullableTransportTextFields) {
    if (Object.hasOwn(extra, field)) extra[field] = nullWhenEmpty(extra[field])
  }
  if (Object.hasOwn(extra, 'kcpMtu')) {
    const kcpMtu = nullableNumber(extra.kcpMtu)
    extra.kcpMtu = kcpMtu != null && kcpMtu > 0 ? kcpMtu : null
  }
  return extra
}
