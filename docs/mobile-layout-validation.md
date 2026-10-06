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
