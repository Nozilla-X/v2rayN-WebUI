export const maximumPendingLogEntries: number
export const maximumLogMessageCharacters: number
export function enqueueLogEntry(queue: Array<Record<string, unknown>>, entry: Record<string, unknown>, maximumEntries?: number): void
export function takeLogBatch(queue: Array<Record<string, unknown>>): Array<Record<string, unknown>>
