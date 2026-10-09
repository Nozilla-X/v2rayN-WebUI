# Backend address history

`Src/Composables/useBackend.ts` keeps `v2rayn-api-endpoint` as the current saved
address (existing behavior) and `v2rayn-api-endpoint-history` as an ordered list of
up to 10 previously used, normalized addresses.

- The login, first-run setup and local-only screens share
  `Components/BackendAddressFields.vue`, which renders the history selector.
- History is written only after a successful `Test connection`, login or first-run
  setup. Choosing an entry updates the address and reuses the existing address-switch
  flow (session cancellation, request abort, endpoint-scoped storage); it never
  connects automatically.
- The remove button deletes the currently selected entry from this browser only.
- Entries are normalized with `normalizeApiBase`: credentials, query strings,
  fragments, non-HTTP(S) schemes and duplicates never enter the list. Path prefixes
  are preserved when present.
- Migration: when no history key exists yet, the single saved `v2rayn-api-endpoint`
  seeds the list once. An explicitly empty history stays empty.
- History is local to this browser profile and WebUI origin. Management Keys and
  session tokens are never included. An invalid or credential-bearing value is
  ignored rather than stored, and blocked storage degrades to an empty list.

Checks: `Tests/backendHistory.test.mjs` (storage, migration, dedup, limit, blocked
storage) and `Tests/browser/backendHistory.mjs` (select, remove, remember after test
connection and login, key exclusion, desktop/mobile screenshots). Reviewed captures
are in [screenshots/backend-history/](screenshots/backend-history/).
