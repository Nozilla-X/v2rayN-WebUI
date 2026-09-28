import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webUiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localeNames = ['zh-CN', 'zh-TW', 'en-US']

function flatten(value, prefix = '', output = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, fullKey, output)
    else output.add(fullKey)
  }
  return output
}

const locales = new Map()
for (const name of localeNames) {
  const content = await readFile(path.join(webUiRoot, 'Src', 'Locales', `${name}.json`), 'utf8')
  locales.set(name, flatten(JSON.parse(content)))
}

const [baseName, baseKeys] = locales.entries().next().value
const errors = []
for (const [name, keys] of locales) {
  const missing = [...baseKeys].filter((key) => !keys.has(key))
  const extra = [...keys].filter((key) => !baseKeys.has(key))
  if (missing.length || extra.length) {
    errors.push(`${name}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`)
  }
  const apiNamespaces = [...keys].filter((key) => key.split('.')[0].endsWith('Api'))
  if (apiNamespaces.length) errors.push(`${name}: legacy API translation namespaces [${apiNamespaces.join(', ')}]`)
}

const sourceRoot = path.join(webUiRoot, 'Src')
const composablesRoot = path.join(sourceRoot, 'Composables')
const composableFiles = (await readdir(composablesRoot)).filter((file) => file.endsWith('.ts'))
const uiSources = [
  ['App.vue', await readFile(path.join(sourceRoot, 'App.vue'), 'utf8')],
  ...await Promise.all(composableFiles.map(async (file) => [
    path.join('Composables', file), await readFile(path.join(composablesRoot, file), 'utf8'),
  ])),
]
const uiKeys = new Set()
for (const [source, content] of uiSources) {
  for (const match of content.matchAll(/\bt\(\s*['"]([\w.-]+)['"]\s*(?:,|\))/g)) {
    const key = match[1]
    uiKeys.add(key)
    if (!baseKeys.has(key)) errors.push(`${source} references missing locale key: ${key}`)
  }
}

const contractsPath = path.resolve(webUiRoot, '..', 'Contracts', 'ApiModels.cs')
const contracts = await readFile(contractsPath, 'utf8')
const messageKeys = new Set([...contracts.matchAll(/public const string \w+ = "([^"]+)";/g)].map((match) => match[1]))
for (const key of messageKeys) {
  if (!baseKeys.has(key)) errors.push(`ApiMessageKeys references missing locale key: ${key}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Locale schema is aligned (${baseKeys.size} keys across ${localeNames.join(', ')}; ${uiKeys.size} UI keys; ${messageKeys.size} API message keys).`)
}
