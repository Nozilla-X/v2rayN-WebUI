import type { Dict } from './types'

export function mergeSpeedTestResult(profiles: Dict[], result: Dict | null | undefined): boolean {
  if (!result || typeof result.indexId !== 'string') return false
  const profile = profiles.find((item) => item.indexId === result.indexId)
  if (!profile) return false

  for (const field of ['delay', 'speed', 'ipInfo']) {
    if (result[field] !== null && result[field] !== undefined && result[field] !== '') {
      profile[field] = result[field]
    }
  }
  return true
}
