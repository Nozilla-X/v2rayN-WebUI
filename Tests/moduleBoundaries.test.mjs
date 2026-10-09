import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createSourceHarness } from './helpers/loadSource.mjs'

test('feedback keeps the bounded Toast queue, deduplication and confirmation ordering', async t => {
  const harness = createSourceHarness()
  t.after(() => harness.dispose())
  const { useFeedback } = harness.loadSource('Src/UI/useFeedback.ts')
  const feedback = harness.setup(() => useFeedback(key => key, key => key))
  for (const message of ['one', 'two', 'three', 'four', 'five']) feedback.showNotice(message)
  assert.deepEqual(feedback.toasts.value.map(toast => toast.message), ['two', 'three', 'four', 'five'])
  const id = feedback.toasts.value.at(-1).id
  feedback.showNotice(' five ')
  assert.equal(feedback.toasts.value.length, 4)
  assert.equal(feedback.toasts.value.at(-1).id, id)
  feedback.showError({ name: 'AbortError' })
  assert.equal(feedback.toasts.value.at(-1).kind, 'success')
  feedback.showError({ code: 'profile_group_empty', data: { detail: 'fixture' } })
  assert.equal(feedback.toasts.value.at(-1).message, 'nodes.groupGenerationEmpty: fixture')

  const first = feedback.confirmDestructive('first')
  const second = feedback.confirmDestructive('second')
  assert.equal(feedback.activeConfirmation.value.message, 'first')
  await feedback.resolveConfirmation(true)
  assert.equal(await first, true)
  assert.equal(feedback.activeConfirmation.value.message, 'second')
  const third = feedback.confirmDestructive('third')
  feedback.reset()
  assert.equal(await second, false)
  assert.equal(await third, false)
  assert.equal(feedback.activeConfirmation.value, null)
  assert.deepEqual(feedback.toasts.value, [])
})

test('row-scoped single-key actions avoid browser shortcuts and preserve guards, modal priority and cleanup', async t => {
  const harness = createSourceHarness()
  let disposed = false
  const previous = { document: globalThis.document, Element: globalThis.Element }
  const listeners = new Map()
  let popup = null
  globalThis.document = {
    querySelector: () => popup,
    addEventListener: (name, handler, capture) => { assert.equal(capture, true); listeners.set(name, handler) },
    removeEventListener: (name, handler, capture) => { assert.equal(capture, true); assert.equal(listeners.get(name), handler); listeners.delete(name) },
  }
  globalThis.Element = class {
    constructor(editable = false, row = true) { this.editable = editable; this.row = row }
    closest(selector) { return selector === '.profile-table [data-profile-id]' ? (this.row ? {} : null) : (this.editable ? {} : null) }
  }
  t.after(async () => {
    if (!disposed) await harness.dispose()
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name]
      else globalThis[name] = value
    }
  })
  const { useGlobalShortcuts } = harness.loadSource('Src/UI/useGlobalShortcuts.ts')
  const calls = []
  const nodes = Object.fromEntries(['selectAllNodes', 'copySelectedShareLinks', 'editContextProfile', 'shareSelectedNodes', 'testSelectedNodes', 'selectContextProfile', 'deleteSelectedNodes', 'moveSelectedNodes'].map(name => [name, (...args) => calls.push([name, ...args])]))
  const activePage = harness.vue.ref('nodes')
  let confirmation = false
  const open = [true, true]
  const shortcut = harness.setup(() => useGlobalShortcuts({
    activePage, contextMenu: harness.vue.ref(null), nodes,
    confirmationOpen: () => confirmation,
    cancelConfirmation: async () => { confirmation = false; calls.push(['confirmation']) },
    modalLayers: open.map((_, index) => ({ isOpen: () => open[index], close: () => { open[index] = false; calls.push(['modal', index]) } })),
  }))
  for (const hook of harness.mounted) await hook()
  assert.equal(listeners.get('keydown'), shortcut.handleGlobalKeydown)
  function key(key, extra = {}) {
    const event = { key, target: new Element(), ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true }, ...extra }
    shortcut.handleGlobalKeydown(event)
    return event
  }
  confirmation = true
  assert.equal(key('Escape').stopped, true)
  key('Escape')
  key('Escape')
  assert.deepEqual(calls.splice(0), [['confirmation'], ['modal', 0], ['modal', 1]])
  for (const [letter, action, arg] of [['a', 'selectAllNodes'], ['c', 'copySelectedShareLinks'], ['e', 'editContextProfile'], ['s', 'shareSelectedNodes'], ['1', 'testSelectedNodes', 'tcping'], ['2', 'testSelectedNodes', 'realping'], ['3', 'testSelectedNodes', 'speedtest'], ['4', 'testSelectedNodes', 'udpTest'], ['5', 'testSelectedNodes', 'fastRealping'], ['6', 'testSelectedNodes', 'mixedtest']]) {
    assert.equal(key(letter).prevented, true)
    assert.deepEqual(calls.pop(), arg ? [action, arg] : [action])
  }
  for (const [letter, action, arg] of [['Enter', 'selectContextProfile'], ['Delete', 'deleteSelectedNodes'], ['t', 'moveSelectedNodes', 'top'], ['u', 'moveSelectedNodes', 'up'], ['d', 'moveSelectedNodes', 'down'], ['b', 'moveSelectedNodes', 'bottom']]) {
    assert.equal(key(letter).prevented, true)
    assert.deepEqual(calls.pop(), arg ? [action, arg] : [action])
  }
  assert.equal(key('a', { ctrlKey: true, target: new Element(true) }).prevented, false)
  assert.equal(key('a', { ctrlKey: true, shiftKey: true }).prevented, false)
  for (const letter of ['a', 'c', 'd', 'f', 'o', 'r', 't', 'w', 'l', 'n', 'p']) assert.equal(key(letter, { ctrlKey: true }).prevented, false)
  assert.equal(key('Backspace').prevented, false)
  assert.equal(key('1', { target: new Element(false, false) }).prevented, false)
  assert.equal(key('1', { target: new Element(true) }).prevented, false)
  assert.equal(key('1', { isComposing: true }).prevented, false)
  assert.equal(key('1', { altKey: true }).prevented, false)
  assert.equal(key('1', { metaKey: true }).prevented, false)
  assert.equal(key('1', { shiftKey: true }).prevented, false)
  activePage.value = 'settings'
  assert.equal(key('Delete').prevented, false)
  activePage.value = 'nodes'
  popup = {}
  assert.equal(key('Delete').prevented, false)
  assert.deepEqual(calls, [])
  await harness.dispose()
  disposed = true
  assert.equal(listeners.size, 0)
})

