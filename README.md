# v2rayN WebUI

This repository contains one WebUI implementation for the v2rayN Web API. It is an
independently developed Vue application; it is **not** part of the API contract and the API
does not require Vue, Vite, Node.js, or this UI to start.

## Development

Requirements: Node.js 22 or later and npm.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

To use a locally running API while developing, start the Vite server and point its development
proxy at the API. The default target is `http://127.0.0.1:5080`; override it when needed:

```sh
VITE_API_TARGET=http://127.0.0.1:5080 npm run dev
```

The browser always calls same-origin `/api/...` and `/api/events` URLs. Only Vite's development
server proxies `/api` to the configured target; production builds do not embed an API origin
and need no CORS configuration.

## Build and install

```sh
npm run build
```

The deployable artifact is `dist/`:

```text
dist/
├── index.html
└── assets/**
```

Copy the *contents* of `dist/` into the API's configured WebUI directory (the default is
`webui/` beside the API executable):

```sh
mkdir -p /opt/v2rayn/webui
cp -a dist/. /opt/v2rayn/webui/
```

The API serves the installed static site and uses `index.html` for non-file SPA routes. Replace
or remove the files in `webui/` to change or uninstall this implementation. The API release and
self-update packages do not contain or modify that directory.

## API compatibility

Compatible with the v2rayN Web API capabilities used by this implementation, including
Management Key setup/login, session and SSE-ticket authentication, runtime events, profiles,
subscriptions, routing, DNS, settings, backup/restore, and core/Web updates. The UI reads
authoritative editor option lists from the API; it does not import or vendor ServiceLib enums.
Use `/api/status` after authentication to inspect the running Backend's version, commit, and
runtime capabilities. The UI does not require a special Backend version endpoint or private
UI manifest.

The independently versioned WebUI may not be compatible with every historical Backend build.
Pair it with a Backend that exposes the documented endpoints and fields above; the Backend
version and capabilities returned by `/api/status` are the compatibility source of truth.

## Screenshots

<!-- Screenshots are stored in docs/screenshots and are captured from this repository's build. -->

### Desktop

![v2rayN WebUI desktop view](docs/screenshots/desktop.png)

### Mobile

![v2rayN WebUI mobile view](docs/screenshots/mobile.png)

## License

This project follows the v2rayN repository's GPL-3.0-or-later license. See [LICENSE](LICENSE).
