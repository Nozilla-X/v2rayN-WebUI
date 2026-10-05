import assert from 'node:assert/strict'
import test from 'node:test'
import { extractReleaseNotes, releaseVersion, verifyReleaseVersions } from '../Scripts/release-notes.mjs'

test('release notes use only the matching changelog section', () => {
  const changelog = '# Changelog\n\n## [Unreleased]\nFuture\n\n## [1.0.0] - 2026-10-06\n\nFirst stable release.\n\n### Install\n```sh\nmkdir -p webui\n```\n\n## [0.1.0]\nOld\n'
  assert.equal(extractReleaseNotes(changelog, 'v1.0.0'), 'First stable release.\n\n### Install\n```sh\nmkdir -p webui\n```\n')
})

test('release notes accept a v-prefixed changelog heading and CRLF', () => {
  assert.equal(extractReleaseNotes('## [v1.0.0]\r\n\r\nNotes\r\n', 'v1.0.0'), 'Notes\n')
})

test('missing, duplicate or empty release notes fail publication', () => {
  assert.throws(() => extractReleaseNotes('## [0.1.0]\nOld', 'v1.0.0'), /exactly one/)
  assert.throws(() => extractReleaseNotes('## [1.0.0]\nOne\n## [1.0.0]\nTwo', 'v1.0.0'), /exactly one/)
  assert.throws(() => extractReleaseNotes('## [1.0.0]\n\n## [0.1.0]\nOld', 'v1.0.0'), /empty/)
})

test('only stable semver release tags are accepted', () => {
  assert.equal(releaseVersion('v1.0.0'), '1.0.0')
  for (const tag of ['1.0.0', 'v01.0.0', 'v1.0', 'v1.0.0-beta', undefined]) {
    assert.throws(() => releaseVersion(tag), /stable release tag/)
  }
})

test('release version must match all project version metadata', () => {
  const pkg = { version: '1.0.0' }
  const lock = { version: '1.0.0', packages: { '': { version: '1.0.0' } } }
  assert.doesNotThrow(() => verifyReleaseVersions('v1.0.0', pkg, lock))
  assert.throws(() => verifyReleaseVersions('v2.0.0', pkg, lock), /must match/)
  assert.throws(() => verifyReleaseVersions('v1.0.0', pkg, { ...lock, version: '0.1.0' }), /must match/)
  assert.throws(() => verifyReleaseVersions('v1.0.0', pkg, { ...lock, packages: {} }), /must match/)
})