test('Shell and extracted editor sections retain native structure and shared state ownership', async () => {
  const source = file => readFile(new URL(`../Src/${file}`, import.meta.url), 'utf8')
  const [app, shell, dialog, profile, menu, adapter] = await Promise.all([
    source('App.vue'), source('Components/Shell/AppShell.vue'), source('Components/UI/UiDialog.vue'),
    source('Components/Modals/ProfileModal.vue'), source('Features/Profiles/NodeContextMenu.vue'), source('Features/Profiles/useNodeActions.ts'),
  ])
  assert.match(app, /<AppShell/)
  assert.match(shell, /<div class="app-shell"/)
  assert.match(shell, /<main id="workspace" class="workspace" tabindex="-1"><slot/)
  assert.doesNotMatch(app, /function (?:handleGlobalKeydown|positionContextMenu|nodeProfileForAction|openProfileExport)/)
  assert.match(app, /<NodeContextMenu v-model="contextMenu"/)
  assert.match(menu, /watch\(contextMenu/)
  assert.match(adapter, /return \[\.\.\.profiles\.selectedIds\.value\]/)
  assert.match(dialog, /useModalFocus\(dialog\)/)
  assert.match(dialog, /<form ref="dialog"/)
  assert.match(dialog, /@submit="emit\('submit', \$event\)"/)
  for (const section of ['ProfileGroupSection', 'ProfileTransportSection', 'ProfileSecuritySection']) assert.match(profile, new RegExp(`<${section}[^>]*:state="state"`))
  assert.match(profile, /canonicalizeProtocolChange\(configType\)/)
  assert.match(profile, /@submit\.prevent="actions\.saveProfile"/)
  const hints = [...menu.matchAll(/<span class="menu-shortcut">([^<]+)<\/span>/g)].map(match => match[1])
  assert.equal(new Set(hints).size, hints.length, 'right-click hints must not assign overlapping keys')
  assert.ok(hints.every(hint => !hint.includes('Ctrl+') && hint !== 'Backspace'))
})
