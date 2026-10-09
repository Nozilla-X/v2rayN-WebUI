# Node table follow-up fixes

- Address, subscription and IP cells use native `table-cell` display and `vertical-align: middle`.
- While speed testing, a profiles refresh indicator appears after **Stop tests** in the same status row, not in a separate feedback row.
- Existing `speedtest-started` and empty-ID `speedtest-result` notifications reconcile actual Backend operation state through a coalesced refresh. No localized completion string is guessed.
- SSE delay/speed/IP updates received after a profiles GET starts are retained when that older response returns. Later canonical GETs remain authoritative; result metadata is bounded by visible rows and cleared with the Session.
- [Browser-safe shortcuts](keyboard-shortcuts.md) are single keys scoped to focused node rows. Right-click hints are unique and match the mapping. Inputs, menus, dialogs, IME composition, Ctrl/Alt/Meta chords and Backspace do not trigger node actions.
- Locating the current row accounts for the sticky table header; mobile cards reserve space above the fixed bottom navigation.

## Checks

`npm test`, `npm run typecheck`, `npm run build`; browser suites `nodeFollowups.mjs`,
`batchSpeedtests.mjs`, `moduleBoundaries.mjs`, `allPages.mjs`, `tableAlignment.mjs`.

Alignment checks cover 1x/1.25x/1.5x display scale. Follow-up cases cover desktop and
mobile loading placement, live results followed by a delayed old GET, completion,
focused-row shortcuts, input isolation and current-row visibility.

All test records and screenshots are synthetic. Addresses use RFC 5737 documentation
ranges. User-provided addresses, names, credentials and screenshots are not fixtures.
Reviewed desktop/mobile captures are in [screenshots/node-followups/](screenshots/node-followups/).

These tests verify the frontend, not a real NAS TCP test. A NAS-side read-only status
check could not authenticate from the service environment, and no further credential
files or configuration were read/changed. Backend test execution and SSE transport
may need separate diagnosis if real results still do not arrive after updating.
