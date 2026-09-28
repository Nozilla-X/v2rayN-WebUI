import type { InjectionKey } from 'vue'

export const closeActionDropdownKey: InjectionKey<() => void> = Symbol('closeActionDropdown')

const menuItemSelector = '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled), button:not(:disabled)'

export function focusFirstMenuItem(menu: HTMLElement | null) {
  const item = menu?.querySelector<HTMLElement>(menuItemSelector)
  item?.focus({ preventScroll: true })
}

export function navigateMenu(event: KeyboardEvent, menu: HTMLElement | null) {
  if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = [...menu.querySelectorAll<HTMLElement>(menuItemSelector)]
    .filter((item) => item.getClientRects().length > 0)
  if (!items.length) return

  const current = items.indexOf(document.activeElement as HTMLElement)
  let next = current
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
  else next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length

  event.preventDefault()
  items[next].focus({ preventScroll: true })
}
