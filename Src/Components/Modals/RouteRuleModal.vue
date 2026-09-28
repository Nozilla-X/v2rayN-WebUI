<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '../../Composables/useModalFocus'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const dialog = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus(dialog)
</script>

<template>
  <div v-if="state.showRuleForm" class="modal-shade" @click.self="state.showRuleForm = false">
    <form ref="dialog" class="modal-panel wide-modal modal-form" role="dialog" aria-modal="true" :aria-label="t(state.editingRuleId ? 'routing.editRule' : 'routing.addRule')" tabindex="-1" @keydown="onModalKeydown" @submit.prevent="actions.saveRoutingRule">
      <header class="modal-head"><div><h2>{{ t(state.editingRuleId ? 'routing.editRule' : 'routing.addRule') }}</h2><small>{{ t('routing.ruleEditorHint') }}</small></div><button class="tool-button" type="button" :aria-label="t('common.close')" @click="state.showRuleForm = false"><UiIcon name="close" /></button></header>
      <div class="modal-content">
        <fieldset class="editor-section"><legend>{{ t('routing.ruleType') }}</legend>
          <div class="form-grid three-col">
            <label>{{ t('routing.remarks') }}<input v-model="state.ruleForm.remarks" /></label>
            <label>{{ t('routing.ruleType') }}<select v-model="state.ruleForm.ruleType"><option :value="null">{{ t('common.none') }}</option><option value="ALL">ALL</option><option value="Routing">Routing</option><option value="DNS">DNS</option></select></label>
            <label class="check-inline"><UiCheckbox v-model="state.ruleForm.enabled" />{{ t('common.enabled') }}</label>
            <label>{{ t('routing.outboundTag') }}<input v-model="state.ruleForm.outboundTag" required /></label>
            <label>{{ t('routing.port') }}<input v-model="state.ruleForm.port" placeholder="80,443,1000-2000" /></label>
            <label>{{ t('routing.network') }}<select v-model="state.ruleForm.network"><option value="">{{ t('common.any') }}</option><option value="tcp">TCP</option><option value="udp">UDP</option><option value="tcp,udp">TCP, UDP</option></select></label>
            <label class="wide-field">{{ t('routing.protocol') }}<textarea v-model="state.ruleForm.protocolText" :placeholder="t('routing.listInputHint')" /></label>
            <label class="wide-field">{{ t('routing.inboundTag') }}<textarea v-model="state.ruleForm.inboundTagText" :placeholder="t('routing.listInputHint')" /></label>
            <label class="wide-field">{{ t('routing.domain') }}<textarea v-model="state.ruleForm.domainText" :placeholder="t('routing.domainInputHint')" /></label>
            <label class="wide-field">{{ t('routing.ip') }}<textarea v-model="state.ruleForm.ipText" :placeholder="t('routing.listInputHint')" /></label>
            <label class="wide-field">{{ t('routing.process') }}<textarea v-model="state.ruleForm.processText" :placeholder="t('routing.listInputHint')" /></label>
          </div>
        </fieldset>
        <details class="advanced-editor"><summary>{{ t('common.rawJson') }}</summary><p class="field-hint">{{ t('routing.ruleJsonHint') }}</p><textarea v-model="state.ruleAdvancedJson" class="code-area advanced-profile-json" spellcheck="false" /></details>
        <p v-if="state.ruleModalError" class="inline-error" role="alert">{{ state.ruleModalError }}</p>
      </div>
      <footer class="modal-actions"><button class="button" type="button" @click="state.showRuleForm = false">{{ t('common.cancel') }}</button><button class="button primary" type="submit">{{ t('common.save') }}</button></footer>
    </form>
  </div>
</template>
