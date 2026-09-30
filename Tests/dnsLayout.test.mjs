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
