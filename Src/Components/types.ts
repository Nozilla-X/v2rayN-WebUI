export type UiState = Record<string, any>
export type UiAction = (...args: any[]) => any
export type UiActions = Record<string, UiAction>

export interface UiProps {
  state: UiState
  actions: UiActions
}
