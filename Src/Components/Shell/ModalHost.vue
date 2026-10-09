<script setup lang="ts">
import type { UiProps } from '../types'
import ProfileModal from '../Modals/ProfileModal.vue'
import ImportProfilesModal from '../Modals/ImportProfilesModal.vue'
import SubscriptionModal from '../Modals/SubscriptionModal.vue'
import RouteModal from '../Modals/RouteModal.vue'
import RouteRuleModal from '../Modals/RouteRuleModal.vue'
import ExportModal from '../Modals/ExportModal.vue'
import ConfirmDialog from '../Modals/ConfirmDialog.vue'

export interface ModalBindings {
  profile: UiProps
  importProfiles: UiProps
  subscription: UiProps
  route: UiProps
  rule: UiProps
  export: UiProps
}
defineProps<{ bindings: ModalBindings; coreTypeMappings: Record<string, any>[]; confirmation: { message: string } | null }>()
const emit = defineEmits<{ resolveConfirmation: [confirmed: boolean] }>()
</script>

<template>
  <ProfileModal v-if="bindings.profile.state.showProfileForm" v-bind="bindings.profile" :core-type-mappings="coreTypeMappings" />
  <ImportProfilesModal v-if="bindings.importProfiles.state.showImportForm" v-bind="bindings.importProfiles" />
  <SubscriptionModal v-if="bindings.subscription.state.showSubscriptionForm" v-bind="bindings.subscription" />
  <RouteModal v-if="bindings.route.state.showRouteForm" v-bind="bindings.route" />
  <RouteRuleModal v-if="bindings.rule.state.showRuleForm" v-bind="bindings.rule" />
  <ExportModal v-if="bindings.export.state.showExportDialog" v-bind="bindings.export" />
  <ConfirmDialog v-if="confirmation" :message="confirmation.message" @resolve="emit('resolveConfirmation', $event)" />
</template>
