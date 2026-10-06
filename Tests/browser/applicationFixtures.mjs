export function applicationFixtures() {
  const name = '移动端测试节点'
  const rules = Array.from({ length: 8 }, (_, i) => ({ id: `rule-${i}`, remarks: i ? `规则 ${i} · 绕过局域网域名` : '', enabled: true, outboundTag: i < 4 ? 'direct' : 'proxy', domain: [`geosite:test-${i}`] }))
  return {
    '/api/setup/status': { setupRequired: false },
    '/api/status': { coreRunning: true, coreType: 'Xray', runtimeState: 'running', currentProfileName: name, statisticsEnabled: true, listeners: [{ name: 'local', listening: true, listenAddress: '0.0.0.0', port: 1145, protocols: ['http', 'socks', 'udp'] }], traffic: {} },
    '/api/operations': [],
    '/api/profile-groups': [{ id: '', name: '全部', profileCount: 3 }, { id: 'network', name: '测试订阅', profileCount: 3 }],
    '/api/profiles': ['A', 'B', 'C'].map(indexId => ({ indexId, remarks: `${name} ${indexId}`, configType: 'VLESS', protocol: 'vless', address: 'node.example.invalid', port: 443, network: 'raw', streamSecurity: 'reality', isCurrent: indexId === 'A' })),
    '/api/editor-options': { profiles: { configTypes: ['VLESS', 'VMess'], coreTypes: ['Xray', 'sing_box'], networks: ['raw', 'ws'], defaultNetwork: 'raw', defaultStreamSecurity: 'none' }, subscriptions: {} },
    '/api/subscriptions': [
      { id: 'local', remarks: '自建', enabled: true, url: '', autoUpdateInterval: 0, userAgent: '', filter: '' },
      { id: 'network', remarks: '测试网络', enabled: true, url: 'https://subscription.example.invalid/layout-fixture', autoUpdateInterval: 0, updateTime: 1791212280, userAgent: '', filter: '' },
      { id: 'long', remarks: '长订阅名称 / '.repeat(6), enabled: false, url: 'https://subscription.example.invalid/' + 'long-path-'.repeat(20), autoUpdateInterval: 60, userAgent: 'Fixture agent', filter: '香港|Tokyo' },
    ],
    '/api/settings': { inbound: { localPort: 1145, udpEnabled: true, sniffingEnabled: true, destOverride: ['http', 'tls'] }, core: { logEnabled: true, loglevel: 'warning' }, app: { enableStatistics: true }, speedTest: { speedTestTimeout: 10, mixedConcurrencyCount: 3 }, coreTypes: [{ configType: 'VLESS', coreType: 'Xray' }], options: { destOverrideProtocols: ['http', 'tls', 'quic'], logLevels: ['warning', 'info'], routingBasicDomainStrategies: ['AsIs', 'IPIfNonMatch'], routingBasicDomainStrategies4Singbox: ['prefer_ipv4'] } },
    '/api/settings/routing-profiles': [{ id: 'route', remarks: 'V4-测试规则集', isActive: true, enabled: true, ruleNum: 8, url: 'https://rules.example.invalid/fixture.json' }],
    '/api/settings/routing-profiles/route/rules': rules,
    '/api/settings/dns/simple': { directDNS: 'https://dns.example.invalid/dns-query', remoteDNS: '1.1.1.1', bootstrapDNS: '223.5.5.5' },
    '/api/settings/dns/profiles': ['Xray', 'sing_box'].map(coreType => ({ coreType, remarks: 'DNS fixture', enabled: false, normalDNS: '{}', tunDNS: '{}', domainStrategy4Freedom: 'UseIPv4' })),
    '/api/settings/dns/editor-options': { coreTypes: ['Xray', 'sing_box'], domainStrategies4Freedom: ['UseIPv4'], domainStrategies4Singbox: ['prefer_ipv4'], domainDnsAddresses: ['223.5.5.5'] },
    '/api/settings/core-templates': ['Xray', 'sing_box'].map(coreType => ({ coreType, remarks: 'Template fixture', enabled: true, config: '{}', tunConfig: '{}', addProxyOnly: true, proxyDetour: '' })),
    '/api/settings/webdav': { url: 'https://dav.example.invalid', userName: 'fixture', dirName: 'backup', hasPassword: false },
    '/api/core-updates': { useProxy: true, geoFilesSelected: true, checkPreReleaseCoreTypes: [], targets: ['Xray', 'sing_box'].map(coreType => ({ coreType, nameKey: coreType === 'Xray' ? 'maintenance.coreNames.xray' : 'maintenance.coreNames.singBox', selected: true, isSupported: true, supportsPreRelease: true, canInstall: true })) },
    '/api/core-updates/progress': [],
    '/api/web-updates': { selected: true, isSupported: true, canCheck: true, canInstall: true, version: '7.25.5', commit: 'fixture', buildDate: '2026-10-07', rid: 'linux-x64', deployment: 'fixture' },
    '/api/logs/page': { page: 1, total: 8, items: Array.from({ length: 8 }, (_, i) => ({ timestamp: `2026-10-07T01:0${i}:00Z`, source: 'Xray', message: `accepted tcp:node.example.invalid:443 [fixture ${i}]` })) },
    '/api/subscriptions/network/share': { url: 'https://share.example.invalid/fixture' },
    '/api/subscriptions/local/share': { url: 'https://share.example.invalid/local' },
  }
}
