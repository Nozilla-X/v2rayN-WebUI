import { reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice } from './types'

export function useTemplates(options: ApiServices & { showNotice: Notice; showError: ErrorHandler }) {
  const templates = ref<Dict[]>([])

  async function loadTemplates() {
    templates.value = await options.data('/api/settings/core-templates') || []
  }

  async function saveTemplate(template: Dict) {
    try {
      const result = await options.request(`/api/settings/core-templates/${encodeURIComponent(options.coreTypeRoute(template.coreType))}`, {
        method: 'PUT', body: {
          remarks: template.remarks, enabled: template.enabled, config: template.config,
          addProxyOnly: template.addProxyOnly, proxyDetour: template.proxyDetour,
        },
      })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  const templatesPageState = reactive({ templates })

  return { templates, loadTemplates, templatesPageState, templatesPageActions: { loadTemplates, saveTemplate } }
}
