export function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null

  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new TypeError('Expected a number or an empty nullable numeric value.')
  }

  const number = typeof value === 'number' ? value : Number(value.trim())
  if (!Number.isFinite(number)) {
    throw new TypeError('The numeric setting must be a finite number.')
  }
  return number
}

export function normalizeNullableNumbers(value: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const normalized = { ...value }
  for (const field of fields) {
    if (Object.hasOwn(normalized, field)) normalized[field] = nullableNumber(normalized[field])
  }
  return normalized
}

function requiredNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(number)) {
    throw new TypeError('The numeric setting must be a finite number.')
  }
  return number
}

function defaultedNumber(value: unknown): number {
  return value == null || value === '' ? 0 : requiredNumber(value)
}

function parseLines(value: unknown): string[] {
  return String(value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export function buildSpeedSettingsBody(speedForm: Record<string, unknown>): Record<string, unknown> {
  const { speedTestPageSize: _pageSize, speedTestDelayInterval: _delayInterval, ...desktopFields } = speedForm
  return {
    ...desktopFields,
    speedTestTimeout: requiredNumber(desktopFields.speedTestTimeout),
    mixedConcurrencyCount: requiredNumber(desktopFields.mixedConcurrencyCount),
  }
}

export function buildCoreSettingsBody(core: Record<string, unknown>): Record<string, unknown> {
  const { fragmentLengthsText, fragmentDelaysText, ...coreSettings } = core
  return {
    ...coreSettings,
    fragmentLengths: parseLines(fragmentLengthsText),
    fragmentDelays: parseLines(fragmentDelaysText),
    mux4RayConcurrency: nullableNumber(coreSettings.mux4RayConcurrency),
    mux4RayXudpConcurrency: nullableNumber(coreSettings.mux4RayXudpConcurrency),
    hy2UpMbps: defaultedNumber(coreSettings.hy2UpMbps),
    hy2DownMbps: defaultedNumber(coreSettings.hy2DownMbps),
  }
}

export function buildApplicationSettingsBody(app: Record<string, unknown>): Record<string, unknown> {
  return { ...app, geoAutoUpdateInterval: defaultedNumber(app.geoAutoUpdateInterval) }
}

export function buildSettingsApplyBody(input: {
  inbound: Record<string, unknown>
  core: Record<string, unknown>
  app: Record<string, unknown>
  speed: Record<string, unknown>
  coreTypes?: string[]
  routing?: Record<string, unknown>
}): Record<string, unknown> {
  const { inbound, core, app, speed, coreTypes, routing } = input
  return {
    inbound: { ...inbound, localPort: requiredNumber(inbound.localPort), destOverride: inbound.destOverride || [] },
    core: buildCoreSettingsBody(core),
    application: buildApplicationSettingsBody(app),
    speedTest: buildSpeedSettingsBody(speed),
    coreTypes: coreTypes || [],
    domainStrategy: routing?.domainStrategy || '',
    domainStrategy4Singbox: routing?.domainStrategy4Singbox || '',
  }
}
