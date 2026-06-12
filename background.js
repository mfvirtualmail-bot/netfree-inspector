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
// webRequest — observe all completed requests
// ─────────────────────────────────────────────────────────

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const { tabId, statusCode, url, type, timeStamp, initiator, method, ip } = details;
    if (tabId === -1) return; // background / extension-internal

    // ── 1. NetFree block signal: HTTP 418 ──────────────────────────────────
    if (statusCode === BLOCK_CODE && !url.includes(NETFREE_HOST)) {
      const data   = await getTabData(tabId);
      const domain = extractDomain(url);

      // File downloads get their own group so we can show a different
      // UX (open-directly + disable-gate) without mixing them with
      // generic 3rd-party blocks on the same domain.
      const isFileDl = looksLikeFileDownload(url, type);

      // Infer blockType at creation time from the resource type.
      // Don't guess "video" from the resource type. sub_frame/media/
      // object blocks were previously force-classified as file_type and
      // routed through a video-review UX — but most aren't video (iframes
      // are ads/widgets/embeds), so that mislabeled the block AND pointed
      // the ticket at the wrong thing. We now leave them generic
      // ('unknown' = "something on this page isn't loading") and only
      // treat a block as video when there's real evidence (an actual
      // video host/extension — see ticketKindFor in popup.js).
      let initialBlockType = 'unknown';
      if (isFileDl) {
        initialBlockType = 'file_download';
      }

      const groupKey = `${domain}|${initialBlockType}`;

      let group = data.blocks.find(g => g.groupKey === groupKey);
      if (!group) {
        group = {
          domain,
          groupKey,
          blockType: initialBlockType,
          requests: [],
        };
        data.blocks.push(group);
      }

      group.requests.push({
        url,
        method:       method ?? 'GET',
        ip:           ip ?? '',
        resourceType: type,
        timestamp:    timeStamp,
        initiator:    initiator ?? '',
        harmless:     self.isHarmlessUrl
                       ? self.isHarmlessUrl(url)
                       : (self.isHarmlessHost ? self.isHarmlessHost(domain) : false),
      });

      await setTabData(tabId, data);
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

      if (url.includes('block.avif')) {
        target.blockType = 'blacklisted';
        await setTabData(tabId, data);
      } else if (url.includes('unknown.avif')) {
        target.blockType = 'not_whitelisted';
        await setTabData(tabId, data);
      } else if (url.includes('myset.avif')) {
        target.blockType = 'user_settings';
        await setTabData(tabId, data);
      } else if (url.includes('netfree_full_logo.svg')) {
        // File-type block: NetFree won't automatically filter this file type
        // (zip/exe/etc). The block page shows the plain logo, no .avif image.
        // Only classify as file_type if we haven't already classified as one
        // of the avif-backed types — avif detection is more authoritative.
        if (target.blockType === 'unknown') {
          target.blockType = 'file_type';
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
  }
});
