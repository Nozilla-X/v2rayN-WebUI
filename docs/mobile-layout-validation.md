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
