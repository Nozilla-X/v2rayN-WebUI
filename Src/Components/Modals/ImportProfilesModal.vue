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
  <div v-if="state.showImportForm" class="modal-shade" @click.self="state.showImportForm = false">
    <form ref="dialog" class="modal-panel wide-modal modal-form" role="dialog" aria-modal="true" :aria-label="t('nodes.importNodes')" tabindex="-1" @keydown="onModalKeydown" @submit.prevent="actions.importProfiles">
      <header class="modal-head"><h2>{{ t('nodes.importNodes') }}</h2><button class="tool-button" type="button" :aria-label="t('common.close')" @click="state.showImportForm = false"><UiIcon name="close" /></button></header>
      <div class="modal-content">
        <label class="form-label">{{ t('subscriptions.source') }}<select v-model="state.importForm.subscriptionId"><option value="">{{ t('common.allGroups') }}</option><option v-for="group in state.groups.filter((item: Record<string, any>) => item.id)" :key="group.id" :value="group.id">{{ group.name }}</option></select></label>
        <label class="form-label">{{ t('nodes.importContent') }}<textarea v-model="state.importForm.content" class="code-area import-content" required :placeholder="t('nodes.importHint')" /></label>
        <label class="check-inline"><UiCheckbox v-model="state.importForm.isSubscription" />{{ t('nodes.isSubscription') }}</label>
        <div class="button-row"><label class="button file-button">{{ t('common.openFile') }}<input type="file" accept=".txt,.json,.conf" @change="actions.readImportFile" /></label><button class="button" type="button" @click="actions.pasteImport">{{ t('common.paste') }}</button></div>
      </div>
      <footer class="modal-actions"><button class="button" type="button" @click="state.showImportForm = false">{{ t('common.cancel') }}</button><button class="button primary" type="submit">{{ t('common.import') }}</button></footer>
    </form>
  </div>
</template>
