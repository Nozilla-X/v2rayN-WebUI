import { normalizeApiBase } from './apiEndpoint'

export const backendHistoryStorageKey = 'v2rayn-api-endpoint-history'
export const backendHistoryLimit = 10

export function normalizeBackendHistory(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const addresses: string[] = []
  for (const value of values.slice(0, 100)) {
    if (typeof value !== 'string' || value.length > 2048) continue
    try {
      const address = normalizeApiBase(value)
      if (address && !addresses.includes(address)) addresses.push(address)
    } catch { /* Invalid or credential-bearing URLs never become history options. */ }
    if (addresses.length === backendHistoryLimit) break
  }
  return addresses
}

export function restoreBackendHistory(raw: string | null, legacyAddress: string | null): string[] {
  // Migrate the old single address only before a history preference exists.
  // An explicitly empty history must stay empty after the user removes its entries.
  if (raw === null) return normalizeBackendHistory([legacyAddress])
  if (raw.length > 65536) return []
  try { return normalizeBackendHistory(JSON.parse(raw)) } catch { return [] }
}
