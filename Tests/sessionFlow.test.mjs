import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyLoginResponse, connectEstablishedSession } from '../Src/Composables/sessionFlow.js'

test('login response distinguishes invalid credentials from backend unavailability', () => {
  assert.equal(classifyLoginResponse(401, { code: 'management_key_invalid' }), 'invalid-key')
  assert.equal(classifyLoginResponse(500, { code: 'internal_error' }), 'unavailable')
  assert.equal(classifyLoginResponse(503, {}), 'unavailable')
  assert.equal(classifyLoginResponse(429, {}), 'rate-limited')
  assert.equal(classifyLoginResponse(200, { success: true, data: { token: 'session-token' } }), 'authenticated')
})

test('failed initial data loading keeps a successfully authenticated session', async () => {
  let token = ''
  let authenticated = false
  let persisted = ''
  let dataFailureNotices = 0
  let connectedNotices = 0
  let eventsOpened = 0

  await connectEstablishedSession({
    sessionToken: 'session-token',
    setToken: (value) => { token = value },
    setAuthenticated: (value) => { authenticated = value },
    isAuthenticated: () => authenticated,
    persistToken: (value) => { persisted = value },
    refreshBase: async () => true,
    openEvents: () => { eventsOpened += 1 },
    loadConnectedData: async () => { throw new Error('runtime API failed') },
    onDataLoadFailure: () => { dataFailureNotices += 1 },
    onConnected: () => { connectedNotices += 1 },
  })

  assert.equal(token, 'session-token')
  assert.equal(persisted, 'session-token')
  assert.equal(authenticated, true)
  assert.equal(eventsOpened, 1)
  assert.equal(dataFailureNotices, 1)
  assert.equal(connectedNotices, 0)
})

test('a valid session and SSE remain active when base data fails, unless authorization revoked it', async () => {
  let authenticated = false
  let failures = 0
  let eventsOpened = 0
  let expiredNotices = 0
  await connectEstablishedSession({
    sessionToken: 'session-token',
    setToken: () => {},
    setAuthenticated: (value) => { authenticated = value },
    isAuthenticated: () => authenticated,
    persistToken: () => {},
    refreshBase: async () => false,
    openEvents: () => { eventsOpened += 1 },
    loadConnectedData: async () => {},
    onDataLoadFailure: () => { failures += 1 },
    onConnected: () => assert.fail('Connection success should not be reported'),
    onSessionExpired: () => { expiredNotices += 1 },
  })
  assert.equal(authenticated, true)
  assert.equal(failures, 1)
  assert.equal(eventsOpened, 1)

  await connectEstablishedSession({
    sessionToken: 'expired-session',
    setToken: () => {},
    setAuthenticated: (value) => { authenticated = value },
    isAuthenticated: () => authenticated,
    persistToken: () => {},
    refreshBase: async () => { authenticated = false; return false },
    openEvents: () => { eventsOpened += 1 },
    loadConnectedData: async () => {},
    onDataLoadFailure: () => { failures += 1 },
    onConnected: () => assert.fail('Connection success should not be reported'),
    onSessionExpired: () => { expiredNotices += 1 },
  })
  assert.equal(authenticated, false)
  assert.equal(failures, 1)
  assert.equal(eventsOpened, 1)
  assert.equal(expiredNotices, 1)
})
