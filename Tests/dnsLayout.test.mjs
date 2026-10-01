import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const stylePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src/style.css')
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src')

test('DNS settings use full workspace width without removing the workspace cap or responsive form grids', async () => {
  const css = await readFile(stylePath, 'utf8')
  assert.match(css, /\.workspace\s*\{\s*width:\s*min\(100%,\s*1880px\)/)
  assert.match(css, /\.dns-page \.settings-section\s*\{\s*width:\s*100%;\s*max-width:\s*none;\s*\}/)
  assert.match(css, /\.dns-core-section\s*\{\s*width:\s*100%;\s*\}/)
  assert.doesNotMatch(css, /\.dns-page \.settings-section\s*\{[^}]*max-width:\s*(?:1180|860)px/)
  assert.match(css, /\.form-grid\.three-col\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.form-grid\.two-col, \.form-grid\.three-col\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /\.form-grid input, \.form-grid select, \.form-grid textarea\s*\{[^}]*min-width:\s*0/)
})

test('Core DNS editor exposes and round-trips normal and TUN data with embedded-default import', async () => {
  const [page, composable] = await Promise.all([
    readFile(path.join(sourceRoot, 'Components/Pages/DnsPage.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Composables/useDns.ts'), 'utf8'),
  ])
  assert.match(page, /v-model="activeDnsProfile\.normalDNS"/)
  assert.match(page, /v-model="activeDnsProfile\.tunDNS"/)
  assert.match(page, /actions\.importDefaultDns\(activeDnsProfile\)/)
  assert.match(composable, /tunDNS: profile\.tunDNS/)
  assert.match(composable, /options\.data\('\/api\/settings\/dns\/editor-options'\)/)
  assert.match(composable, /\/api\/settings\/dns\/defaults/)
  assert.doesNotMatch(page, /TUN DNS.*hidden|TunDNS.*preserve/i)
})

test('Core DNS editor uses independent desktop columns and a mobile single-column field order', async () => {
  const [page, css] = await Promise.all([
    readFile(path.join(sourceRoot, 'Components/Pages/DnsPage.vue'), 'utf8'),
    readFile(stylePath, 'utf8'),
  ])
  const coreSection = page.slice(page.indexOf('dns-core-section'))

  assert.match(coreSection, /<div class="dns-core-grid">[\s\S]*?<div class="dns-core-column">[\s\S]*?v-model="activeDnsProfile\.remarks"[\s\S]*?v-model="activeDnsProfile\.enabled"[\s\S]*?v-model="activeDnsProfile\.normalDNS"[\s\S]*?v-model="activeDnsProfile\.tunDNS"[\s\S]*?<\/div>\s*<div class="dns-core-column">[\s\S]*?v-model="activeDnsProfile\.domainStrategy4Freedom"[\s\S]*?v-model="activeDnsProfile\.domainDNSAddress"[\s\S]*?v-model="activeDnsProfile\.useSystemHosts"/)
  assert.doesNotMatch(coreSection, /form-grid\s+two-col/)
  assert.match(css, /\.dns-core-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*align-items:\s*start/)
  assert.match(css, /\.dns-core-column\s*\{[^}]*display:\s*grid[^}]*align-content:\s*start[^}]*align-items:\s*start/)
  assert.match(css, /\.dns-core-column textarea\.dns-code\s*\{[^}]*min-height:\s*280px;\s*resize:\s*vertical/)
  assert.match(css, /\.dns-core-column input:not\(\[type="checkbox"\]\), \.dns-core-column select, \.dns-core-column textarea\s*\{[^}]*max-width:\s*100%/)
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.dns-core-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.dns-core-column input:not\(\[type="checkbox"\]\), \.dns-core-column select\s*\{\s*min-height:\s*var\(--control-height-touch\)/)
})

test('shared form grids align mixed controls from the top without changing their order', async () => {
  const css = await readFile(stylePath, 'utf8')
  assert.match(css, /\.form-grid\s*\{[^}]*align-items:\s*start/)
  assert.match(css, /\.button, \.tool-button, \.link-button\s*\{[^}]*min-height:\s*var\(--control-height\)/)
  assert.match(css, /\.form-grid input, \.form-grid select, \.form-grid textarea[^\{]*\{[^}]*min-height:\s*var\(--control-height\)/)
  assert.match(css, /\.form-grid > \.button, \.form-grid > \.tool-button, \.form-grid > \.file-button\s*\{\s*align-self:\s*end/)
  assert.match(css, /\.profile-alias-input \.button\s*\{[^}]*min-height:\s*var\(--control-height\)/)
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.profile-alias-input \.button\s*\{\s*min-height:\s*var\(--control-height-touch\)/)
  assert.match(css, /\.form-grid \.check-inline\s*\{[^}]*min-height:\s*var\(--control-height\)/)
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.form-grid \.check-inline\s*\{\s*min-height:\s*var\(--control-height-touch\)/)
})

test('Core DNS save retains all profile values and reloads the profile after PUT', async () => {
  const [page, composable] = await Promise.all([
    readFile(path.join(sourceRoot, 'Components/Pages/DnsPage.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Composables/useDns.ts'), 'utf8'),
  ])

  for (const field of ['enabled', 'useSystemHosts', 'normalDNS', 'tunDNS', 'domainStrategy4Freedom', 'domainDNSAddress']) {
    assert.ok(page.includes(`activeDnsProfile.${field}`), `DNS editor exposes ${field}`)
    assert.ok(composable.includes(`${field}: profile.${field}`), `DNS profile save includes ${field}`)
  }
  assert.match(composable, /method: 'PUT',[\s\S]*?await loadDns\(\)/)
  assert.match(composable, /options\.data\('\/api\/settings\/dns\/profiles'\)/)
})
