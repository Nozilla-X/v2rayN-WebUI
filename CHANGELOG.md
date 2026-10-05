# Changelog

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
