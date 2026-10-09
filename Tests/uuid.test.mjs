import assert from 'node:assert/strict'
import test from 'node:test'
import { createUuid } from '../Src/Composables/uuid.ts'

test('createUuid uses the native randomUUID implementation when available', () => {
  const expected = '123e4567-e89b-42d3-a456-426614174000'
  const cryptoApi = {
    randomUUID() { return expected },
    getRandomValues() { throw new Error('fallback should not be used') },
  }

  assert.equal(createUuid(cryptoApi), expected)
})

test('createUuid generates an RFC 4122 v4 ID when randomUUID is unavailable', () => {
  const cryptoApi = {
    getRandomValues(bytes) {
      bytes.fill(0)
      return bytes
    },
  }

  const id = createUuid(cryptoApi)

  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
