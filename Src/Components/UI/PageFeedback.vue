<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePageRequests } from '../../UI/useUiRequests'
const props = defineProps<{ scope: string }>()
const { t } = useI18n()
const { status } = usePageRequests(props.scope)
</script>
<template>
  <div class="page-feedback" :aria-busy="Boolean(status.reads || status.writes)">
    <span v-if="status.error" class="inline-error" role="alert">{{ status.error }}</span>
    <span v-else-if="status.writes || status.reads" class="muted" role="status">{{ t(status.writes ? 'common.working' : 'common.loading') }}</span>
  </div>
</template>
