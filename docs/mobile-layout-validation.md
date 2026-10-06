# Mobile layout validation

## Layout contract

- The mobile breakpoint remains **760px**. Desktop navigation, tables and dense form grids remain intact above it.
- Mobile App Bar contains the existing brand and one More entry. Language, theme, refresh, logout and connection state reuse the same controls inside that entry. Escape/outside click dismiss it; breakpoint changes clear its open state.
- Bottom navigation exposes the main/nodes page, subscriptions and routing. More contains DNS, parameters, templates, maintenance and logs, using the existing dropdown and navigation actions. The selected destination is indicated in both navigation and More.
- Core status, current node and routing are separate groups. Start is the full-width primary action while stopped; restart takes that position while running. Existing busy/disabled guards and API calls are unchanged.
- Listener/traffic information, subscription rows and routing rules retain all their data in mobile groups/cards. Long names, URLs and matchers wrap rather than requiring a desktop-width row.
- Mobile forms (including dialogs, custom DNS and Core mappings) use one column. Tabs remain scrollable, with 44px targets and the original selected style.
- Mobile spacing uses 16px page/card padding, 12–16px form/group gaps and 24px workspace/section separation. Bottom navigation, toasts and sticky settings actions account for each other and safe-area insets.
- No new FAB, theme framework, Backend API or duplicated page/state implementation was introduced.

## Verification — 2026-10-06

`npm run build` passed locale validation, Vue/TypeScript checks and production bundling. `npm test` passed **90 tests**, including five new mobile layout contract tests.

Chromium/Playwright rendered the pre-change source and the updated source with identical isolated API fixtures. No real authentication credentials, subscriptions or Core processes were used or changed.

| Viewports | Coverage |
| --- | --- |
| 360, 390, 430 × 844 | Main/nodes page, subscriptions, routing, DNS (all four tabs), parameters (all four tabs) |
| 1280, 1440, 1920 × 1000 | Same primary pages and DNS tabs; desktop navigation, controls, multi-column forms and tables |
| Mobile and desktop | Long node names, subscription URLs, routing matchers, global settings, context actions and profile editor |

Browser assertions checked page overflow, mobile single-column grids, dialog/context/dropdown bounds, access to every secondary destination, language switching, Escape/outside-click dismissal, resize back to desktop controls and absence of JavaScript runtime errors. Full-page and viewport screenshots were visually reviewed against the baseline. Desktop page dimensions and layout were preserved.

Local screenshot evidence and the fixture-driven browser runner are under `/tmp/opencode/webui-mobile-browser/`; images and metrics are in its `screenshots/` directory (`before-*`, `after-*`, `metrics.json`). This is temporary validation output, not a production dependency or persistent backup.

These checks validate Chromium layout and frontend interaction, not live Backend/Core behavior or native iOS/Android browser behavior. Backend and native-device end-to-end validation were not performed.

## Follow-up: short-content regression

The first review used long fixture names and missed a real layout defect reported in the deployed UI: the status containers inherited desktop `justify-content` values, while their mobile grids had no explicit column tracks. Short content therefore shrank the inner track, leaving a large empty area on the right. The initial screenshots were not sufficient acceptance evidence for this case.

The corrected mobile grids explicitly use `minmax(0, 1fr)` and stretch alignment. Node/routing labels use a compact label/value grid, and upload/download values share a two-column group. With a short node name and zero traffic, the routing heading now starts around 500px rather than 680px at a 502px viewport; controls retain 44px height. This correction changes only the mobile breakpoint.

`Tests/browser/mobileStatus.mjs` now asserts **36 combinations**: widths 360/390/430/502/760/1440, short/long/empty names, and running/stopped Core states. It checks actual rendered group/control widths, touch targets, disabled states and first-screen content position. The runner uses only mocked API responses and never controls a real Core.

Run it against a local Vite server with an externally installed Playwright package:

```sh
WEBUI_URL=http://127.0.0.1:5178 \
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/path/to/playwright-browsers \
node Tests/browser/mobileStatus.mjs
```

