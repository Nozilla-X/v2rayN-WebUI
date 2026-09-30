import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('production UI uses same-origin API calls and Vite only proxies during development', async () => {
  const vite = await readFile(new URL('vite.config.js', root), 'utf8')
  assert.match(vite, /base:\s*'\/'/)
  assert.match(vite, /server:\s*\{[\s\S]*proxy:\s*\{[\s\S]*'\/api'/)
  assert.match(vite, /process\.env\.VITE_API_TARGET\s*\|\|\s*'http:\/\/127\.0\.0\.1:5080'/)

  for (const relativePath of [
    'Src/Composables/useApi.ts',
    'Src/Composables/useSession.ts',
    'Src/Composables/useEvents.ts',
  ]) {
    const source = await readFile(new URL(relativePath, root), 'utf8')
    assert.doesNotMatch(source, /https?:\/\/|localhost|127\.0\.0\.1|:5080/)
  }
})
