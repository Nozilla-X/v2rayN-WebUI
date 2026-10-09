<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiCheckbox from '../UiCheckbox.vue'
import SaveBar from '../SaveBar.vue'
import PageFeedback from '../UI/PageFeedback.vue'
import { useDraftState } from '../../UI/useDraftState'
import { codeEditor as vCodeEditor } from '../../UI/codeEditor'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const activeCore = ref('Xray')
const { dirty, status, allowDiscard, run } = useDraftState('templates', () => Object.fromEntries(state.templates.map((template: Record<string, any>) => [String(template.coreType).toLowerCase(), template])), () => state.templates, path => [decodeURIComponent(path.split('/').at(-1) || '').toLowerCase()])
async function reloadTemplates() { if (await allowDiscard(t('polish.discardChanges'))) await run(() => actions.loadTemplates()) }
const currentTemplate = computed(() => state.templates.find((template: Record<string, any>) => String(template.coreType).toLowerCase().replace('_', '-') === activeCore.value.toLowerCase().replace('_', '-')) || null)
</script>

<template>
  <section class="page templates-page">
    <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('templates.title') }}</h1></div><button class="button" :disabled="Boolean(status.reads || status.writes)" @click="reloadTemplates">{{ t('common.refresh') }}</button></div>
    <PageFeedback scope="templates" />
    <nav class="section-tabs" :aria-label="t('templates.title')"><button :aria-pressed="activeCore === 'Xray'" :class="{ selected: activeCore === 'Xray' }" @click="activeCore = 'Xray'">Xray</button><button :aria-pressed="activeCore === 'sing_box'" :class="{ selected: activeCore === 'sing_box' }" @click="activeCore = 'sing_box'">sing-box</button></nav>
    <form v-if="currentTemplate" class="template-editor panel" @submit.prevent="actions.saveTemplate(currentTemplate)">
      <div class="template-options"><label class="check-inline"><UiCheckbox v-model="currentTemplate.enabled" />{{ t('templates.enabled') }}</label><label>{{ t('templates.remarks') }}<input v-model="currentTemplate.remarks" /></label><label class="check-inline"><UiCheckbox v-model="currentTemplate.addProxyOnly" />{{ t('templates.addProxyOnly') }}</label><label>{{ t('templates.proxyDetour') }}<input v-model="currentTemplate.proxyDetour" /></label></div>
      <label class="template-code-label">{{ t('templates.config') }}<textarea v-code-editor="() => !status.writes && actions.saveTemplate(currentTemplate)" v-model="currentTemplate.config" class="code-area template-code" spellcheck="false" /></label>
      <label class="template-code-label">{{ t('templates.tunConfig') }}<textarea v-code-editor="() => !status.writes && actions.saveTemplate(currentTemplate)" v-model="currentTemplate.tunConfig" class="code-area template-code" spellcheck="false" /></label>
       <p class="mobile-form-note field-hint">{{ t('templates.templateHint') }}</p>
       <p class="field-hint">{{ t('polish.editorKeyboard') }}</p>
       <SaveBar submit :busy="Boolean(status.writes)" :dirty="dirty" :hint="t('templates.templateHint')" />
    </form>
    <p v-else class="muted empty-inline">{{ t('templates.coreUnavailable') }}</p>
  </section>
</template>
