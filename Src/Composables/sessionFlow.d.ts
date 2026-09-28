export type LoginResponseState = 'rate-limited' | 'invalid-key' | 'authenticated' | 'unavailable'

export function classifyLoginResponse(status: number, payload: any): LoginResponseState

export function connectEstablishedSession(options: {
  sessionToken: string
  setToken: (token: string) => void
  setAuthenticated: (authenticated: boolean) => void
  isAuthenticated: () => boolean
  persistToken: (token: string) => void
  refreshBase: () => Promise<boolean>
  openEvents: () => void
  loadConnectedData: () => Promise<void>
  onDataLoadFailure: () => void
  onConnected: () => void
  onSessionExpired?: () => void
}): Promise<void>
