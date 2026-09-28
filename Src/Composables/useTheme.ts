import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const storageKey = 'v2rayn-web-theme'

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function useTheme() {
  const preference = ref<ThemePreference>(readPreference())
  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)')
  const resolvedTheme = computed(() => preference.value === 'system'
    ? systemPreference.matches ? 'dark' : 'light'
    : preference.value)

  function applyTheme() {
    document.documentElement.dataset.theme = resolvedTheme.value
    document.documentElement.style.colorScheme = resolvedTheme.value
  }

  function setPreference(value: unknown) {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return
    preference.value = value
  }

  function onSystemThemeChanged() {
    if (preference.value === 'system') applyTheme()
  }

  watch(preference, (value) => {
    try {
      localStorage.setItem(storageKey, value)
    } catch {
      // Keep theme switching functional in sessions where browser storage is blocked.
    }
    applyTheme()
  }, { immediate: true })

  onMounted(() => systemPreference.addEventListener('change', onSystemThemeChanged))
  onUnmounted(() => systemPreference.removeEventListener('change', onSystemThemeChanged))

  return { preference, resolvedTheme, setPreference }
}
