import type { ObjectDirective } from 'vue'
const editors = new WeakMap<HTMLTextAreaElement, { save?: () => unknown; listener: (event: KeyboardEvent) => void }>()

/** Native textarea editing; no editor dependency, model copy or JSON reformatting. */
export const codeEditor: ObjectDirective<HTMLTextAreaElement, (() => unknown) | undefined> = {
  mounted(element, binding) {
    const editor = { save: binding.value, listener: (_event: KeyboardEvent) => {} }
    const listener = (event: KeyboardEvent) => {
      if (element.disabled || element.readOnly || event.isComposing) return
      if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault()
        event.stopPropagation()
        element.setRangeText('  ', element.selectionStart, element.selectionEnd, 'end')
        element.dispatchEvent(new Event('input', { bubbles: true }))
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && editor.save) {
        event.preventDefault()
        void editor.save()
      }
    }
    editor.listener = listener
    editors.set(element, editor)
    element.addEventListener('keydown', listener)
  },
  // The callback can change when the selected Core/profile changes.
  updated(element, binding) { const editor = editors.get(element); if (editor) editor.save = binding.value },
  unmounted(element) {
    const listener = editors.get(element)?.listener
    if (listener) element.removeEventListener('keydown', listener)
    editors.delete(element)
  },
}
