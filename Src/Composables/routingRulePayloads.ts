import type { Dict } from './types'

const textLists = {
  inboundTagText: 'inboundTag',
  protocolText: 'protocol',
  domainText: 'domain',
  ipText: 'ip',
  processText: 'process',
} as const

export function buildRoutingRuleBody(advanced: unknown, form: Dict, initialForm: Dict, id: string): Dict {
  if (!advanced || typeof advanced !== 'object' || Array.isArray(advanced)) {
    throw new SyntaxError('Expected a routing rule object.')
  }
  const rule: Dict = { ...(advanced as Dict), id }
  // Only controls edited since opening the dialog override the JSON editor.
  for (const field of ['type', 'remarks', 'ruleType', 'enabled', 'outboundTag', 'port', 'network']) {
    if (JSON.stringify(form[field]) !== JSON.stringify(initialForm[field])) rule[field] = form[field]
  }
  for (const [textField, field] of Object.entries(textLists)) {
    if (form[textField] !== initialForm[textField]) {
      rule[field] = String(form[textField] || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean)
    }
    rule[field] ??= []
    if (!Array.isArray(rule[field])) throw new SyntaxError(`Expected an array for ${field}.`)
    delete rule[textField]
  }
  rule.ruleType ||= null
  return rule
}
