// NetFree Inspector — Background Service Worker
// Detects HTTP 418 responses (NetFree block signal) on any browser tab.
//
// Block types:
//   'blacklisted'     — site was reviewed and explicitly blocked (block.avif)
//   'not_whitelisted' — site is unknown / pending whitelist review (unknown.avif)
//   'user_settings'   — blocked by the user's own personal settings (myset.avif)
//   'file_type'       — file type not supported by automatic filtering
//                       (netfree_full_logo.svg served on the block page, no .avif)
//   'unknown'         — sub-resource block; type undetectable without the block page

// Load the shared harmless-domain classifier into the service-worker scope
importScripts('harmless-domains.js');

const NETFREE_HOST = 'netfree.link';
const BLOCK_CODE   = 418;

// ─────────────────────────────────────────────────────────
// Service-worker keep-alive
// ─────────────────────────────────────────────────────────
// MV3 service workers sleep after ~30 seconds of inactivity. Cold-
// start can take long enough that a fast XHR completion fires *before*
// our webRequest listener is re-attached — that's why the first
// download attempt sometimes gets missed and the second one catches.
// A periodic alarm fires often enough to reset the idle timer and
// keep the SW warm. The alarm handler is a no-op; just being invoked
// is what counts.
const KEEPALIVE_ALARM = 'netfree-keepalive';
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) { /* no-op — keeps the SW awake */ }
});

// ─────────────────────────────────────────────────────────
// Full-traffic recording (record-on-demand)
// ─────────────────────────────────────────────────────────
// The always-on block tracking below only stores 418s — enough for the
// popup's block list, but NOT enough for a recording NetFree support can
// navigate. A real recording shows the *whole* page load (accepted +
// blocked) so the reviewer can click the blocked row themselves.
//
// Capturing every request on every tab all the time would be heavy and
// privacy-invasive, so this is opt-in: "Reload & Record" starts a session
// for one tab, reloads it (capturing from the very first request), and we
// log all of its traffic until the recording is built or the tab closes.
//
// State is held in memory for speed (no async get/set race on the hot
// webRequest path) and mirrored to storage.session so a service-worker
// restart mid-recording doesn't lose the buffer.
const recTabs     = new Set();   // tabIds with an active recording
const recSessions = new Map();   // tabId -> { startTime, host, reqs: Map<reqId,obj> }
const REC_KEY     = (tabId) => `rec_${tabId}`;
const REC_MAX     = 3000;        // hard cap on requests per session

// Rebuild in-memory recording state after a service-worker restart.
// The promise itself is cached (not a boolean) so a caller that lands
// while hydration is still in flight awaits the same read instead of
// short-circuiting on empty maps; a failed read resets the cache so the
// next caller retries.
let hydratePromise = null;
function hydrateRecordings() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const all = await chrome.storage.session.get(null);
        for (const [k, v] of Object.entries(all)) {
          if (!k.startsWith('rec_') || !v || !v.active) continue;
          const tabId = Number(k.slice(4));
          recTabs.add(tabId);
          const reqs = new Map((v.reqs || []).map(r => [r.id, r]));
          recSessions.set(tabId, { startTime: v.startTime || 0, host: v.host || '', reqs });
        }
      } catch {
        hydratePromise = null; // retry on next call
      }
    })();
  }
  return hydratePromise;
}
hydrateRecordings();

// Debounced persistence — recording is short-lived and the keep-alive
// alarm keeps the SW warm meanwhile, so at most ~1s of tail traffic is
// ever at risk on an unexpected restart.
const recPersistTimers = new Map();
function schedulePersist(tabId) {
  if (recPersistTimers.has(tabId)) return;
  recPersistTimers.set(tabId, setTimeout(() => {
    recPersistTimers.delete(tabId);
    persistRecording(tabId);
  }, 700));
}
async function persistRecording(tabId) {
  const s = recSessions.get(tabId);
  if (!s) return;
  try {
    await chrome.storage.session.set({
      [REC_KEY(tabId)]: {
        active: true,
        startTime: s.startTime,
        host: s.host || '',
        reqs: [...s.reqs.values()],
      },
    });
  } catch { /* over quota or gone — in-memory copy still serves the build */ }
}

function recHeader(headers, name) {
  if (!headers) return undefined;
  const h = headers.find(x => x.name && x.name.toLowerCase() === name);
  return h ? h.value : undefined;
}

