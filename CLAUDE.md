# CLAUDE.md — NetFree Inspector

This file is auto-read by Claude Code at the start of every session.
It contains project context for the NetFree Inspector Chrome extension.

---

## Project Overview

**Name:** NetFree Inspector
**Purpose:** Chrome extension (Manifest V3) that detects HTTP 418 responses from
the NetFree content filter and shows blocked URLs, grouped by domain and
classified by block type, in a toolbar popup.
**Language:** Vanilla JavaScript (no framework, no bundler, no npm dependencies)
**Repo:** `mfvirtualmail-bot/netfree-inspector`
**Distribution:** Chrome Web Store

**History note:** Originally developed inside `mfvirtualmail-bot/beit-midrash-finance`
under `chrome-extension/` and `chrome-extension-store/`, then extracted into this
standalone repo with git history preserved via `git filter-repo`.

**Hosting (v1.4.4+):** This repo now hosts its own GitHub Pages site from
`/docs/`. The deployed extension fetches `harmless-domains.json` daily from:
  `https://mfvirtualmail-bot.github.io/netfree-inspector/harmless-domains.json`
Project landing page: `https://mfvirtualmail-bot.github.io/netfree-inspector/`.

**Legacy URLs in beit-midrash-finance — retained until users upgrade:**
Versions v1.3.0–v1.4.3 of the extension are still in the wild and fetch from
the OLD URL inside `beit-midrash-finance/docs/netfree-inspector/`. Those files
(and `chrome-extension-store/privacy-policy.md` referenced by the live Chrome
Web Store listing pre-v1.4.4) must stay in beit-midrash-finance until the
v1.4.4 Chrome Web Store release rolls out to all users, after which they can
be removed. See the banner in `beit-midrash-finance/CLAUDE.md` for status.

---

## Tech Stack

| Layer | Value |
|---|---|
| Extension manifest | Version 3 (MV3) |
| Language | Vanilla JavaScript (ES2020+, no TypeScript, no bundler) |
| Background | Service worker (`background.js`) |
| Build tools | **None** — the repo IS the extension. Zip the root to upload. |
| Icon generator | `create-icons.js` — pure Node.js, no deps (uses `zlib` + manual CRC32) |
| Styling | Hand-written CSS with RTL-aware rules |

No `package.json` — there are no dependencies, no build step, no lint/test commands.

---

## Architecture

### How it works

NetFree is a whitelist-based content filter. When it blocks a resource it returns
**HTTP 418** — that's the signal this extension listens for.

- `background.js` registers `chrome.webRequest.onCompleted` for `<all_urls>`
- On every 418 response it:
  - Inspects the response URL to classify the block type (see table below)
  - Stores the blocked request in `chrome.storage.session` keyed by `tabId`
  - Updates the toolbar badge count + icon color (green = clean tab, red = blocks on tab)
- `chrome.webNavigation.onBeforeNavigate` clears the tab's state on top-frame navigation
- `popup.js` reads `chrome.storage.session` for the current tab and renders the grouped list
- `options.html` / `options.js` is a separate preferences page opened via the manifest
  `options_ui` field

### Block type classification

| Type | Signal (in response URL) | Badge color |
|---|---|---|
| Blacklisted | `block.avif` | Red |
| Not whitelisted | `unknown.avif` | Amber |
| Personal settings | `myset.avif` | Purple |
| File type | `netfree_full_logo.svg` on block page (no avif) | Cyan |
| Unknown / third-party | HTTP 418, no avif match | Gray |

### Bilingual UI

Popup and options page render in both Hebrew (RTL) and English. String tables
are inlined at the top of `popup.js` and `options.js` — no i18n library.

### `harmless-domains.js`

Allowlist of domains that the NetFree filter typically blocks as noise (analytics,
ad networks, telemetry) and which the user generally does not want to request
whitelisting for. Popup hides these from the default view.

---

## How to load unpacked in Chrome (dev mode)

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select this repo's root (the folder containing `manifest.json`)
6. The NetFree Inspector icon appears in the toolbar

Iterating on code: after changes, click the **reload** (↻) button on the extension
card at `chrome://extensions`. For service-worker changes that don't appear to
take effect, use "Service worker" → "Inspect" and reload from devtools.

---

## Build / Lint / Test commands

There is **no build step** and **no test suite**. Commands that do exist:

| Command | Purpose |
|---|---|
| `node create-icons.js` | Regenerate all 12 icon PNGs (default + green + red, 4 sizes each). Only needed if you change icon colors or design. |
| `pwsh scripts/release.ps1 -Version X.Y.Z` | Bump `manifest.json`, build `dist/netfree-inspector-vX.Y.Z.zip` + stable `dist/netfree-inspector.zip`, commit the bump, and cut a GitHub **pre-release**. The `/docs/` landing-page download button follows `releases/latest/download/netfree-inspector.zip`, so a pre-release does **not** change what visitors get. Promote once confirmed good: `gh release edit vX.Y.Z --repo mfvirtualmail-bot/netfree-inspector --latest --prerelease=false`. |
| *(manual)* | Zip the repo root (excluding `.git`, `store/`, `CLAUDE.md`, `README.md`, `create-icons.js`) to produce a Chrome Web Store upload ZIP. See `store/README.md` for the exact file list. |

---

## Manifest details

| Field | Value |
|---|---|
| `manifest_version` | 3 |
| `name` | NetFree Inspector |
| `version` | 1.3.0 (see `manifest.json` for current) |
| `permissions` | `webRequest`, `tabs`, `storage`, `webNavigation` |
| `host_permissions` | `<all_urls>` (needed to observe 418 responses on any site) |
| `background.service_worker` | `background.js` |
| `action.default_popup` | `popup.html` |
| `options_ui.page` | `options.html` (opens in a new tab) |
| `content_security_policy.extension_pages` | Allows `https://netfree.link` in `img-src` so the popup can display the NetFree logo |

---

## File map

```
manifest.json            MV3 config
background.js            Service worker — webRequest listener, classification, state
popup.html/.css/.js      Toolbar popup UI + logic (bilingual HE/EN)
options.html/.js         Options/preferences page
harmless-domains.js      Allowlist of ignorable 3rd-party domains
create-icons.js          Pure-Node PNG icon generator
icons/                   Pre-built PNGs: default + green + red variants, sizes 16/32/48/128
docs/                    GitHub Pages site root — index.html landing page +
                         harmless-domains.json (fetched daily by the extension)
store/                   Chrome Web Store submission kit (listings, privacy policy,
                         promo tile, screenshots guide, upload ZIPs)
README.md                User-facing docs
CLAUDE.md                This file
.gitignore
```

---

## Chrome Web Store

Listings and submission assets are in `store/`. Privacy policy (`store/privacy-policy.md`)
must be hosted at a public URL (GitHub raw link works) and referenced in the
store listing — required because the extension requests `<all_urls>` host
permission.

**Before uploading a new version:**

1. Bump `manifest.json` `version`
2. Build a new ZIP from repo root (exclude `.git`, `store/`, `CLAUDE.md`, `README.md`, `create-icons.js`)
3. Upload via the Chrome Web Store Developer Dashboard
4. Update `store/store-listing-he.md` / `store-listing-en.md` if feature set changed

---

## Known gaps / TODO

- **No tests** — everything is manual-verified in Chrome. Consider adding a
  minimal `puppeteer` / `chrome-extension-test` harness before major refactors.
