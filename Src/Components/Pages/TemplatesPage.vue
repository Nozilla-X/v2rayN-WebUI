<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiCheckbox from '../UiCheckbox.vue'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const activeCore = ref('Xray')
const currentTemplate = computed(() => state.templates.find((template: Record<string, any>) => String(template.coreType).toLowerCase().replace('_', '-') === activeCore.value.toLowerCase().replace('_', '-')) || null)
</script>

<template>
  <section class="page templates-page">
    <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('templates.title') }}</h1></div><button class="button" @click="actions.loadTemplates">{{ t('common.refresh') }}</button></div>
    <nav class="section-tabs" :aria-label="t('templates.title')"><button :class="{ selected: activeCore === 'Xray' }" @click="activeCore = 'Xray'">Xray</button><button :class="{ selected: activeCore === 'sing_box' }" @click="activeCore = 'sing_box'">sing-box</button></nav>
    <form v-if="currentTemplate" class="template-editor panel" @submit.prevent="actions.saveTemplate(currentTemplate)">
      <div class="template-options"><label class="check-inline"><UiCheckbox v-model="currentTemplate.enabled" />{{ t('templates.enabled') }}</label><label>{{ t('templates.remarks') }}<input v-model="currentTemplate.remarks" /></label><label class="check-inline"><UiCheckbox v-model="currentTemplate.addProxyOnly" />{{ t('templates.addProxyOnly') }}</label><label>{{ t('templates.proxyDetour') }}<input v-model="currentTemplate.proxyDetour" /></label></div>
      <label class="template-code-label">{{ t('templates.config') }}<textarea v-model="currentTemplate.config" class="code-area template-code" spellcheck="false" /></label>
      <footer class="footer-actions settings-footer"><span class="muted">{{ t('templates.templateHint') }}</span><button class="button primary" type="submit">{{ t('common.save') }}</button></footer>
    </form>
    <p v-else class="muted empty-inline">{{ t('templates.coreUnavailable') }}</p>
  </section>
</template>
