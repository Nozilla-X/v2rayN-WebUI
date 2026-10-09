<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiState } from '../../Components/types'
import { optionValues } from './editorOptionValues'
const { t } = useI18n()
const props = defineProps<{ state: UiState }>()
const state = props.state
const transportOptions = computed(() => state.editorOptions || {})
const showRawHttpFields = computed(() => state.profileForm.network === 'raw' && state.profileForm.transportExtra.rawHeaderType === 'http')
</script>

<template>
  <fieldset class="editor-section">
    <legend>{{ t('nodes.transport') }}</legend>
    <div class="form-grid three-col">
      <template v-if="state.profileForm.network === 'raw'">
        <label>{{ t('nodes.rawHeaderType') }}<select v-model="state.profileForm.transportExtra.rawHeaderType"><option v-for="type in optionValues(transportOptions.rawHeaderTypes, state.profileForm.transportExtra.rawHeaderType)" :key="type" :value="type">{{ type }}</option></select></label>
        <template v-if="showRawHttpFields">
          <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
          <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
        </template>
      </template>
      <template v-if="state.profileForm.network === 'ws' || state.profileForm.network === 'httpupgrade'">
        <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
        <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
      </template>
      <template v-if="state.profileForm.network === 'grpc'">
        <label>{{ t('nodes.grpcMode') }}<select v-model="state.profileForm.transportExtra.grpcMode"><option v-for="mode in optionValues(transportOptions.grpcModes, state.profileForm.transportExtra.grpcMode)" :key="mode" :value="mode">{{ mode }}</option></select></label>
        <label>{{ t('nodes.grpcAuthority') }}<input v-model="state.profileForm.transportExtra.grpcAuthority" /></label>
        <label>{{ t('nodes.grpcServiceName') }}<input v-model="state.profileForm.transportExtra.grpcServiceName" /></label>
      </template>
      <template v-if="state.profileForm.network === 'xhttp'">
        <label>{{ t('nodes.xhttpMode') }}<select v-model="state.profileForm.transportExtra.xhttpMode"><option v-for="mode in optionValues(transportOptions.xhttpModes, state.profileForm.transportExtra.xhttpMode)" :key="mode" :value="mode">{{ mode }}</option></select></label>
        <label>{{ t('nodes.host') }}<input v-model="state.profileForm.transportExtra.host" /></label>
        <label>{{ t('nodes.path') }}<input v-model="state.profileForm.transportExtra.path" /></label>
        <label class="wide-field">{{ t('nodes.xhttpExtra') }}<textarea v-model="state.profileForm.transportExtra.xhttpExtra" /></label>
      </template>
      <template v-if="state.profileForm.network === 'kcp'">
        <label>{{ t('nodes.kcpHeaderType') }}<select v-model="state.profileForm.transportExtra.kcpHeaderType"><option v-for="type in optionValues(transportOptions.kcpHeaderTypes, state.profileForm.transportExtra.kcpHeaderType)" :key="type" :value="type">{{ type }}</option></select></label>
        <label>{{ t('nodes.kcpSeed') }}<input v-model="state.profileForm.transportExtra.kcpSeed" /></label>
        <label>{{ t('nodes.kcpMtu') }}<input v-model.number="state.profileForm.transportExtra.kcpMtu" type="number" min="0" /></label>
      </template>
    </div>
  </fieldset>
</template>
