// NetFree Inspector — Harmless-domain list
//
// Blocks against these domains almost always represent third-party ads,
// analytics, trackers, or social pixels. NetFree blocks them, but their
// absence doesn't break the page. They're hidden by default in the popup.
//
// Two kinds of patterns are supported:
//   1. **Domains** — case-insensitive suffix match on the request's hostname.
//        "doubleclick.net" matches "ad.doubleclick.net" and "doubleclick.net".
//   2. **URL patterns** — `host-suffix/path-prefix`. Matches when the request's
//        hostname suffix-matches the host part AND the pathname starts with
//        the path part. Used for noise endpoints on main hostnames you can't
//        blanket-mark (e.g. "google.com/complete/s" is autocomplete noise,
//        but you still want to see real blocks on google.com search results).
//
// ── Sources (merged at runtime, deduplicated) ────────────────────────────
//   1. BUNDLED_FALLBACK   — hardcoded below, always available offline.
//   2. BUNDLED_URL_PATTERNS — hardcoded below.
//   3. Remote JSON         — fetched once per day from GitHub Pages:
//        https://mfvirtualmail-bot.github.io/netfree-inspector/harmless-domains.json
//      Cached in chrome.storage.local, falls back gracefully if offline.
//   4. User custom list    — entries the user added via the options page.

const BUNDLED_FALLBACK = [
  // ── Google ads / analytics / tag manager ────────────────────────────────
  'doubleclick.net',
  'googlesyndication.com',
  'googletagmanager.com',
  'googletagservices.com',
  'google-analytics.com',
  'googleadservices.com',
  'adservice.google.com',
  'adsystem.google.com',
  'pagead2.googlesyndication.com',

  // ── Facebook / Meta tracking ────────────────────────────────────────────
  'facebook.net',
  'connect.facebook.net',

  // ── Twitter / X ads ─────────────────────────────────────────────────────
  'ads-twitter.com',
  'analytics.twitter.com',

  // ── TikTok / Snap / Pinterest pixels ────────────────────────────────────
  'analytics.tiktok.com',
  'sc-static.net',
  'ct.pinterest.com',

  // ── Common analytics / heatmap / session-replay ─────────────────────────
  'hotjar.com',
  'mouseflow.com',
  'fullstory.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'heap.io',
  'heapanalytics.com',
  'clarity.ms',
  'bat.bing.com',

  // ── General ad networks ─────────────────────────────────────────────────
  'adsrvr.org',
  'adnxs.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'quantcount.com',
  'adform.net',

  // ── Tag / consent managers ──────────────────────────────────────────────
  'onetrust.com',
  'cookielaw.org',
  'cookiebot.com',
  'trustarc.com',

  // ── Error / performance telemetry ───────────────────────────────────────
  'sentry.io',
  'bugsnag.com',
  'newrelic.com',
  'nr-data.net',
  'datadoghq.com',
  'logrocket.com',
  'rollbar.com',
];

// Bundled URL patterns — noise endpoints on main hostnames that can't be
// blanket-marked. Format: "host-suffix/path-prefix" (case-insensitive).
const BUNDLED_URL_PATTERNS = [
  // ── Google search noise (autocomplete, telemetry, async fragments) ─────
  'google.com/complete/s',     // autocomplete on every keystroke
  'google.com/gen_204',        // event telemetry (returns 204 No Content)
  'google.com/log',            // logging endpoint
  'google.com/client_204',     // client error reporting
  'google.com/async/',         // async page fragments
  'google.com/sgasync',        // search-graph async
  'google.com/url?',           // outbound-link click tracking
  'youtube.com/api/stats',     // YouTube playback telemetry
  'youtube.com/ptracking',     // YouTube tracking
];

const REMOTE_URL =
  'https://mfvirtualmail-bot.github.io/netfree-inspector/harmless-domains.json';

