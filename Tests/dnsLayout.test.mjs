import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const stylePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src/style.css')

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
