import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('API connection fields belong above the Management Key in the original login card', async () => {
  const app = await readFile(new URL('../Src/Features/Session/SessionScreen.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /backend-wrap|backend-box/)
  const loginForm = app.match(/<form class="auth-box" @submit\.prevent="actions\.loginToBackend">([\s\S]*?)<\/form>/)?.[1]
  assert.ok(loginForm)
  assert.ok(loginForm.indexOf('<BackendAddressFields') < loginForm.indexOf('for="management-key"'))
  assert.match(loginForm, /@test="actions\.testConnection"/)
  assert.match(loginForm, /type="submit"[\s\S]*?t\('auth\.connect'\)/)
  const fields = await readFile(new URL('../Src/Components/BackendAddressFields.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(fields, /<form\b/)
  assert.equal((fields.match(/type="button"/g) || []).length, 3, 'apply, test and history buttons must never submit the login form')
  assert.match(fields, /@keydown\.enter\.prevent="emit\('test'\)"/)
})

test('first-run and local-only setup screens retain Backend switching inside their existing cards', async () => {
  const app = await readFile(new URL('../Src/Features/Session/SessionScreen.vue', import.meta.url), 'utf8')
  const localOnly = app.match(/<div class="auth-box setup-box">([\s\S]*?)<\/div>\s*<\/section>/)?.[1]
  const setup = app.match(/<form class="auth-box setup-box"[^>]*>([\s\S]*?)<\/form>/)?.[1]
  assert.match(localOnly, /<BackendAddressFields/)
  assert.match(setup, /<BackendAddressFields[\s\S]*?<div class="form-grid">/)
})
