import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { preventNativeContextMenu } from '../Src/Components/contextMenu.ts'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src')

test('profile and subscription group context actions suppress native menus on consecutive right-clicks', async () => {
  const [nodesPage, app, flyout] = await Promise.all([
    readFile(path.join(sourceRoot, 'Components/Pages/NodesPage.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Features/Profiles/NodeContextMenu.vue'), 'utf8'),
    readFile(path.join(sourceRoot, 'Components/FlyoutMenu.vue'), 'utf8'),
  ])
  assert.match(nodesPage, /@contextmenu\.stop\.prevent="actions\.openContext\(\$event, profile\)"/)
  assert.match(nodesPage, /@contextmenu\.prevent\.stop="actions\.openSubscriptionContext\(\$event, group\)"/)
  assert.match(nodesPage, /class="group-chips"[^>]*@contextmenu\.prevent\.stop="openSelectedGroupContext\(\$event\)"/)
  assert.match(nodesPage, /function openSelectedGroupContext\([\s\S]*?state\.selectedGroup[\s\S]*?actions\.openSubscriptionContext\(event, group\)/)
  assert.match(nodesPage, /@dblclick\.prevent\.stop="openGroupOnDoubleClick\(\$event, group\)"/)
  assert.match(nodesPage, /function openGroupOnDoubleClick\([\s\S]*?window\.matchMedia\('\(max-width: 760px\)'\)[\s\S]*?actions\.openSubscriptionContext\(event, group\)[\s\S]*?actions\.openEditSubscription\(subscription\)/)
  assert.match(nodesPage, /function selectGroupOnClick\([\s\S]*?event\.detail > 1/)
  assert.doesNotMatch(nodesPage, /group-chip-more/)
  assert.match(app, /class="context-menu"[^>]*@contextmenu="preventNativeContextMenu"/)
  assert.match(app, /contextMenu\.type === 'subscription'[\s\S]*?nodes\.groupEdit[\s\S]*?nodes\.groupAdd[\s\S]*?nodes\.groupDelete/)
  assert.match(flyout, /class="action-menu-popup flyout-menu-popup"[\s\S]*?@contextmenu\.prevent\.stop/)
  assert.equal(app.includes("document.addEventListener('contextmenu'"), false)
  assert.equal(app.includes('window.addEventListener("contextmenu"'), false)

  const observed = []
  for (let click = 1; click <= 3; click += 1) {
    const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } }
    preventNativeContextMenu(event)
    observed.push([event.prevented, event.stopped])
  }
  assert.deepEqual(observed, [[true, true], [true, true], [true, true]])
})