// onBeforeRequest — record the start of every request on a recording tab.
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, requestId, url, method, type, timeStamp } = details;
    if (!recTabs.has(tabId)) return;
    if (url.includes(NETFREE_HOST)) return;          // skip filter's own UI
    if (!/^https?:/i.test(url)) return;              // skip data:/blob:/etc
    const s = recSessions.get(tabId);
    if (!s || s.reqs.size >= REC_MAX) return;
    s.reqs.set(requestId, {
      id:        requestId,
      url,
      host:      extractDomain(url),
      method:    method || 'GET',
      type,
      startTime: timeStamp,
      endTime:   timeStamp,
      blocked:   false,
    });
  },
  { urls: ['<all_urls>'] },
);

// onCompleted — finalize a recorded request (status, ip, content meta).
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!recTabs.has(details.tabId)) return;
    const s = recSessions.get(details.tabId);
    if (!s) return;
    const r = s.reqs.get(details.requestId);
    if (!r) return;
    r.endTime       = details.timeStamp;
    r.statusCode    = details.statusCode;
    r.ip            = details.ip || '';
    r.blocked       = details.statusCode === BLOCK_CODE;
    r.contentType   = recHeader(details.responseHeaders, 'content-type');
    const len       = recHeader(details.responseHeaders, 'content-length');
    if (len != null && !Number.isNaN(Number(len))) r.contentLength = Number(len);
    schedulePersist(details.tabId);
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders'],
);

// onErrorOccurred — a request that never completed (DNS fail, reset,
// aborted). Keep it in the log as a started-but-unfinished row; the
// builder renders it without a response section.
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!recTabs.has(details.tabId)) return;
    const s = recSessions.get(details.tabId);
    if (!s) return;
    const r = s.reqs.get(details.requestId);
    if (!r) return;
    r.endTime = details.timeStamp;
    r.error   = details.error;
    schedulePersist(details.tabId);
  },
  { urls: ['<all_urls>'] },
);

async function startRecording(tabId, host) {
  recTabs.add(tabId);
  recSessions.set(tabId, { startTime: Date.now(), host: host || '', reqs: new Map() });
  await persistRecording(tabId);
}

async function stopRecording(tabId) {
  recTabs.delete(tabId);
  recSessions.delete(tabId);
  const tm = recPersistTimers.get(tabId);
  if (tm) { clearTimeout(tm); recPersistTimers.delete(tabId); }
  try { await chrome.storage.session.remove(REC_KEY(tabId)); } catch { /* gone */ }
}

function getRecording(tabId) {
  const s = recSessions.get(tabId);
  if (!s) return { active: false, requests: [] };
  return { active: true, requests: [...s.reqs.values()] };
}

// ─────────────────────────────────────────────────────────
// Session storage helpers
// (chrome.storage.session persists across SW restarts within
//  the same browser session, unlike in-memory Maps)
// ─────────────────────────────────────────────────────────

async function getTabData(tabId) {
  try {
    const key = `tab_${tabId}`;
    const res = await chrome.storage.session.get(key);
    return res[key] ?? { blocks: [], tabUrl: '' };
  } catch {
    return { blocks: [], tabUrl: '' };
  }
}

async function setTabData(tabId, data) {
  const key = `tab_${tabId}`;
  await chrome.storage.session.set({ [key]: data });
}

async function clearTabData(tabId) {
  await chrome.storage.session.remove(`tab_${tabId}`);
}

// Swallow "No tab with id" rejections that happen when a tab closes
// mid-flight (between a webRequest fire and the badge/icon update landing).
// All other errors still surface.
function safeTabCall(p) {
  return Promise.resolve(p).catch(err => {
    const msg = err && err.message ? err.message : String(err);
    if (msg.includes('No tab with id')) return; // expected race
    if (msg.includes('Invalid tab ID'))  return;
    throw err;
  });
}

// ─────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────

async function refreshBadge(tabId) {
  const data  = await getTabData(tabId);

  // Only count NON-harmless requests for the badge & icon colour.
  // Harmless blocks (ads, trackers) are still recorded and visible in the
  // popup when the user toggles "show harmless", but they don't alarm.
  const meaningful = data.blocks.reduce(
    (s, g) => s + g.requests.filter(r => !r.harmless).length,
    0,
  );

  if (meaningful > 0) {
    safeTabCall(chrome.action.setBadgeText({ tabId, text: String(meaningful) }));
    safeTabCall(chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF4444' }));
    safeTabCall(chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }));
  } else {
    safeTabCall(chrome.action.setBadgeText({ tabId, text: '' }));
  }

  await refreshIcon(tabId, meaningful);
}

