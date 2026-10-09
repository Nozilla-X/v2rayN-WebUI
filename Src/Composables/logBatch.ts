import type { Dict } from './types'

export const maximumPendingLogEntries = 2000
export const maximumLogMessageCharacters = 16 * 1024

export function enqueueLogEntry(queue: Dict[], entry: Dict, maximumEntries = maximumPendingLogEntries): void {
  const message = String(entry?.message ?? '')
  const marker = '… [log entry truncated]'
  const normalized = message.length > maximumLogMessageCharacters
    ? message.slice(0, maximumLogMessageCharacters - marker.length) + marker
    : message
  queue.push({ ...entry, message: normalized })
  if (queue.length > maximumEntries) queue.splice(0, queue.length - maximumEntries)
}

export function takeLogBatch(queue: Dict[]): Dict[] {
  return queue.splice(0, queue.length)
}
