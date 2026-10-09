# v2rayN WebUI

This repository contains one WebUI implementation for the v2rayN Web API. It is an
independently developed Vue application; it is **not** part of the API contract and the API
does not require Vue, Vite, Node.js, or this UI to start.

The Backend is `v2rayN.WebAPI` in [Nozilla-X/v2rayN](https://github.com/Nozilla-X/v2rayN).
The frontend and Backend are independently versioned and released.

## Development

Requirements: Node.js 22 or later and npm.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Refresh the README desktop/mobile screenshots with isolated fixture data (no live Backend):

```sh
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run screenshots
```

Playwright's browser download and optional local screenshot artifacts are ignored by Git.

To use a locally running API while developing, start the Vite server and point its development
proxy at the API. The default target is `http://127.0.0.1:5080`; override it when needed:

```sh
VITE_API_TARGET=http://127.0.0.1:5080 npm run dev
```

The default remains same-origin; only Vite's development server proxies `/api` in that mode.
An explicitly configured Backend is contacted directly by the browser, including in development,
and must allow the WebUI's exact origin through CORS.

## Standalone hosting and Backend selection

The same static artifact supports reverse-proxied same-origin access and standalone hosting.
On the unsigned-in screen, leave **Backend API address** empty for same-origin, or enter an
absolute HTTP(S) address and click **Use address** / **Test connection**. Examples:

- `http://127.0.0.1:5080`
- `http://192.168.1.10:5080`
- `https://v2rayn-api.example.com`
- `https://gateway.example.com/v2rayn` (the proxy strips `/v2rayn` before forwarding `/api/**`)

Do not append `/api`. Trailing slashes, default ports and host/scheme casing are normalized.
Credentials, query strings, fragments and non-HTTP(S) schemes are rejected. API requests do
not follow redirects; configure the final endpoint. REST, login, setup, downloads, SSE tickets
and EventSource all share `Src/Composables/apiEndpoint.ts`. Icons, favicon, static assets and
`webui-config.js` always belong to the WebUI origin.

For a deployment default, edit **`webui-config.js` after extracting/building** (no rebuild needed):

```js
window.__V2RAYN_WEBUI_CONFIG__ = { apiBaseUrl: 'http://127.0.0.1:5080' }
```

The shipped value is `''` (same-origin). A saved user selection overrides this deployment
default. Serve the config file without long-lived caching. No particular public dashboard
domain is hard-coded in the application.

Each browser also keeps a local history of recently used Backend addresses (up to 10,
most recent first). The **Backend API address** field is a combobox: the caret inside
the input opens a dropdown of previous addresses, each removable. History is plain
`localStorage` for this WebUI origin only; it never stores Management Keys or session
tokens, and choosing an entry applies the address without connecting automatically.

For an independent site at `https://webui.example.com`, configure the Backend:

```ini
V2RAYN_WEB_API_KEY=<your-management-key>
V2RAYN_WEB_ALLOWED_ORIGINS=https://webui.example.com
```

Allowed origins are **scheme + host + port**, not URLs with paths. Multiple values are comma
separated; no wildcard or cookie/credential CORS is supported. Configure each Backend separately.
An allowed WebUI is trusted to manage that Backend once the user gives it a session.
If the independent static host sets a CSP, its `connect-src` policy must permit the selected API.
This is a WebUI hosting setting, not Backend configuration.

**First-run setup is not permitted cross-origin**, even for an allowed origin. Configure the
Management Key on the Backend first, or initialize through a direct loopback API client.
The UI explains this restriction using `/api/setup/status`.

Sessions are scoped to the normalized endpoint **including its path prefix**. Applying a new
Backend closes SSE, cancels all pending requests (including login/setup), clears runtime state,
credential drafts and the old local session. A bounded best-effort logout uses an immutable
snapshot of the old URL/token, never the new endpoint. Unscoped historical `v2rayn-web-token`
values are discarded and require a fresh login. The Management Key is never persisted by the WebUI.
Standalone mode does not automatically contact a configured local/LAN API on page load:
**Test connection** or **Sign in** is the first explicit network action.

### HTTPS dashboards and local network access

An HTTPS site connecting to localhost/LAN HTTP is subject to the browser's Local Network
Access permission **and** mixed-content policy. They are different from CORS. Allow local
network access for the site when prompted; do not disable browser security globally.
Loopback (`localhost`, `127.0.0.1`, `::1`) and literal private IPs are recognized without DNS
probing. A `targetAddressSpace` hint is used only when `Request` exposes and accepts it; other
browsers keep their native inference. EventSource has no equivalent hint or permission option.

Some Firefox versions permit HTTP loopback but block HTTP LAN as mixed active content even
after granting local-network permission. Use an HTTPS API/reverse proxy or same-origin hosting
in that case. Old Private Network Access preflights are not bypassed through a blanket
`Access-Control-Allow-Private-Network` response. CORS, network failure and permission failure
are intentionally diagnosed as possible causes, not falsely distinguished from opaque fetch
errors. Browser and enterprise-policy differences require real REST **and SSE** verification.

`Tests/browser/backendConnection.mjs` exercises a real isolated native Backend and built UI in
Chrome/Firefox (no API/SSE mocks). Provide `WEBAPI_EXECUTABLE`, `BROWSER_TEST_DIR` (with a private
`management-key`, `tls.key`, `tls.crt`), `LAN_ADDRESS`, and optionally `PLAYWRIGHT_MODULE`,
`PLAYWRIGHT_BROWSERS_PATH` / `CHROME_EXECUTABLE`. It uses ports 5178/5443/5180 and isolated data.
`PUBLIC_HTTPS_ORIGIN` optionally navigates a real public HTTPS document and injects only the
local UI artifact into its DOM for address-space testing; it does **not** deploy or modify that
public site. Preserve the document (not `document.write`/synthetic navigation), and inspect
the recorded browser remote address/address spaces before claiming public-network LNA coverage.

## Build and install

Download `v2rayN-WebUI.zip` from a [Release](https://github.com/Nozilla-X/v2rayN-WebUI/releases)
and extract its contents into a directory served by an independent static web server:

```sh
mkdir -p webui
unzip v2rayN-WebUI.zip -d webui
```

The ZIP has no enclosing `dist/` directory. The installed WebUI consists only of static files;
**Node.js is needed for development/building, not at runtime**. You can replace or upgrade the
WebUI independently without replacing the Backend.

To build the same static site from source:

```sh
npm run build
```

The deployable artifact is `dist/`:

```text
dist/
├── index.html
├── webui-config.js
└── assets/**
```

Copy the *contents* of `dist/` into your static web server's document directory:

```sh
mkdir -p /opt/v2rayn-webui
cp -a dist/. /opt/v2rayn-webui/
```

The API does not serve or configure these files. Relative static-asset paths support both a
domain root and a subdirectory. The API release and self-update are independent of this site.

### GitHub Pages

The standalone site is deployed at <https://nozilla-x.github.io/v2rayN-WebUI/> by
`.github/workflows/pages.yml` on pushes to `main` or manual dispatch. It publishes only `dist/`,
without a private Backend address, Management Key or session token.

Select your API address on the login screen. For this site, the Backend's exact incoming origin
is `https://nozilla-x.github.io` (not the repository path). HTTPS-to-HTTP local-network browser
restrictions still apply; Pages hosting and CORS do not bypass them.

## API compatibility

This WebUI requires a compatible `v2rayN.WebAPI` (or historical `v2rayN.Web`) API that provides
the API capabilities `auth.sessions`, `events.sse`, `editor.options`, `profiles`,
`subscriptions`, `routing`, `dns`, `settings`, `backup.restore`, `core.runtime`, `core.updates`,
and `web.self-update`.

After authentication, `GET /api/status` returns `webVersion`, `gitCommit`, `runtimeIdentifier`,
and `capabilities`; the UI keeps the status response as API data and can use these fields when
checking compatibility. Dynamic protocol/Core/DNS/routing/editor choices come from Backend
option endpoints. The UI does not import or vendor ServiceLib enums, and it does not require a
private WebUI manifest or a separate API version endpoint.

`webVersion`, `web.self-update`, `/api/web-updates` and build metadata's `Web*` keys remain
intentional compatibility names. The updater consumes `/api/web-updates`' advertised `name`:
new Backends use `v2rayN.WebAPI`, while historical Backends can still use `v2rayN.Web`.

The independently versioned WebUI may not work with every historical Backend build. Pair it
with an API that reports the required capability identifiers and exposes the endpoints above.

## Releases

PRs and pushes to `main` run tests, type checking and the production build without creating a
Release. A stable `vX.Y.Z` tag, or a manual CI run with `release_tag`, publishes the verified
`v2rayN-WebUI.zip`. Before tagging, update `package.json` and the lockfile to `X.Y.Z` and add its
entry to [CHANGELOG.md](CHANGELOG.md). The workflow automatically reads that entry for Release
Notes; missing notes or inconsistent versions fail the release.

## Screenshots

<!-- Screenshots are stored in docs/screenshots and are captured from this repository's build. -->

### Desktop

![v2rayN WebUI desktop view](docs/screenshots/desktop.png)

### Mobile

![v2rayN WebUI mobile view](docs/screenshots/mobile.png)

## License

This project follows the v2rayN repository's GPL-3.0-or-later license. See [LICENSE](LICENSE).

The icon/image assets `Public/NotifyIcon1.ico`, `Public/NotifyIcon2.ico` and
`Public/v2rayN.png` are reused from [v2rayN](https://github.com/2dust/v2rayN).
Their original authors retain copyright; this WebUI does not claim original authorship.
