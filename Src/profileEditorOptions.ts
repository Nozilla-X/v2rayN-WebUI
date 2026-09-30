export function canonicalNetwork(value: unknown, networks: readonly string[], defaultNetwork: string): string {
  const network = String(value ?? '').trim().toLowerCase()
  if (network === '' || network === 'tcp') return defaultNetwork
  return networks.includes(network)
    ? network
    : defaultNetwork
}

export function shadowsocksSecurityOptions(
  coreType: unknown,
  mappedCoreType: unknown,
  options: Record<string, string[]>,
): readonly string[] {
  const selectedCore = String(coreType ?? '').trim()
  const core = selectedCore || String(mappedCoreType ?? '')
  const match = Object.keys(options).find((key) => key.toLowerCase() === core.toLowerCase())
  return match ? options[match] : []
}