// ─────────────────────────────────────────────────────────
// Dynamic icon — green when clean, red when blocks detected
// ─────────────────────────────────────────────────────────

async function refreshIcon(tabId, total) {
  const variant = total > 0 ? 'red' : 'green';
  await safeTabCall(chrome.action.setIcon({
    tabId,
    path: {
      16:  `icons/icon16-${variant}.png`,
      32:  `icons/icon32-${variant}.png`,
      48:  `icons/icon48-${variant}.png`,
      128: `icons/icon128-${variant}.png`,
    },
  }));
}

async function resetIcon(tabId) {
  // Called on navigation — green (clean slate)
  await refreshIcon(tabId, 0);
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

// A 418 on an XHR/fetch/sub_frame/main_frame request whose URL looks
// like a file download is almost always NetFree's "image-review" gate
// blocking a programmatic download (the gate HTML can't render in an
// XHR/fetch context, so the request just fails — user gets an empty
// PDF). These deserve a different UX path than generic 3rd-party
// blocks: instead of opening a ticket, suggest opening the URL in a
// new tab (where the gate CAN render) or disabling the gate setting.
const FILE_DOWNLOAD_TYPES = new Set(['xmlhttprequest', 'sub_frame', 'main_frame', 'object', 'other']);
const FILE_EXT_RE  = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt|epub|odt|ods|odp|rtf|mp3|mp4|wav|mov|avi|webm|jpg|jpeg|png|gif|webp|svg)(\?|$)/i;
const FILE_PATH_RE = /(^|\/)(pdf|download|file|attachment|export|invoice|statement|report|documents?)(\/|$|\?)/i;
function looksLikeFileDownload(url, resourceType) {
  if (!FILE_DOWNLOAD_TYPES.has(resourceType)) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  const p = u.pathname.toLowerCase();
  return FILE_EXT_RE.test(p) || FILE_EXT_RE.test(u.search) || FILE_PATH_RE.test(p);
}

// ─────────────────────────────────────────────────────────
// True block reason — read NetFree's own code from the 418 body
// ─────────────────────────────────────────────────────────
// A blocked URL returns a tiny (~400 B) HTML shell whose iframe src hash
// carries NetFree's real reason, e.g.
//     //netfree.link/block/#{"block":"deny","page_info":{...}}
// Codes seen live:
//   deny       → blacklisted / חסום (ads, trackers, blocked sites)
//   unknown    → "site not yet reviewed"  → NetFree's own "Undefined"
//   risk-type  → "file type not supported by automatic filtering"
// Reading this is far more reliable than guessing from the block-page
// .avif image, which only loads for main-frame blocks — sub-resources
// (tracker pings, media, cookies) never render a block page, so they used
// to stay 'unknown' and show as "Undefined" even when truly blocked.
const blockCodeCache    = new Map();   // url → code | null (dedupes refetches)
const BLOCK_FETCH_TIMEOUT_MS = 6000;

async function fetchBlockCode(url) {
  if (blockCodeCache.has(url)) return blockCodeCache.get(url);
  let code = null;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), BLOCK_FETCH_TIMEOUT_MS);
    // credentials omitted — we only need the block shell, not a session.
    const res   = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
    clearTimeout(timer);
    const text  = await res.text();
    const m = text.match(/\/block\/#([^"'\s]+)/);
    if (m) {
      const json = JSON.parse(decodeURIComponent(m[1]));
      if (json && typeof json.block === 'string') code = json.block;
    }
  } catch { /* network/abort/parse failure → null, fall back to heuristic */ }
  blockCodeCache.set(url, code);
  return code;
}

// NetFree block code → this extension's internal blockType (drives the
// popup badge + colour). null = unrecognised → keep the existing guess.
function blockTypeFromCode(code) {
  switch (code) {
    case 'deny':
    case 'black-list':
    case 'default-block':  return 'blacklisted';
    case 'unknown':
    case 'unknown-file':   return 'not_whitelisted';
    case 'risk-type':      return 'file_type';
    case 'myset':
    case 'time':
    case 'tags':           return 'user_settings';
    default:               return null;
  }
}

