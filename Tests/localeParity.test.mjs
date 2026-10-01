import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createI18n } from 'vue-i18n'

const testRoot = path.dirname(fileURLToPath(import.meta.url))
const localeRoot = path.resolve(testRoot, '../Src/Locales')
const localeNames = ['zh-CN', 'zh-TW', 'en-US']

// Desktop wording snapshots keep this parity check standalone, without loading ServiceLib resources.
const desktopLabelsPath = path.join(testRoot, 'fixtures/desktop-labels.json')

function createLocalizer(name, messages) {
  return createI18n({ legacy: false, locale: name, messages: { [name]: messages }, missingWarn: false, fallbackWarn: false })
}

test('Desktop-parity labels stay identical in all independent WebUI locales', async () => {
  const desktopLabels = JSON.parse(await readFile(desktopLabelsPath, 'utf8'))
  for (const name of localeNames) {
    const messages = JSON.parse(await readFile(path.join(localeRoot, `${name}.json`), 'utf8'))
    const i18n = createLocalizer(name, messages)
    for (const [keyPath, expected] of Object.entries(desktopLabels[name])) {
      // Compare rendered messages so escaped literals match the Desktop wording snapshots.
      assert.equal(i18n.global.t(keyPath), expected, `${name}: ${keyPath}`)
    }
  }
})
