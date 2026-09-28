export function nullableNumber(value: unknown): number | null
export function normalizeNullableNumbers(value: Record<string, unknown>, fields: string[]): Record<string, unknown>
export function buildCoreSettingsBody(core: Record<string, unknown>): Record<string, unknown>
export function buildApplicationSettingsBody(app: Record<string, unknown>): Record<string, unknown>
export function buildSpeedSettingsBody(speed: Record<string, unknown>): Record<string, unknown>
export function buildSettingsApplyBody(input: Record<string, unknown>): Record<string, unknown>
