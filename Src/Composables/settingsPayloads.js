export function nullableNumber(value) {
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

export function normalizeNullableNumbers(value, fields) {
  const normalized = { ...value }
  for (const field of fields) {
    if (Object.hasOwn(normalized, field)) normalized[field] = nullableNumber(normalized[field])
  }
  return normalized
}

function requiredNumber(value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(number)) {
    throw new TypeError('The numeric setting must be a finite number.')
  }
  return number
}

function defaultedNumber(value) {
  return value == null || value === '' ? 0 : requiredNumber(value)
}

function parseLines(value) {
  return String(value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export function buildSpeedSettingsBody(speedForm) {
  return {
    ...speedForm,
    speedTestTimeout: requiredNumber(speedForm.speedTestTimeout),
    mixedConcurrencyCount: requiredNumber(speedForm.mixedConcurrencyCount),
    speedTestPageSize: nullableNumber(speedForm.speedTestPageSize),
    speedTestDelayInterval: nullableNumber(speedForm.speedTestDelayInterval),
  }
}

export function buildCoreSettingsBody(core) {
  const { fragmentLengthsText, fragmentDelaysText, ...coreSettings } = core
  return {
    ...coreSettings,
    fragmentLengths: parseLines(fragmentLengthsText),
    fragmentDelays: parseLines(fragmentDelaysText),
    mux4RayConcurrency: nullableNumber(coreSettings.mux4RayConcurrency),
    mux4RayXudpConcurrency: nullableNumber(coreSettings.mux4RayXudpConcurrency),
    mux4SboxMaxConnections: defaultedNumber(coreSettings.mux4SboxMaxConnections),
    hy2UpMbps: defaultedNumber(coreSettings.hy2UpMbps),
    hy2DownMbps: defaultedNumber(coreSettings.hy2DownMbps),
  }
}

export function buildApplicationSettingsBody(app) {
  return { ...app, geoAutoUpdateInterval: defaultedNumber(app.geoAutoUpdateInterval) }
}

export function buildSettingsApplyBody({ inbound, core, app, speed, coreTypes, routing }) {
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