const REMOTE_CACHE_KEY = 'harmlessRemoteCache';
const USER_CUSTOM_KEY  = 'harmlessUserList';
const REFRESH_EVERY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── In-memory active sets (rebuilt after any change) ──────────────────────
let activeSuffixes   = new Set(BUNDLED_FALLBACK.map(s => s.toLowerCase()));
let activeUrlPatterns = BUNDLED_URL_PATTERNS.map(s => s.toLowerCase());

function rebuildSet(remoteDomains, userDomains, remoteUrlPatterns) {
  const set = new Set(BUNDLED_FALLBACK.map(s => s.toLowerCase()));
  if (Array.isArray(remoteDomains)) {
    for (const d of remoteDomains) {
      if (typeof d === 'string' && d.trim()) set.add(d.trim().toLowerCase());
    }
  }
  if (Array.isArray(userDomains)) {
    for (const d of userDomains) {
      if (typeof d === 'string' && d.trim()) set.add(d.trim().toLowerCase());
    }
  }
  activeSuffixes = set;

  const patterns = new Set(BUNDLED_URL_PATTERNS.map(s => s.toLowerCase()));
  if (Array.isArray(remoteUrlPatterns)) {
    for (const p of remoteUrlPatterns) {
      if (typeof p === 'string' && p.includes('/')) patterns.add(p.trim().toLowerCase());
    }
  }
  activeUrlPatterns = [...patterns];
}

async function loadCachedAndUser() {
  try {
    const r = await chrome.storage.local.get([REMOTE_CACHE_KEY, USER_CUSTOM_KEY]);
    const cache       = r[REMOTE_CACHE_KEY];
    const remoteList  = cache?.domains;
    const remotePaths = cache?.url_patterns;
    const userList    = r[USER_CUSTOM_KEY];
    rebuildSet(remoteList, userList, remotePaths);
  } catch {
    // storage unavailable — fallback stays active
  }
}

async function refreshRemoteIfStale() {
  try {
    const r       = await chrome.storage.local.get(REMOTE_CACHE_KEY);
    const cached  = r[REMOTE_CACHE_KEY];
    const fetched = cached?.fetchedAt ?? 0;
    if (Date.now() - fetched < REFRESH_EVERY_MS) return; // still fresh

    const res = await fetch(REMOTE_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    const json = await res.json();
    if (!Array.isArray(json.domains)) return;

    await chrome.storage.local.set({
      [REMOTE_CACHE_KEY]: {
        domains:      json.domains,
        url_patterns: Array.isArray(json.url_patterns) ? json.url_patterns : [],
        version:      json.version ?? null,
        updated:      json.updated ?? null,
        fetchedAt:    Date.now(),
      },
    });
    await loadCachedAndUser();
  } catch {
    // offline / blocked / malformed — we just keep the previous cache
  }
}

function isHarmlessHost(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  for (const suffix of activeSuffixes) {
    if (h === suffix || h.endsWith('.' + suffix)) return true;
  }
  return false;
}

// Check the full URL: hostname suffix match OR (host + path prefix) pattern.
function isHarmlessUrl(url) {
  if (!url) return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (isHarmlessHost(parsed.hostname)) return true;

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  for (const pattern of activeUrlPatterns) {
    const slash = pattern.indexOf('/');
    if (slash <= 0) continue;
    const pHost = pattern.slice(0, slash);
    const pPath = pattern.slice(slash);
    if ((host === pHost || host.endsWith('.' + pHost)) && path.startsWith(pPath)) {
      return true;
    }
  }
  return false;
}

// React to live changes from the options page — rebuild the set immediately.
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[USER_CUSTOM_KEY] || changes[REMOTE_CACHE_KEY]) {
      loadCachedAndUser();
    }
  });
}

// Kick off initial load + refresh on service-worker startup.
loadCachedAndUser().then(() => refreshRemoteIfStale());

// Export to service-worker scope (importScripts)
self.isHarmlessHost       = isHarmlessHost;
self.isHarmlessUrl        = isHarmlessUrl;
self.refreshHarmlessList  = refreshRemoteIfStale;
self.HARMLESS_REMOTE_URL  = REMOTE_URL;