// Per-tab write queue. The block store is a read-modify-write on
// chrome.storage.session; concurrent 418s (a page firing many at once)
// could each read the same state and clobber each other, silently
// undercounting blocks. Funnel every per-tab mutation through one
// in-memory promise chain so each get→mutate→set runs atomically.
const tabWriteChains = new Map();   // tabId → Promise
function enqueueTabWrite(tabId, fn) {
  const prev = tabWriteChains.get(tabId) ?? Promise.resolve();
  const next = prev.then(fn, fn);   // run fn whether or not the prior write threw
  tabWriteChains.set(tabId, next.catch(() => {}));
  return next;
}

// Apply an authoritative block code (reported by the block-page content
// script) to a tab's stored blocks: cache it, stamp matching requests, and
// upgrade the group's blockType so the badge matches NetFree exactly.
async function applyCodeToTab(tabId, url, code) {
  if (!url || !code) return;
  blockCodeCache.set(url, code);
  const newType = blockTypeFromCode(code);
  let host; try { host = new URL(url).hostname; } catch { host = null; }
  await enqueueTabWrite(tabId, async () => {
    const data = await getTabData(tabId);
    let touched = false;
    for (const g of data.blocks) {
      if (g.blockType === 'file_download') continue;
      let groupMatched = false;
      for (const r of g.requests) {
        if (r.url === url || (host && extractDomain(r.url) === host)) {
          r.blockCode = code;
          groupMatched = true;
          touched = true;
        }
      }
      if (groupMatched && newType) g.blockType = newType;
    }
    if (touched) await setTabData(tabId, data);
  });
  await refreshBadge(tabId);
}

// ─────────────────────────────────────────────────────────
// webRequest — observe all completed requests
// ─────────────────────────────────────────────────────────

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const { tabId, statusCode, url, type, timeStamp, initiator, method, ip } = details;
    if (tabId === -1) return; // background / extension-internal

    // ── 1. NetFree block signal: HTTP 418 ──────────────────────────────────
    if (statusCode === BLOCK_CODE && !url.includes(NETFREE_HOST)) {
      const domain = extractDomain(url);

      // File downloads get their own group so we can show a different
      // UX (open-directly + disable-gate) without mixing them with
      // generic 3rd-party blocks on the same domain.
      const isFileDl = looksLikeFileDownload(url, type);

      // Read NetFree's real block reason straight from the 418 body. This
      // is the authoritative classification (deny/unknown/risk-type/…) for
      // every blocked request, including sub-resources that never render a
      // block page. Falls back to 'unknown' if the fetch fails. File
      // downloads keep their dedicated UX group regardless of code.
      const code     = await fetchBlockCode(url);
      const codeType = blockTypeFromCode(code);
      const blockType = isFileDl ? 'file_download' : (codeType ?? 'unknown');

      // Serialize the store mutation so concurrent 418s can't clobber.
      await enqueueTabWrite(tabId, async () => {
        const data     = await getTabData(tabId);
        const groupKey = `${domain}|${blockType}`;
        let group = data.blocks.find(g => g.groupKey === groupKey);
        if (!group) {
          group = { domain, groupKey, blockType, requests: [] };
          data.blocks.push(group);
        }
        group.requests.push({
          url,
          method:       method ?? 'GET',
          ip:           ip ?? '',
          resourceType: type,
          timestamp:    timeStamp,
          initiator:    initiator ?? '',
          blockCode:    code ?? null,
          harmless:     self.isHarmlessUrl
                         ? self.isHarmlessUrl(url)
                         : (self.isHarmlessHost ? self.isHarmlessHost(domain) : false),
        });
        await setTabData(tabId, data);
      });
      await refreshBadge(tabId);
      return;
    }

    // ── 2. Detect block TYPE from NetFree block-page assets ─────────────────
    //    When the main document is blocked, the browser loads the block page
    //    from netfree.link/block/.  The image filename reveals the block type:
    //      block.avif   → site is explicitly blacklisted
    //      unknown.avif → site is not whitelisted (unknown / pending review)
    if (url.includes(NETFREE_HOST + '/block/') || url.includes(NETFREE_HOST + '/')) {
      const data = await getTabData(tabId);
      if (!data.blocks.length) return;

      // Target the main-frame block group (or fall back to the latest
      // group). Skip file_download groups — those are an XHR/file UX
      // case, not a block-page-rendering case.
      const target =
        data.blocks.find(g =>
          g.blockType !== 'file_download' &&
          g.requests.some(r => r.resourceType === 'main_frame'))
        ?? [...data.blocks].reverse().find(g => g.blockType !== 'file_download')
        ?? data.blocks[data.blocks.length - 1];

      // Fallback only. The authoritative code comes from the block-page
      // content script (BLOCK_PAGE_CODE) and the 418-body fetch; the block
      // image is consulted only when both failed and the group is still
      // 'unknown'. The netfree_full_logo.svg → file_type guess was removed:
      // that logo appears on EVERY block page, so it mis-tagged plain
      // "not yet reviewed" pages (e.g. a new site) as file blocks.
      if (target.blockType === 'unknown') {
        if (url.includes('block.avif')) {
          target.blockType = 'blacklisted';
          await setTabData(tabId, data);
        } else if (url.includes('unknown.avif')) {
          target.blockType = 'not_whitelisted';
          await setTabData(tabId, data);
        } else if (url.includes('myset.avif')) {
          target.blockType = 'user_settings';
          await setTabData(tabId, data);
        }
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// ─────────────────────────────────────────────────────────
// Navigation — clear stale data when the user navigates away
// ─────────────────────────────────────────────────────────

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  await clearTabData(details.tabId);
  safeTabCall(chrome.action.setBadgeText({ tabId: details.tabId, text: '' }));
  await resetIcon(details.tabId);

  // A recording session is scoped to the site it was started on. The
  // "Reload & Record" reload (same host) keeps recording; navigating the
  // tab to a different site ends it — otherwise one record click would
  // silently capture the tab's browsing history across sites, and a later
  // ticket would upload unrelated traffic to NetFree.
  await hydrateRecordings();
  const s = recSessions.get(details.tabId);
  if (s) {
    const newHost = extractDomain(details.url);
    if (s.host && newHost && newHost !== s.host) {
      await stopRecording(details.tabId);
    }
  }
});

