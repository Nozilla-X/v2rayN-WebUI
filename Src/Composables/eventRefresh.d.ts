export function createEventRefresh(refresh: () => Promise<void>, delayMs?: number): {
  request: () => void
  clear: () => void
}