The frontend build and **91 unit/contract tests** pass. Short and long fixture screenshots also cover all primary pages at 360/390/430/502/760 and desktop widths 1280/1440/1920. Desktop page dimensions remain unchanged; 1440px and 1920px screenshots of the five primary pages are pixel-identical to the previous deployed bundle. Local correction screenshots are under `/tmp/opencode/webui-mobile-browser/correction-{short,long}/` (including `correction-short/comparison-502.png`).

## Follow-up: node information hierarchy

The deployed node list still resembled a vertically expanded desktop table. Its default mobile presentation now orders the same data as:

1. Top-left selection, node name/current marker, top-right context actions.
2. Address and port together, followed by protocol/transport/security summary.
3. Delay and speed together.
4. A per-node More details toggle for subscription, optional IP information and all four traffic counters.

Secondary data is progressively disclosed, not removed. Desktop still renders the same dense table, without the mobile details control or duplicated port. Expanding details does not select or activate a node. Global node shortcuts now yield to focused buttons/links/summaries so Enter works on the disclosure button rather than activating a profile.

For the two-short-node fixture at 502px, a collapsed card is approximately **220px**, compared with approximately **520px** previously. Two nodes fit together in a scrolled mobile viewport. Long names and endpoints still wrap, and the selection hit area remains at the top rather than vertically centered down the card.

The build and **92 unit/contract tests** pass. `Tests/browser/mobileStatus.mjs` also checks node summary heights, selection position, capability-gated IP fields, preserved traffic values, keyboard expansion, selection independence, context actions and desktop field visibility across its 36 width/content/runtime combinations. Primary-page short/long screenshot regression covers 360/390/430/502/760px and desktop widths; 1440px and 1920px node screenshots are pixel-identical to the prior bundle.

Node-list comparison and expanded-state screenshots are in `/tmp/opencode/webui-mobile-browser/node-cards-{short,long}/`, including `node-cards-short/comparison-node-list-502.png`.

## Shared desktop/mobile batch speedtests

Context-menu TCP/real-connection/download/UDP tests previously passed the right-clicked profile directly, bypassing the selected batch. They now use the same selection resolver as keyboard shortcuts. Opening a menu on a selected profile preserves the batch; opening it on an unselected profile still deliberately replaces the selection with that profile. Submission snapshots the selected IDs and never accidentally omits `profileIds` to test all nodes.

`Tests/batchSpeedtestSelection.test.mjs` covers selection preservation, unselected-node behavior, snapshots and context-menu bindings. `Tests/browser/batchSpeedtests.mjs` intercepts **26 real frontend POST payloads** at 390/502/1440px, exercising four right-click test actions, mobile card More, single-node fallback and three keyboard shortcuts. All APIs are mocked, so no real Core or nodes are tested. Run this optional runner with the same `WEBUI_URL`, `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH` variables as the status runner.

Production build, **96 unit/contract tests**, the 26 payload checks and the 36 status/node-card browser combinations pass. This is one shared frontend fix for desktop and mobile; Backend API contracts are unchanged.

## Mobile Core controls become secondary

Mobile pages now retain only a single lightweight runtime/current-node summary (approximately 36px high). The App Bar's More entry opens **Core & status**, a compact modal panel containing Core actions, current node, routing selection, listeners and traffic. Node/subscription/routing content is no longer preceded by two status cards.

`CoreStatus.vue` renders the existing `RuntimeStrip` and `ConnectionStrip` exactly once: inside the mobile panel when requested, or in the original desktop position. All state and actions still belong to App's existing composables. Closing/reopening the panel does not restart Core or fetch a second copy of its state. The summary updates from the same runtime state and keeps faults visible without opening controls.

The panel supports focus trapping, focus return, Escape, outside-click dismissal and background scroll locking. Widening to desktop closes the panel and restores the existing strips; returning to mobile does not reopen it. Disconnect/session reset also clears its open state.

Build and **98 unit/contract tests** pass. The 36-case status/node-card browser runner covers panel lifecycle, original mocked start/restart/stop and route-activation endpoints, dark/light themes, fault-summary updates, focus/scroll behavior and breakpoint transitions. The 26 batch-speedtest payload checks also pass. Short/long fixture screenshot regression covers all primary pages at 360/390/430/502/760px and desktop widths 1280/1440/1920.