// ─────────────────────────────────────────────────────────
// Tab events
// ─────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await clearTabData(tabId);
  await stopRecording(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const data = await getTabData(tabId);
    data.tabUrl = tab.url ?? changeInfo.url;
    await setTabData(tabId, data);
  }
});

// ─────────────────────────────────────────────────────────
// Messages from popup
// ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  switch (msg.type) {

    case 'GET_BLOCKS':
      getTabData(msg.tabId).then(reply);
      return true; // async

    case 'CLEAR_BLOCKS':
      clearTabData(msg.tabId).then(async () => {
        safeTabCall(chrome.action.setBadgeText({ tabId: msg.tabId, text: '' }));
        await resetIcon(msg.tabId);
        reply({ ok: true });
      });
      return true;

    case 'GET_TAB_URL':
      safeTabCall(chrome.tabs.get(msg.tabId))
        .then(tab => reply({ url: tab?.url ?? '' }))
        .catch(()  => reply({ url: '' }));
      return true;

    case 'REFRESH_HARMLESS_LIST':
      if (typeof self.refreshHarmlessList === 'function') {
        self.refreshHarmlessList().then(() => reply({ ok: true }));
      } else {
        reply({ ok: false });
      }
      return true;

    // ── Full-traffic recording ──────────────────────────────────────
    case 'START_RECORDING':
      startRecording(msg.tabId, msg.host).then(() => reply({ ok: true }));
      return true;

    case 'STOP_RECORDING':
      stopRecording(msg.tabId).then(() => reply({ ok: true }));
      return true;

    case 'GET_RECORDING':
      // Ensure a post-restart session is restored before answering.
      hydrateRecordings().then(() => reply(getRecording(msg.tabId)));
      return true;

    // ── True block reason for a set of URLs ─────────────────────────────
    // The popup can't fetch arbitrary domains (its CSP connect-src only
    // allows netfree.link), so it asks the service worker — which has
    // <all_urls> host permission — to read each blocked URL's real code
    // from the 418 body. Used at recording-build time so every blocked row
    // carries NetFree's exact reason. Results are cached per URL.
    case 'GET_BLOCK_CODES': {
      const urls = Array.isArray(msg.urls) ? msg.urls : [];
      (async () => {
        const codes = {};
        await Promise.all(urls.map(async (u) => {
          try { codes[u] = await fetchBlockCode(u); } catch { codes[u] = null; }
        }));
        reply({ codes });
      })();
      return true;
    }

    // Authoritative block code read by the content script straight from the
    // rendered block page's URL hash — the most reliable source.
    case 'BLOCK_PAGE_CODE':
      applyCodeToTab(msg.tabId ?? (_sender.tab && _sender.tab.id), msg.url, msg.code)
        .finally(() => reply({ ok: true }));
      return true;
  }
});
