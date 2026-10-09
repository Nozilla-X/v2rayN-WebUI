import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'

async function withProfiles(run) {
  const harness = createSourceHarness()
  const previousElement = globalThis.Element
  globalThis.Element = class Element {}
  try {
    const { useProfiles } = harness.loadSource('Src/Composables/useProfiles.ts')
    const profiles = useProfiles({
      t: key => key,
      showNotice() {},
      showError: error => { throw error },
      confirm: async () => true,
      loadStatus: async () => {},
      loadOperations: async () => {},
      busy: harness.vue.ref(false),
      operations: harness.vue.ref([]),
      contextMenu: harness.vue.ref(null),
      request: async () => ({}),
      data: async () => [],
      operationMessage: () => '',
      queryPath: path => path,
      canonicalCode: value => value,
      coreTypeRoute: value => value,
    })
    profiles.profiles.value = ['A', 'B', 'C', 'D', 'E'].map(indexId => ({ indexId }))
    const click = (id, modifiers = {}) => profiles.nodesPageActions.focusProfile({
      target: null,
      currentTarget: { focus() {} },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      ...modifiers,
    }, profiles.profiles.value.find(profile => profile.indexId === id))
    await run(profiles, click)
  } finally {
    await harness.dispose()
    if (previousElement === undefined) delete globalThis.Element
    else globalThis.Element = previousElement
  }
}

test('Ctrl/Cmd-click toggles individual nodes and Shift-click selects an anchored range', async () => {
  await withProfiles((profiles, click) => {
    click('B')
    assert.deepEqual(profiles.selectedIds.value, ['B'])

    click('D', { ctrlKey: true })
    assert.deepEqual(profiles.selectedIds.value, ['B', 'D'])
    click('B', { ctrlKey: true })
    assert.deepEqual(profiles.selectedIds.value, ['D'])

    // The Ctrl-clicked row is the anchor even after it was deselected.
    click('E', { shiftKey: true })
    assert.deepEqual(profiles.selectedIds.value, ['B', 'C', 'D', 'E'])

    // A normal click starts a new selection and anchor; Shift works in either direction.
    click('D')
    click('B', { shiftKey: true })
    assert.deepEqual(profiles.selectedIds.value, ['B', 'C', 'D'])
  })
})

test('Ctrl/Cmd+Shift-click adds a range to the existing selection', async () => {
  await withProfiles((profiles, click) => {
    click('A')
    click('C', { ctrlKey: true })
    click('E', { ctrlKey: true, shiftKey: true })
    assert.deepEqual(profiles.selectedIds.value, ['A', 'C', 'D', 'E'])

    click('B', { metaKey: true })
    assert.deepEqual(profiles.selectedIds.value, ['A', 'C', 'D', 'E', 'B'])
  })
})