New screenshots are under `/tmp/opencode/webui-mobile-browser/core-panel-{short,long}/` and `core-panel-regression/`. This change is recorded under Unreleased; the published `v1.0.1` tag and assets remain unchanged.

## Denser node summaries and a coherent utility entry

Mobile node type is now a small capsule beside the name, using the existing accent palette. It follows the text width rather than stretching to a third of the card. Transport and security remain visible as lightweight endpoint metadata, removing the old standalone three-box protocol row. Long names/endpoints still wrap; the checkbox/context actions retain their touch areas. Short fixture cards are now approximately 175px high instead of 220px.

The five loose mobile toolbar icons are replaced by **Tools**, immediately before **Add**. Its items reuse the existing edit/add subscription actions, shared column-fitting state, fast real-connection test and mixed test actions. Editing remains disabled for all-groups selection and becomes available for a selected subscription. Desktop retains the original icon toolbar and protocol columns.

Build and **100 unit/contract tests** pass. The 36 status/node-card cases check intrinsic VLESS/Hysteria2 capsule widths, title placement, compact heights, summary visibility, long-name handling and existing Core-panel behavior. The batch/node-tools browser runner verifies **30 POST payloads**, all five utility entries, checkbox-style column fitting, subscription dialogs, multi-selection, English header spacing and original desktop utilities. Short/long fixture screenshots include subscription metadata entries and all primary pages at 360/390/430/502/760px plus desktop widths 1280/1440/1920.

Screenshot output is in `/tmp/opencode/webui-mobile-browser/node-density-{short,long}/` and `node-density-regression/`. These are Unreleased changes; no published release tag or asset is replaced.

## Whole-app mobile hierarchy and save controls

The follow-up audit covers all eight pages, not just individual screenshots:

- Subscription cards prioritize name/status, last update and interval. URLs, User Agent and filters are disclosed on demand; empty optional fields stay out of mobile details. Primary update and contextual edit/share/delete reuse existing actions. Header bulk updates/proxy choice remain in More. Short summaries are approximately 165px instead of a full-height field list.
- Routing headers and rules separate primary creation from secondary tools. Batch selection/export/movement/deletion and import/file/clipboard/URL options stay in menus, with append mode preserved. Rules show name, outbound and matchers; empty type labels and duplicate summaries are omitted on mobile. Typical rows are about 80px instead of roughly 180–200px.
- `SaveBar.vue` is shared by parameters, DNS, templates and mobile WebDAV. Mobile buttons are 128×44px; opaque single-row bars are approximately 60px high and sit above bottom navigation. The existing desktop hints remain; mobile explanations stay near the relevant form rather than doubling the sticky footer height.
- Headers, form gaps, subsection typography, update/WebDAV actions and log copy/clear controls were checked together. Logs use a mobile feed instead of a horizontally scrolling desktop table. Desktop toolbars, dense columns and API handlers remain intact.

Build and **103 unit/contract tests** pass. `Tests/browser/allPages.mjs` renders **128 page/viewport/locale combinations**: all eight pages at 360/390/430/502/760/1280/1440/1920px, Chinese/dark and English/light, plus internal tabs. It checks single-column forms, compact cards/rules, save-button geometry/navigation clearance, contextual actions, confirmations and **22 mocked save/update/import/WebDAV payloads**. The existing 36 status/node cases and 30 batch/node-tools payload checks also pass. No real subscription, routing, settings, backup, update or Core mutation is used for these tests.

Baseline and updated screenshots use the same complete API fixtures under `/tmp/opencode/webui-mobile-browser/global-mobile-{before,after}/`. Desktop page dimensions match across all eight pages in both locales at all three desktop widths. Comparisons include `comparison-subscriptions-502.png`, `comparison-rules-list-502.png` and `comparison-settings-save-502.png` in `global-mobile-after/`. The published `v1.0.1` tag/assets are unchanged.
