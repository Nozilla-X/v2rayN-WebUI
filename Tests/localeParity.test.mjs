import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const testRoot = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.resolve(testRoot, '../../../ServiceLib/Resx')
const localeFiles = {
  'zh-CN': ['zh-CN.json', 'ResUI.zh-Hans.resx'],
  'zh-TW': ['zh-TW.json', 'ResUI.zh-Hant.resx'],
  'en-US': ['en-US.json', 'ResUI.resx'],
}

const parity = {
  'nav.subscriptions': 'menuSubscription',
  'nav.routing': 'menuRoutingSetting',
  'nav.dns': 'menuDNSSetting',
  'nav.settings': 'menuOptionSetting',
  'subscriptions.title': 'menuSubscription',
  'subscriptions.name': 'LvRemarks',
  'subscriptions.url': 'LvUrl',
  'subscriptions.moreUrl': 'LvMoreUrl',
  'subscriptions.enabled': 'LvEnabled',
  'subscriptions.interval': 'LvAutoUpdateInterval',
  'subscriptions.userAgent': 'LvUserAgent',
  'subscriptions.requestHeaders': 'LvRequestHeaders',
  'subscriptions.requestHeadersTip': 'SubRequestHeadersTips',
  'subscriptions.filter': 'LvFilter',
  'subscriptions.convertTarget': 'LvConvertTarget',
  'subscriptions.sort': 'LvSort',
  'subscriptions.prevProfile': 'LvPrevProfile',
  'subscriptions.nextProfile': 'LvNextProfile',
  'subscriptions.preSocksPort': 'TbPreSocksPort4Sub',
  'subscriptions.memo': 'LvMemo',
  'subscriptions.customCoreType': 'LvCustomCoreType',
  'subscriptions.chooseProfile': 'TbSelectProfile',
  'nodes.groupEdit': 'menuSubEdit',
  'nodes.groupAdd': 'menuSubAdd',
  'nodes.groupDelete': 'menuSubDelete',
  'nodes.filterPlaceholder': 'MsgServerTitle',
  'nodes.title': 'menuServers',
  'nodes.type': 'LvServiceType',
  'nodes.remarks': 'LvRemarks',
  'nodes.address': 'LvAddress',
  'nodes.port': 'LvPort',
  'nodes.network': 'LvTransportProtocol',
  'nodes.tls': 'LvTLS',
  'nodes.groupColumn': 'LvSubscription',
  'nodes.delay': 'LvTestDelay',
  'nodes.speed': 'LvTestSpeed',
  'nodes.ip': 'LvTestIpInfo',
  'nodes.switch': 'menuSetDefaultServer',
  'nodes.copySelected': 'menuCopyServer',
  'nodes.removeSelected': 'menuRemoveServer',
  'nodes.deduplicate': 'menuRemoveDuplicateServer',
  'nodes.removeInvalid': 'menuRemoveInvalidServerResult',
  'nodes.tcping': 'menuTcpingServer',
  'nodes.realping': 'menuRealPingServer',
  'nodes.udp': 'menuUdpTestServer',
  'nodes.speedtest': 'menuSpeedServer',
  'nodes.sortByTestResults': 'menuSortServerResult',
  'nodes.moveGroup': 'menuMoveToGroup',
  'nodes.top': 'menuMoveTop',
  'nodes.up': 'menuMoveUp',
  'nodes.down': 'menuMoveDown',
  'nodes.bottom': 'menuMoveBottom',
  'nodes.shareMenu': 'menuShareServer',
  'nodes.exportMenu': 'menuExportConfig',
  'nodes.generatePolicyGroups': 'menuGenGroupServer',
  'nodes.allProfiles': 'menuAllServers',
  'nodes.generateRegionGroups': 'menuGenRegionGroup',
  'subscriptions.updateGroup': 'menuSubGroupUpdate',
  'subscriptions.updateGroupViaProxy': 'menuSubGroupUpdateViaProxy',
  'routing.title': 'menuRoutingSetting',
  'routing.rules': 'TbRoutingTabRuleList',
  'routing.regionalPreset': 'menuRegionalPresets',
  'routing.setDefault': 'menuRoutingAdvancedSetDefault',
  'routing.importProfiles': 'menuRoutingAdvancedImportRules',
  'dns.title': 'menuDNSSetting',
  'dns.basicTab': 'ThBasicDNSSettings',
  'dns.advancedTab': 'ThAdvancedDNSSettings',
  'dns.xrayTab': 'TbCustomDnsRay',
  'dns.singboxTab': 'TbCustomDnsSingbox',
  'dns.enabled': 'TbCustomDNSEnable',
  'dns.directDns': 'TbDomesticDNS',
  'dns.remoteDns': 'TbRemoteDNS',
  'dns.bootstrapDns': 'TbBootstrapDNS',
  'dns.strategyFreedom': 'TbDirectResolveStrategy',
  'dns.strategyProxy': 'TbRemoteResolveStrategy',
  'dns.strategyProxyDial': 'TbProxyDialResolveStrategy',
  'dns.useSystemHosts': 'TbSettingsUseSystemHosts',
  'dns.addCommonHosts': 'TbAddCommonDNSHosts',
  'dns.fakeIp': 'TbFakeIP',
  'dns.blockBindingQuery': 'TbBlockSVCBHTTPSQueries',
  'dns.blockAAAAQuery': 'TbBlockAAAAQueries',
  'dns.directExpectedIPs': 'TbValidateDirectExpectedIPs',
  'dns.hosts': 'TbDNSHostsConfig',
  'dns.serveStale': 'TbServeStale',
  'dns.parallelQuery': 'TbParallelQuery',
  'dns.happyEyeballs': 'TbEnableHappyEyeballs',
  'dns.domainStrategy': 'TbSettingsDomainStrategy4Freedom',
  'dns.domainStrategy4Out': 'TbSettingsDomainStrategy4Out',
  'dns.domainDnsAddress': 'TbSettingsDomainDNSAddress',
  'dns.tunDns': 'TbSettingsTunMode',
  'dns.importDefaultConfig': 'TbSettingDnsImportDefConfig',
  'dns.docsXray': 'TbDnsObjectDoc',
  'dns.docsSingbox': 'TbDnsSingboxObjectDoc',
  'nodes.displayLog': 'TbDisplayLog',
  'nodes.preSocksPort': 'TbPreSocksPort',
  'nodes.coreType': 'TbCoreType',
  'settings.title': 'menuOptionSetting',
  'settings.coreTab': 'TbSettingsCore',
  'settings.core': 'TbSettingsCore',
  'settings.application': 'TbSettingsN',
  'settings.coreTypes': 'TbSettingsCoreType',
  'settings.localPort': 'TbSettingsSocksPort',
  'settings.secondPort': 'TbSettingsSecondLocalPortEnabled',
  'settings.udp': 'TbSettingsUdpEnabled',
  'settings.sniffing': 'TbSettingsSniffingEnabled',
  'settings.destOverride': 'TbSettingsDestOverride',
  'settings.routeOnly': 'TbSettingsRouteOnly',
  'settings.allowLan': 'TbSettingsAllowLAN',
  'settings.newLanPort': 'TbSettingsNewPort4LAN',
  'settings.user': 'TbSettingsUser',
  'settings.pass': 'TbSettingsPass',
  'settings.logEnabled': 'TbSettingsLogEnabledToFile',
  'settings.loglevel': 'TbSettingsLogLevel',
  'settings.fingerprint': 'TbSettingsDefFingerprint',
  'settings.userAgent': 'TbSettingsDefUserAgent',
  'settings.bindInterface': 'TbSettingsBindInterface',
  'settings.sendThrough': 'TbSettingsSendThrough',
  'settings.muxRay': 'TbSettingsMux4Ray',
  'settings.muxSboxProtocol': 'TbSettingsMux4SboxProtocol',
  'settings.cacheSbox': 'TbSettingsEnableCacheFile4Sbox',
  'settings.fragment': 'TbSettingsEnableFragment',
  'settings.fragmentPackets': 'TbSettingsFragmentPackets',
  'settings.fragmentLengths': 'TbSettingsFragmentLength',
  'settings.fragmentDelays': 'TbSettingsFragmentInterval',
  'settings.fragmentMaxSplit': 'TbSettingsFragmentMaxSplit',
  'settings.finalFragment': 'TbEnableFinalFragment',
  'settings.statistics': 'TbSettingsStatistics',
  'settings.realtimeSpeed': 'TbSettingsDisplayRealTimeSpeed',
  'settings.keepOlderDedupl': 'TbSettingsKeepOlderDedupl',
  'settings.rootCertProvider': 'TbRootCertificateProvider',
  'settings.geoAutoUpdate': 'TbSettingsAutoUpdateInterval',
  'settings.mixedConcurrency': 'TbSettingsMixedConcurrencyCount',
  'settings.speedTimeout': 'TbSettingsSpeedTestTimeout',
  'settings.speedUrl': 'TbSettingsSpeedTestUrl',
  'settings.pingUrl': 'TbSettingsSpeedPingTestUrl',
  'settings.udpTarget': 'TbSettingsUdpTestUrl',
  'settings.ipApiUrl': 'TbSettingsIPAPIUrl',
  'settings.subConvertUrl': 'TbSettingsSubConvert',
  'settings.geoSourceUrl': 'TbSettingsGeoFilesSource',
  'settings.srsSourceUrl': 'TbSettingsSrsFilesSource',
  'settings.routeRulesSourceUrl': 'TbSettingsRoutingRulesSource',
  'nodes.ip': 'LvTestIpInfo',
  'nodes.speedtest': 'menuSpeedServer',
  'nodes.realping': 'menuRealPingServer',
  'nodes.tcping': 'menuTcpingServer',
  'nodes.sortByTestResults': 'menuSortServerResult',
}

function getKey(locale, keyPath) {
  return keyPath.split('.').reduce((value, key) => value?.[key], locale)
}

function decodeXml(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function getResxValue(xml, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`<data\\s+name="${escaped}"[^>]*>\\s*<value>([\\s\\S]*?)<\\/value>`))
  assert.ok(match, `Desktop resource ${key} exists`)
  return decodeXml(match[1])
}

test('Web labels mapped to Desktop resources stay identical in zh-CN, zh-TW, and en-US', async () => {
  for (const [name, [localeFile, resxFile]] of Object.entries(localeFiles)) {
    const locale = JSON.parse(await readFile(path.join(testRoot, '../Src/Locales', localeFile), 'utf8'))
    const resx = await readFile(path.join(sourceRoot, resxFile), 'utf8')
    for (const [keyPath, resourceName] of Object.entries(parity)) {
      assert.equal(getKey(locale, keyPath), getResxValue(resx, resourceName), `${name}: ${keyPath} ↔ ${resourceName}`)
    }
  }
})
