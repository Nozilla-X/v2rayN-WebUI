<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  size?: number
}>(), { size: 14 })

const paths: Record<string, string[]> = {
  grid: ['M2.5 2.5h4v4h-4z M9.5 2.5h4v4h-4z M2.5 9.5h4v4h-4z M9.5 9.5h4v4h-4z'],
  refresh: ['M13 5.5A5.5 5.5 0 0 0 3.6 3.6L2.5 5', 'M2.5 2.5V5h2.5', 'M3 10.5a5.5 5.5 0 0 0 9.4 1.9l1.1-1.4', 'M13.5 13.5V11H11'],
  route: [
    'M9 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15',
    'M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  ],
  dns: [
    'M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
    'M4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z',
    'M6 6h.01 M6 18h.01',
  ],
  settings: [
    'M10 5H3', 'M12 19H3', 'M14 3v4', 'M16 17v4', 'M21 12h-9',
    'M21 19h-5', 'M21 5h-7', 'M8 10v4', 'M8 12H3',
  ],
  list: ['M5.5 3h7 M5.5 6.3h7 M5.5 9.7h7 M5.5 13h7', 'M2.5 3h.01 M2.5 6.3h.01 M2.5 9.7h.01 M2.5 13h.01'],
  download: ['M8 2v7', 'm5 6 3 3 3-3', 'M3 10.5v2A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-2'],
  logs: ['M3 2.5h10v11H3z', 'M5 5h6 M5 7.5h6 M5 10h4'],
  edit: ['m3 11.8-.5 2.2 2.2-.5 7.8-7.8-1.7-1.7z', 'm9.8 4 1.7 1.7'],
  plus: ['M8 3v10 M3 8h10'],
  search: ['M7.2 2.5a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4z', 'm10.7 10.7 2.8 2.8'],
  fit: ['M2 5V2h3 M11 2h3v3 M14 11v3h-3 M5 14H2v-3', 'M2.5 2.5 6 6 M14 2.5 10 6 M14 13.5 10 10 M2 13.5 6 10'],
  bolt: ['m9 1.8-5 7h3l-.5 5.4 5.5-7.4H9.2z'],
  speed: ['M2.3 11.7a6 6 0 1 1 11.4 0', 'M8 8l2.7-2.7', 'M4.5 11.5h.01 M11.5 11.5h.01'],
  'chevron-down': ['m4 6 4 4 4-4'],
  'chevron-right': ['m6 3.5 4.5 4.5L6 12.5'],
  close: ['m4 4 8 8 M12 4l-8 8'],
  check: ['m3 8.2 3.1 3.1L13 4.5'],
  'arrow-up': ['M8 13V3', 'm4 7 4-4 4 4'],
  'arrow-down': ['M8 3v10', 'm4 9 4 4 4-4'],
  more: ['M3.2 8h.01 M8 8h.01 M12.8 8h.01'],
  'check-all': ['M2.5 2.5h9v9h-9z', 'm4.5 6.8 2 2 4-4', 'm8.5 12.2 1.4 1.3 3.6-3.7'],
  play: ['m5 3 8 5-8 5z'],
  stop: ['M3.5 3.5h9v9h-9z'],
  share: ['M5.5 8h5', 'm8.5 5 3 3-3 3', 'M3 3.5h2 M3 12.5h2'],
  copy: ['M5 5h7v8H5z', 'M3 10V3h7'],
}

const iconPaths = paths[props.name] || paths.list
const iconTransform = ['settings', 'route', 'dns'].includes(props.name) ? 'scale(0.6666667)' : undefined
</script>

<template>
  <svg class="ui-icon" :width="size" :height="size" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(path, index) in iconPaths" :key="index" :d="path" :transform="iconTransform" vector-effect="non-scaling-stroke" />
  </svg>
</template>
