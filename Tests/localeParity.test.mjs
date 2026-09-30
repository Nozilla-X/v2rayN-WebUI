import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const testRoot = path.dirname(fileURLToPath(import.meta.url))
const localeRoot = path.resolve(testRoot, '../Src/Locales')
const localeNames = ['zh-CN', 'zh-TW', 'en-US']

// Desktop wording snapshots keep this parity check standalone, without loading ServiceLib resources.
const desktopLabelsPath = path.join(testRoot, 'fixtures/desktop-labels.json')

function getKey(locale, keyPath) {
  return keyPath.split('.').reduce((value, key) => value?.[key], locale)
}

test('Desktop-parity labels stay identical in all independent WebUI locales', async () => {
  const desktopLabels = JSON.parse(await readFile(desktopLabelsPath, 'utf8'))
  for (const name of localeNames) {
    const locale = JSON.parse(await readFile(path.join(localeRoot, `${name}.json`), 'utf8'))
    for (const [keyPath, expected] of Object.entries(desktopLabels[name])) {
      assert.equal(getKey(locale, keyPath), expected, `${name}: ${keyPath}`)
    }
  }
})
