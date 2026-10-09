import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src')

test('new and existing subscription saves call the API directly and do not trigger updates', async () => {
  const source = await readFile(path.join(sourceRoot, 'Composables/useSubscriptions.ts'), 'utf8')
  const modal = await readFile(path.join(sourceRoot, 'Components/Modals/SubscriptionModal.vue'), 'utf8')
  const start = source.indexOf('async function saveSubscription()')
  const end = source.indexOf('\n  async function deleteSubscription(', start)
  const saveBody = source.slice(start, end)

  assert.notEqual(start, -1)
  assert.match(saveBody, /const result = await options\.request\(/)
  assert.match(saveBody, /isEditing \? `\/api\/subscriptions\/\$\{encodeURIComponent\(editingId\)\}` : '\/api\/subscriptions'/)
  assert.match(saveBody, /method: isEditing \? 'PUT' : 'POST'/)
  assert.doesNotMatch(saveBody, /updateSubscription\s*\(/)
  assert.match(saveBody, /showSubscriptionForm\.value = false[\s\S]*?await Promise\.all\(\[loadSubscriptions\(\), options\.loadGroups\(\)\]\)/)
  assert.match(modal, /@submit\.prevent="actions\.saveSubscription"/)
  assert.match(modal, /<UiButton class="primary" type="submit">\{\{ t\('common\.save'\) \}\}<\/UiButton>/)
  assert.match(source, /remarks: '', url: '', moreUrl: '', enabled: true/)
  assert.match(source, /autoUpdateInterval: 0/)
  assert.match(source, /autoUpdateInterval: Number\(subscriptionForm\.value\.autoUpdateInterval \?\? 0\)/)
  assert.match(modal, /subscriptions\.url[^\n]*<input v-model="state\.subscriptionForm\.url" inputmode="url"\s*\/>/)
  assert.doesNotMatch(modal, /subscriptionForm\.url"[^>]*required/)
})
