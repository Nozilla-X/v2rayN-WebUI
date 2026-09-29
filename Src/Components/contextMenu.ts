export function preventNativeContextMenu(event: Pick<MouseEvent, 'preventDefault' | 'stopPropagation'>) {
  event.preventDefault()
  event.stopPropagation()
}
