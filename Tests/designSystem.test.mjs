import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import postcss from 'postcss'

const css = postcss.parse(await readFile(new URL('../Src/style.css', import.meta.url), 'utf8'))

test('visual constants are centralized and every referenced token is defined', () => {
  const defined = new Set()
  css.walkDecls(/^--/, declaration => defined.add(declaration.prop))
  for (const token of ['--workspace-max', '--control-height', '--table-row-height', '--radius-control', '--radius-card', '--radius-overlay', '--font-title', '--font-section', '--font-input', '--space-3', '--shadow-card', '--focus', '--disabled-opacity']) {
    assert.ok(defined.has(token), `${token} is a shared token`)
  }
  css.walkDecls(declaration => {
    for (const match of declaration.value.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(match[1]), `${match[1]} is defined`)
    if (declaration.prop.startsWith('--') || declaration.parent.selector?.startsWith(':root')) return
    if (['font', 'font-size', 'font-family'].includes(declaration.prop)) {
      assert.doesNotMatch(declaration.value, /\d+px|Consolas|Segoe/, `${declaration.parent.selector} uses typography tokens`)
    }
    if (declaration.prop === 'border-radius') assert.match(declaration.value, /^(?:0|var\(--radius-[\w-]+\))$/, 'radius uses a shared role or intentional full-screen reset')
    assert.doesNotMatch(declaration.value, /#[\da-f]{3,8}\b|rgba?\(/i, 'component colors use palette tokens')
  })
})

test('same-scope selectors do not accumulate conflicting override blocks', () => {
  const seen = new Set()
  css.walkRules(rule => {
    const scope = rule.parent.type === 'atrule' ? `${rule.parent.name}:${rule.parent.params}` : 'base'
    const key = `${scope}:${rule.selector}`
    assert.ok(!seen.has(key), `duplicate ${key}`)
    seen.add(key)
  })
})

test('native table cells override the inline text bottom alignment', () => {
  const cells = css.nodes.find(rule => rule.type === 'rule' && rule.selector === '.profile-table td, .data-table td')
  assert.ok(cells.nodes.some(declaration => declaration.prop === 'vertical-align' && declaration.value === 'middle'))
})

test('idle nodes feedback spacing matches other pages while active status retains control height', () => {
  const feedbackSlot = css.nodes.find(rule => rule.type === 'rule' && rule.selector === '.nodes-feedback-slot')
  const operationStatus = css.nodes.find(rule => rule.type === 'rule' && rule.selector === '.operation-status')
  assert.equal(feedbackSlot.nodes.find(declaration => declaration.prop === 'min-height')?.value, 'var(--feedback-height)')
  assert.equal(operationStatus.nodes.find(declaration => declaration.prop === 'min-height')?.value, 'var(--control-height)')
})

test('all eight page views share the page header and have no private style blocks', async () => {
  const directory = new URL('../Src/Components/Pages/', import.meta.url)
  const files = (await readdir(directory)).filter(name => name.endsWith('.vue'))
  assert.equal(files.length, 8)
  for (const file of files) {
    const page = await readFile(new URL(file, directory), 'utf8')
    assert.match(page, /class="page /, file)
    assert.match(page, /class="page-header page-toolbar/, file)
    assert.match(page, /<h1>/, file)
    assert.doesNotMatch(page, /<style|\sstyle="/, `${file} uses shared styles`)
  }
})
