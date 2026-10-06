# Changelog

## [Unreleased]

### Improvements

- Mobile pages now prioritize nodes and subscriptions: Core controls, routing selection,
  listeners and traffic move into a Core & status panel under the App Bar's More entry.
  A lightweight runtime/current-node summary remains visible. Desktop Core strips are unchanged.
- Mobile node types use small, intrinsic-width capsules beside the name. Transport/security
  share the endpoint summary instead of occupying a row of stretched button-like boxes.
- Mobile subscription utilities, column fitting and quick tests move into a Tools menu
  immediately before Add, keeping the group/search area focused on filtering.
- Mobile subscription cards now prioritize name/status/update information and disclose
  URLs and optional configuration only on demand. Update stays primary; edit/share/delete
  remain available through contextual actions.
- Routing uses compact rule summaries and batch/import/context menus rather than large
  repeated button rows. Logs use a narrow-screen feed; maintenance utilities are grouped.
- Settings, DNS, templates and mobile WebDAV share a consistent save bar above navigation,
  with duplicate footer explanations removed from mobile and compact form spacing throughout.
- Mobile save bars align with their actual form fields, without viewport-compensating
  negative margins that could make nested template panels protrude or appear offset.

## [1.0.1] - 2026-10-06

### Improvements

- Mobile App Bar keeps the brand visible and moves language, theme, connection state,
  refresh and logout into one More entry instead of crowding the header.
- Mobile bottom navigation provides quick access to nodes, subscriptions and routing;
  all other pages remain available through More, with the active destination indicated.
- Core status, current node, routing, listeners and traffic use responsive groups.
  Controls fill their cards even with short or empty content; the primary Core action
  follows the runtime state without placing all three buttons in one narrow row.
- DNS, parameters and dialog forms use a single column on mobile. Internal tabs remain
  scrollable with larger touch targets, consistent spacing and safe-area-aware footers.
- Mobile node cards put selection, name and context actions first, combine address/port,
  group protocol and test results, and disclose subscription/IP/traffic details on demand.
  Subscription cards and routing rules retain their data without desktop-width rows.
- Desktop navigation, dense tables, form columns and the existing visual style are preserved.

### Fixes

- Right-click TCP, real-connection, download and UDP tests now submit the full selected
  node batch instead of only the right-clicked node. Desktop, mobile card More and
  keyboard shortcuts share the same selection behavior.
- Node shortcuts no longer intercept Enter on focused buttons, links or disclosures.

### Compatibility and install

This is a frontend-only release. Backend API contracts are unchanged, and WebUI updates
do not replace the Backend or its configuration.

Download `v2rayN-WebUI.zip` and extract its contents into `webui/` beside `v2rayN.Web`,
or into the Backend's configured WebUI directory. The ZIP root contains `index.html`,
`assets/` and the existing static icons/images, without an enclosing `dist/` directory.
Node.js is not required to serve the installed WebUI. Refresh the browser after upgrading.

The separately attached `LICENSE` includes the license text and attribution for the
icon/image assets reused from [v2rayN](https://github.com/2dust/v2rayN).

## [1.0.0] - 2026-10-06

The first stable release of **v2rayN-WebUI**, a reference WebUI for `v2rayN.Web`.
The frontend and Backend are released and upgraded independently. Requires a
compatible [v2rayN.Web API](https://github.com/Nozilla-X/v2rayN); no particular
Backend version is hardcoded.

### Features

- Node/profile and subscription management, routing rules, DNS, settings and Core templates.
- Core runtime management and updates, Web application update controls, logs, and backup/restore.
- Responsive desktop and mobile layouts.
- System/light/dark themes and Simplified Chinese, Traditional Chinese and English interfaces.
- Same-origin `/api` requests; no embedded API address, Management Key or other credentials.

### Install

Download `v2rayN-WebUI.zip` and extract it into `webui/` beside the `v2rayN.Web`
executable, or into the Backend's configured WebUI directory:

```sh
mkdir -p webui
unzip v2rayN-WebUI.zip -d webui
```

The ZIP root contains `index.html`, `assets/` and static images/icons, without an
extra `dist/` or `v2rayN-WebUI/` directory. Node.js is needed only for building or
developing the frontend, not for serving the installed static WebUI.

### Icon asset attribution

The icon/image assets `NotifyIcon1.ico`, `NotifyIcon2.ico` and `v2rayN.png` are
reused from [v2rayN](https://github.com/2dust/v2rayN). Their original authors retain
copyright; this WebUI does not claim original authorship. See the separately
attached `LICENSE` file for the license text and asset attribution.

This attribution was clarified in a documentation-only follow-up. The published
`v1.0.0` tag and WebUI ZIP are unchanged.
