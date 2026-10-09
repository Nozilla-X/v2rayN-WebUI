# Backend address history

`Src/Composables/useBackend.ts` keeps `v2rayn-api-endpoint` as the current saved
address (existing behavior) and `v2rayn-api-endpoint-history` as an ordered list of
up to 10 previously used, normalized addresses.

- The login, first-run setup and local-only screens share
  `Components/BackendAddressFields.vue`. The address input itself is a lightweight
  combobox: a caret inside the field opens a dropdown of previous addresses.
  Choosing an entry fills the field; each row has its own remove button; the menu
  closes on selection, Escape or an outside click, and returns focus to the input
  or the caret respectively. A short note inside the dropdown explains the local
  storage scope.
- History is written only after a successful `Test connection`, login or first-run
  setup. Choosing an entry updates the address and reuses the existing address-switch
  flow (session cancellation, request abort, endpoint-scoped storage); it never
  connects automatically.
- Each dropdown entry has its own remove button; removing keeps the dropdown open
  until it is closed, and the list stays this-browser only.
- Entries are normalized with `normalizeApiBase`: credentials, query strings,
  fragments, non-HTTP(S) schemes and duplicates never enter the list. Path prefixes
  are preserved when present.
- Migration: when no history key exists yet, the single saved `v2rayn-api-endpoint`
  seeds the list once. An explicitly empty history stays empty.
- History is local to this browser profile and WebUI origin. Management Keys and
  session tokens are never included. An invalid or credential-bearing value is
  ignored rather than stored, and blocked storage degrades to an empty list.

Checks: `Tests/backendHistory.test.mjs` (storage, migration, dedup, limit, blocked
storage) and `Tests/browser/backendHistory.mjs` (combobox open, Escape focus return,
select, per-entry remove, empty state, remember after test connection and login, key
exclusion, desktop/mobile screenshots). Reviewed captures are in
[screenshots/backend-history/](screenshots/backend-history/).
