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

// Canonical camelCase names from the Web API contract. The backend stores
// ServiceLib's PascalCase properties (VlessEncryption, Flow, ...), but accepts
// both casings because its JSON reader is case-insensitive. A payload carrying
// both variants is ambiguous: System.Text.Json applies the last matching
// property, so a stale lowercase default can overwrite the live value.
const protocolExtraKeys = [
  'uot', 'congestionControl', 'httpHeaders', 'alterId', 'vmessSecurity', 'flow',
  'vlessEncryption', 'ssMethod', 'wgPublicKey', 'wgPresharedKey', 'wgInterfaceAddress',
  'wgReserved', 'wgMtu', 'wgDns', 'salamanderPass', 'upMbps', 'downMbps', 'ports',
  'hopInterval', 'hy2RealmUrl', 'geckoMinPacketSize', 'geckoMaxPacketSize',
  'insecureConcurrency', 'naiveQuic', 'masquePath', 'masqueHeaders', 'groupType',
  'childItems', 'subChildItems', 'filter', 'multipleLoad', 'isSingboxEndpoint',
] as const

const transportExtraKeys = [
  'rawHeaderType', 'host', 'path', 'xhttpMode', 'xhttpExtra', 'grpcAuthority',
  'grpcServiceName', 'grpcMode', 'kcpHeaderType', 'kcpSeed', 'kcpMtu',
] as const

function findCaseInsensitiveKey(record: Dict, canonical: string): string | undefined {
  if (Object.hasOwn(record, canonical)) return canonical
  const lower = canonical.toLowerCase()
  return Object.keys(record).find((key) => key.toLowerCase() === lower)
}

/**
 * Collapse case-insensitive duplicate keys into the canonical API names.
 *
 * Unchanged saves must keep the value already stored by the backend. When a
 * profile carries both `VlessEncryption` (the live ServiceLib value) and a
 * stale `vlessEncryption` default, the backend-native PascalCase value wins.
 * An explicit edit in the form or the advanced JSON still wins over it.
 */
export function reconcileProfileExtraKeys(
  extra: Dict,
  kind: 'protocol' | 'transport',
  context: { advanced: Dict; current: Dict; initial: Dict },
): Dict {
  const known: readonly string[] = kind === 'protocol' ? protocolExtraKeys : transportExtraKeys
  const groups = new Map<string, { canonical: string; keys: string[] }>()
  for (const key of Object.keys(extra)) {
    const canonical = known.find((candidate) => candidate.toLowerCase() === key.toLowerCase()) ?? key
    const groupKey = canonical.toLowerCase()
    const group = groups.get(groupKey)
    if (group) group.keys.push(key)
    else groups.set(groupKey, { canonical, keys: [key] })
  }

  const result: Dict = {}
  for (const { canonical, keys } of groups.values()) {
    if (keys.length === 1) {
      result[canonical] = extra[keys[0]]
      continue
    }

    const initialKey = findCaseInsensitiveKey(context.initial, canonical)
    const initialValue = initialKey === undefined ? undefined : context.initial[initialKey]
    const edited = (source: Dict) => {
      const key = findCaseInsensitiveKey(source, canonical)
      return key !== undefined && JSON.stringify(source[key]) !== JSON.stringify(initialValue)
    }

    const canonicalKey = keys.find((key) => key === canonical)
    const backendNativeKey = keys.find((key) => /^[A-Z]/.test(key)) ?? keys.find((key) => key !== canonical)
    const winningKey = canonicalKey && (edited(context.current) || edited(context.advanced))
      ? canonicalKey
      : backendNativeKey ?? canonicalKey ?? keys[0]
    result[canonical] = extra[winningKey]
  }
  return result
}

function nullWhenEmpty(value: unknown): unknown {
  return value === '' ? null : value
}

function positiveIntString(value: unknown): string | null {
  const number = nullableNumber(value)
  return number != null && Number.isInteger(number) && number > 0 ? String(number) : null
}

function isRecord(value: unknown): value is Dict {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

// The form owns only the fields the user actually changed since loading; other
// JSON-edited compatibility fields keep the advanced editor's value.
export function mergeFormEdits(advanced: Dict, current: Dict, initial: Dict): Dict {
  const merged = { ...advanced }
  const keys = new Set([...Object.keys(current), ...Object.keys(initial)])
  for (const key of keys) {
    const hasCurrent = Object.prototype.hasOwnProperty.call(current, key)
    const hasInitial = Object.prototype.hasOwnProperty.call(initial, key)
    if (hasCurrent === hasInitial && JSON.stringify(current[key]) === JSON.stringify(initial[key])) continue
    if (!hasCurrent) {
      delete merged[key]
    } else if (isRecord(current[key]) && isRecord(initial[key])) {
      merged[key] = mergeFormEdits(isRecord(merged[key]) ? merged[key] : {}, current[key], initial[key])
    } else {
      merged[key] = current[key]
    }
  }
  return merged
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
