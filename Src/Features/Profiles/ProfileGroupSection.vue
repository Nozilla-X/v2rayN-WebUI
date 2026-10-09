<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../../Components/types'
import UiCheckbox from '../../Components/UiCheckbox.vue'
import UiIcon from '../../Components/UiIcon.vue'
import UiIconButton from '../../Components/UI/UiIconButton.vue'
const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const protocol = computed(() => state.profileForm.configType)
</script>

<template>
  <fieldset class="editor-section">
    <legend>{{ t(protocol === 'PolicyGroup' ? 'nodes.policyGroup' : 'nodes.proxyChain') }}</legend>
    <div class="form-grid two-col">
      <label v-if="protocol === 'PolicyGroup'">{{ t('nodes.groupStrategy') }}<select v-model="state.profileForm.protoExtra.multipleLoad"><option v-for="strategy in state.editorOptions.multipleLoadStrategies" :key="strategy" :value="strategy">{{ t(`nodes.strategy${strategy}`) }}</option></select></label>
      <label>{{ t('nodes.groupSubscription') }}<select v-model="state.profileForm.protoExtra.subChildItems"><option value="">{{ t('common.none') }}</option><option v-for="group in state.groups" :key="group.id" :value="group.id">{{ group.name || t('common.allGroups') }}</option></select></label>
      <label>{{ t('nodes.groupFilter') }}<input v-model="state.profileForm.protoExtra.filter" /></label>
      <div class="wide-field group-member-editor"><strong>{{ t('nodes.groupMembers') }}</strong><small class="field-hint">{{ t('nodes.groupMembersHint') }}</small><div class="group-member-columns"><div class="group-profile-choices"><label v-for="item in state.profileCatalog" :key="item.indexId" class="group-profile-choice"><UiCheckbox :disabled="item.indexId === state.editingProfileId" :model-value="state.groupChildIds.includes(item.indexId)" @change="actions.toggleGroupChild(item.indexId)" /><span>{{ item.remarks }}<small>{{ item.configType }} · {{ item.address }}:{{ item.port }}</small></span></label></div><div class="group-member-order"><div v-for="(id, index) in state.groupChildIds" :key="id" class="group-member-row"><span>{{ state.profileCatalog.find((item: Record<string, any>) => item.indexId === id)?.remarks || id }}</span><UiIconButton type="button" :disabled="index === 0" :aria-label="t('nodes.moveMemberUp')" @click="actions.moveGroupChild(id, 'up')"><UiIcon name="arrow-up" /></UiIconButton><UiIconButton type="button" :disabled="index === state.groupChildIds.length - 1" :aria-label="t('nodes.moveMemberDown')" @click="actions.moveGroupChild(id, 'down')"><UiIcon name="arrow-down" /></UiIconButton><UiIconButton class="danger-text" type="button" :aria-label="t('common.delete')" @click="actions.toggleGroupChild(id)"><UiIcon name="close" /></UiIconButton></div><p v-if="!state.groupChildIds.length" class="muted">{{ t('common.empty') }}</p></div></div></div>
    </div>
  </fieldset>
</template>
