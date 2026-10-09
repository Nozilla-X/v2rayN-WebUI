# WebUI visual system

`Src/style.css` is the single source of visual tokens and shared control styles.
The eight pages keep their existing navigation, content order and actions.
No Backend, API or Composable changes are needed to use this system.

## Tokens

| Role | Tokens / rule |
| --- | --- |
| Palette | `--page-bg`, `--surface*`, `--border*`, `--text*`, `--accent*` |
| Feedback | `--success*`, `--warning*`, `--danger*` (foreground, border, surface) |
| Spacing | `--space-1/2/3/4/5/6/8`: 4/8/12/16/20/24/32px |
| Typography | `--font-caption/label/body/section/title`: 11/12/13/14/18px; `--font-sans`, `--font-mono` |
| Radius | `--radius-control/card/overlay/badge`: 6/8/8px/pill |
| Workspace | `--workspace-max`: 1880px; `--workspace-padding`: 16px, 12px on mobile |
| Controls | `--control-height`: 32px desktop, 44px mobile; compact actions use the same height |
| Inputs | `--font-input`: 13px desktop, 16px mobile to avoid browser auto-zoom |
| Tables | `--table-row-height`: 36px minimum for single-line desktop rows; content may grow |
| Icons | `--icon-size`: 16px; small inline markers use `--icon-size-small`: 12px |
| Dialogs | `--modal-width/wide/confirm`: 540/850/440px; `--modal-padding`: 16px |
| Elevation | `--shadow-card/menu/modal/auth` |
| States | `--focus`, `--focus-width/offset`, `--surface-hover/active`, `--selected`, `--disabled-opacity` |

Light and dark themes override palette and elevation tokens, not component geometry.
Semantic aliases (e.g. Toast success/danger colors) resolve to the same feedback palette.

## Shared primitives

- Buttons: `.button`, `.tool-button`, `.link-button`; `.primary` and `.danger` retain their semantics.
- Fields: the shared field selector covers form grids, dialogs, DNS, routing,
  templates, mappings, picker and login. `.code-area` stays monospace and independently resizable.
- Checkbox: native `<input type="checkbox">` (including `UiCheckbox`) keeps native
  checked, disabled and keyboard behavior. Existing booleans are not converted into switches.
- Badges: count, connection, active-route and mobile protocol/status badges use shared radius and semantic colors.
- Cards: `.panel`, `.subpanel` and mobile table cards share padding, border and radius.
  Flat `.form-section` / `.settings-subsection` retain their information hierarchy and common spacing/headings.
- Tables: shared headers, row height, cell padding and hover/selected colors.
  Selected rows are not overwritten by hover styling.
- Menus: dropdown, context menu, flyout and mobile global controls share surfaces, radius and shadow.
- Dialogs: shared widths and header/content/footer spacing; mobile editors remain
  full-screen, confirmations and Core details remain bounded overlays.
- Feedback: Toasts, inline warning/error, empty rows and inline empty/loading states use shared typography and semantic colors.
- Page headers/toolbars: one title level, control scale and bottom gap across all pages.

## Responsive boundaries

- 1360px: navigation may wrap onto its own row.
- 1120px: runtime/update controls may stack; template options become two columns.
- 960px: node group toolbar wraps.
- 760px: touch scale, single-column forms, existing mobile cards and bottom navigation.
- 460px: narrow-screen field and pagination adjustments.

CSS custom properties cannot be used in media-query conditions. Keep these literal
boundaries aligned with existing `matchMedia` behavior in the UI components.
Page-specific column widths, editor heights, scroll limits and overlay placement
are layout constraints, not competing control/typography tokens.

## Verification

```sh
npm test
npm run typecheck
npm run build
# Optional: externally installed Playwright and a local Vite/preview server.
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs WEBUI_URL=http://127.0.0.1:5178 node Tests/browser/allPages.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs WEBUI_URL=http://127.0.0.1:5178 node Tests/browser/designSystem.mjs
```

Browser checks use isolated API fixtures; they never manage a real Backend.
