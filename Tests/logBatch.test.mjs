import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enqueueLogEntry,
  maximumLogMessageCharacters,
  maximumPendingLogEntries,
  takeLogBatch,
} from '../Src/Composables/logBatch.js'

test('high-frequency log intake remains bounded and flushes in batches', () => {
  const pending = []
  let flushCount = 0
  let observed = 0
  for (let index = 0; index < 50_000; index += 1) {
    enqueueLogEntry(pending, { timestamp: index, source: 'core', message: `line ${index}` })
    if (pending.length >= 100) {
      const batch = takeLogBatch(pending)
      flushCount += 1
      observed += batch.length
      assert.ok(batch.length <= 100)
    }
  }
  observed += takeLogBatch(pending).length

  assert.equal(flushCount, 500)
  assert.equal(observed, 50_000)
  assert.equal(pending.length, 0)
})

test('a burst without a flush drops the oldest entries at a fixed queue bound', () => {
  const pending = []
  for (let index = 0; index < maximumPendingLogEntries + 500; index += 1) {
    enqueueLogEntry(pending, { timestamp: index, source: 'core', message: 'x' })
  }

  assert.equal(pending.length, maximumPendingLogEntries)
  assert.equal(pending[0].timestamp, 500)
  assert.equal(pending.at(-1).timestamp, maximumPendingLogEntries + 499)
})

test('oversized log entries are truncated before entering the reactive batch', () => {
  const pending = []
  enqueueLogEntry(pending, { source: 'core', message: 'x'.repeat(maximumLogMessageCharacters * 4) })

  assert.equal(pending[0].message.length, maximumLogMessageCharacters)
  assert.match(pending[0].message, /log entry truncated/)
})
