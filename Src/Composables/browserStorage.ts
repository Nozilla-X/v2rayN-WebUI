export function readStoredValue(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeStoredValue(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* In-memory preferences remain usable. */ }
}
