# Frontend module boundaries

This is a presentation extraction, not a new state-management layer. Backend URLs,
requests, Session/SSE ownership and save/update lifecycles stay in the existing
`Composables/use*.ts` files. No feature component creates a second instance of them.

## Assembly and Shell

- `App.vue`: instantiates the business Composables once, wires their dependencies,
  loads/restores the Session, switches Backend, loads the active page and binds views.
- `Components/Shell/AppShell.vue`: readiness/authentication layout and workspace slots.
- `Components/AppHeader.vue`: branding and responsive global controls.
- `Components/Shell/AppNavigation.vue`: one desktop/mobile navigation implementation.
  The existing product has tabs/bottom navigation, not a sidebar; no sidebar was added.
- `Components/CoreStatus.vue`, `CorePanel.vue`, `RuntimeStrip.vue`, `ConnectionStrip.vue`:
  retain their existing responsive runtime/status responsibilities.
- `Components/Shell/ModalHost.vue`: conditional mounting of feature dialogs. It receives
  original reactive state/actions, not copies or a new modal store.
- `Features/Session/SessionScreen.vue`: loading, initial setup and login forms only.

## Feature views

`Components/Pages/*Page.vue` remain the eight stable entry points for Nodes,
Subscriptions, Routing, DNS, Settings, Templates, Maintenance and Logs. Small pages
were not moved just to rename directories or broken into one-use fragments.

- `Features/Profiles/useNodeActions.ts`: Nodes toolbar/context/keyboard adapter,
  including selection snapshots and export selection restoration. Calls the original
  profile/subscription actions; it does not issue requests or own profile data.
- `Features/Profiles/NodeContextMenu.vue`: rendering, placement, menu focus and resize cleanup.
- `Features/Profiles/ProfileGroupSection.vue`: group membership and ordering editor.
- `Features/Profiles/ProfileTransportSection.vue`: transport-specific fields/options.
- `Features/Profiles/ProfileSecuritySection.vue`: TLS/Reality fields and disabled states.
- `Features/Profiles/editorOptionValues.ts`: shared preservation of custom option values.
- `Components/Modals/ProfileModal.vue`: protocol canonicalization and form assembly remain
  together, including the original protocol-change watcher and advanced-JSON normalization.
- `Features/Maintenance/WebUpdateSection.vue`: WebAPI/legacy Web update identity,
  update controls and progress rendering. It delegates all update actions unchanged.

All editor sections edit the same parent-owned reactive form. There is no synchronization
watcher, copied draft, extra load on mount or automatic save/update.

## Shared UI

- `Components/UI/UiButton.vue`, `UiIconButton.vue`: one native button root and attribute/
  event forwarding. No implicit `type` is added; existing submit/button behavior remains.
- `Components/UI/UiDialog.vue`: the existing shade/form/content DOM, focus trap and return
  focus via `useModalFocus`. Header/footer slots preserve the existing markup and CSS.
- Existing `UiIcon`, `UiCheckbox`, `ActionDropdown`, `FlyoutMenu`, `SaveBar`,
  `ToastViewport` and `ConfirmDialog` remain shared primitives with independent behavior.
- Inputs, selects, code textareas, badges, cards and tables continue using native elements
  and the first-stage CSS tokens. No forwarding-only Input/Select/Switch/Table wrappers
  were introduced, avoiding changes to `.number`, nullable options, validation and table semantics.
- `UI/useFeedback.ts`: Toast queue/timers and confirmation queue extracted unchanged.
- `UI/useGlobalShortcuts.ts`: original keyboard mapping, editable-target guards and Escape
  priority. Modal closures are supplied in the former order by the application assembler.

The module-extraction phase required no new styles. Third-stage presentation feedback
and UI polish are documented in [polish-audit.md](polish-audit.md).
Locale checking now recursively includes feature and Shell sources, so extraction does
not silently remove translation coverage.

## Regression checks

`npm test`, `npm run typecheck`, `npm run build` plus isolated Playwright suites:

- `Tests/browser/allPages.mjs`: eight pages, responsive navigation and mutations.
- `Tests/browser/designSystem.mjs`: first-stage geometry/themes and UI states.
- `Tests/browser/batchSpeedtests.mjs`: context/keyboard/mobile tools request payloads.
- `Tests/browser/moduleBoundaries.mjs`: extracted editor bindings, native validation,
  dialog focus/submit, Core lifecycle and Session login/logout requests.

Browser suites use API fixtures; they do not manage a real Backend.
