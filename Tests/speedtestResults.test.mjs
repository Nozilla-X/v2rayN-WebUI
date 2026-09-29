import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mergeSpeedTestResult } from '../Src/Composables/speedtestResults.js'

const useEventsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Src/Composables/useEvents.ts')

test('speedtest-result updates delay, speed, and IP info on the matching row in place', () => {
  const profiles = [{ indexId: 'a', delay: 10, speed: 2, ipInfo: 'old' }, { indexId: 'b', delay: 8 }]
  const target = profiles[0]

  assert.equal(mergeSpeedTestResult(profiles, { indexId: 'a', delay: 35, speed: 7.25, ipInfo: 'US · 203.0.113.1' }), true)
  assert.equal(profiles[0], target)
  assert.deepEqual(profiles[0], { indexId: 'a', delay: 35, speed: 7.25, ipInfo: 'US · 203.0.113.1' })
  assert.deepEqual(profiles[1], { indexId: 'b', delay: 8 })
})

test('null, absent, or empty speedtest-result fields do not clear existing values', () => {
  const profiles = [{ indexId: 'a', delay: 10, speed: 2, ipInfo: 'old' }]
  assert.equal(mergeSpeedTestResult(profiles, { indexId: 'a', delay: '', speed: undefined, ipInfo: '' }), true)
  assert.equal(mergeSpeedTestResult(profiles, { indexId: 'a', delay: null, speed: null, ipInfo: null }), true)
  assert.deepEqual(profiles[0], { indexId: 'a', delay: 10, speed: 2, ipInfo: 'old' })
})

test('speedtest-result for a profile outside the current list does not trigger a reload', () => {
  const profiles = [{ indexId: 'a', delay: 10 }]
  assert.equal(mergeSpeedTestResult(profiles, { indexId: 'not-visible', delay: 25 }), false)
  assert.deepEqual(profiles, [{ indexId: 'a', delay: 10 }])
})

test('SSE speedtest-result is handled as a row merge instead of a profiles reload event', async () => {
  const source = await readFile(useEventsPath, 'utf8')
  assert.match(source, /addEventListener\('speedtest-result',[\s\S]*?options\.onSpeedTestResult\(/)
  assert.doesNotMatch(source, /\['profiles-changed',[^\]]*'speedtest-result'/)
})
