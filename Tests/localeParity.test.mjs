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
  'dns.domainDnsAddress': 'TbSettingsDomainDNSAddress',
  'settings.title': 'menuOptionSetting',
  'settings.coreTab': 'TbSettingsCore',
  'settings.core': 'TbSettingsCore',
  'settings.sniffing': 'TbSettingsSniffingEnabled',
  'settings.destOverride': 'TbSettingsDestOverride',
  'settings.ipApiUrl': 'TbSettingsIPAPIUrl',
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
