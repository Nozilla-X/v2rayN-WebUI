import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function releaseVersion(tag) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error('A stable release tag such as v1.0.0 is required.')
  }
  return tag.slice(1)
}

export function verifyReleaseVersions(tag, pkg, lock) {
  const version = releaseVersion(tag)
  if ([pkg.version, lock.version, lock.packages?.['']?.version].some(value => value !== version)) {
    throw new Error(`Release ${tag} must match package.json and both lockfile project versions.`)
  }
}

export function extractReleaseNotes(changelog, tag) {
  const version = releaseVersion(tag).replaceAll('.', '\\.')
  const heading = new RegExp(`^##\\s+(?:\\[v?${version}\\]|v?${version})(?:\\s+-\\s+.+)?\\s*$`)
  const lines = changelog.split(/\r?\n/)
  const matches = lines.flatMap((line, index) => heading.test(line) ? [index] : [])
  if (matches.length !== 1) throw new Error(`CHANGELOG.md must contain exactly one entry for ${tag}.`)
  const start = matches[0] + 1
  const next = lines.findIndex((line, index) => index >= start && /^##\s+/.test(line))
  const notes = lines.slice(start, next < 0 ? undefined : next).join('\n').trim()
  if (!notes) throw new Error(`The changelog entry for ${tag} is empty.`)
  return `${notes}\n`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [tag, output] = process.argv.slice(2)
    if (!output) throw new Error('Usage: node Scripts/release-notes.mjs <vX.Y.Z> <output.md>')
    const [pkg, lock, changelog] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
      readFile(new URL('../package-lock.json', import.meta.url), 'utf8').then(JSON.parse),
      readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
    ])
    verifyReleaseVersions(tag, pkg, lock)
    await writeFile(resolve(output), extractReleaseNotes(changelog, tag))
    console.log(`Release notes for ${tag} read from CHANGELOG.md.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
