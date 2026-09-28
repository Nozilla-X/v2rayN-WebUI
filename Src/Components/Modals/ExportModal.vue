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
  <div v-if="state.showExportDialog" class="modal-shade" @click.self="state.showExportDialog = false">
    <section ref="dialog" class="modal-panel wide-modal modal-form" role="dialog" aria-modal="true" :aria-label="t('nodes.exportSelected')" tabindex="-1" @keydown="onModalKeydown">
      <header class="modal-head"><h2>{{ t('nodes.exportSelected') }}</h2><button class="tool-button" type="button" :aria-label="t('common.close')" @click="state.showExportDialog = false"><UiIcon name="close" /></button></header>
      <div class="modal-content export-modal-content">
        <div class="export-options"><label class="check-inline"><UiCheckbox v-model="state.exportOptions.includeShareUris" />{{ t('nodes.includeShareUris') }}</label><label class="check-inline"><UiCheckbox v-model="state.exportOptions.base64ShareUris" />{{ t('nodes.base64ShareUris') }}</label><label class="check-inline"><UiCheckbox v-model="state.exportOptions.includeInnerUri" />{{ t('nodes.includeInnerUri') }}</label><label class="check-inline"><UiCheckbox v-model="state.exportOptions.includeClientConfig" />{{ t('nodes.includeClientConfig') }}</label><button class="button compact" @click="actions.exportSelected">{{ t('common.refresh') }}</button></div>
        <textarea v-model="state.exportContent" class="code-area export-area" spellcheck="false" />
      </div>
      <footer class="modal-actions"><button class="button" @click="actions.copyExport">{{ t('common.copy') }}</button><button class="button" @click="actions.downloadExport">{{ t('common.download') }}</button><button class="button primary" @click="state.showExportDialog = false">{{ t('common.close') }}</button></footer>
    </section>
  </div>
</template>
