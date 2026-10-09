/** Include saved custom values without changing the Backend-provided candidates. */
export function optionValues(values: readonly string[] = [], current: unknown): string[] {
  const value = String(current ?? '')
  return value && !values.includes(value) ? [value, ...values] : [...values]
}
