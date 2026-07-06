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
// Traffic-recording builder + uploader (self.NF.*) — the screen-recording
// flow builds and uploads the parallel traffic recording HERE in the worker,
// because the popup is usually closed by the time a screen recording stops.
importScripts('traffic-recording.js');

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

// Browser-wide capture — runs alongside a screen recording. A screen
// recording is page-independent (the user may demonstrate the problem in
// any tab), so scoping traffic to the starting tab would miss the demo.
// This captures every http(s) request Chrome makes in ANY tab while the
// screen recording runs. It can NOT see other programs on the computer
// (AnyDesk etc.) — their traffic never passes through this browser; the
// video shows them, the traffic recording won't.
const GREC_KEY = 'rec_global';
const GREC_MAX = 6000;           // roomier than per-tab: it's all tabs at once
let grecSession = null;          // { startTime, reqs: Map<reqId,obj> } | null

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
          if (k === GREC_KEY) {
            grecSession = { startTime: v.startTime || 0, reqs: new Map((v.reqs || []).map(r => [r.id, r])) };
            continue;
          }
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

// Global-session persistence mirrors the per-tab pattern above.
let grecPersistTimer = null;
function grecSchedulePersist() {
  if (grecPersistTimer) return;
  grecPersistTimer = setTimeout(() => { grecPersistTimer = null; grecPersist(); }, 700);
}
async function grecPersist() {
  if (!grecSession) return;
  try {
    await chrome.storage.session.set({
      [GREC_KEY]: { active: true, startTime: grecSession.startTime, reqs: [...grecSession.reqs.values()] },
    });
  } catch { /* over quota — in-memory copy still serves the build */ }
}
async function grecStart() {
  grecSession = { startTime: Date.now(), reqs: new Map() };
  await grecPersist();
}
async function grecStop() {
  grecSession = null;
  if (grecPersistTimer) { clearTimeout(grecPersistTimer); grecPersistTimer = null; }
  try { await chrome.storage.session.remove(GREC_KEY); } catch { /* gone */ }
}

function recHeader(headers, name) {
  if (!headers) return undefined;
  const h = headers.find(x => x.name && x.name.toLowerCase() === name);
  return h ? h.value : undefined;
}

// onBeforeRequest — record the start of every request on a recording tab,
// and on EVERY tab while a browser-wide (screen-recording) session runs.
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, requestId, url, method, type, timeStamp } = details;
    if (url.includes(NETFREE_HOST)) return;          // skip filter's own UI
    if (!/^https?:/i.test(url)) return;              // skip data:/blob:/etc
    const row = {
      id:        requestId,
      url,
      host:      extractDomain(url),
      method:    method || 'GET',
      type,
      startTime: timeStamp,
      endTime:   timeStamp,
      blocked:   false,
    };
    // tabId < 0 = not a real tab: the service worker's OWN fetches (e.g.
    // fetchBlockCode re-reading a 418 body) surface here as tabId -1. Those
    // would double every blocked row in the uploaded recording (the user's
    // request + our diagnostic re-fetch) — NetFree support would see phantom
    // duplicates. Only capture genuine tab traffic.
    if (grecSession && tabId >= 0 && grecSession.reqs.size < GREC_MAX) {
      grecSession.reqs.set(requestId, { ...row, tabId });
    }
    if (recTabs.has(tabId)) {
      const s = recSessions.get(tabId);
      if (s && s.reqs.size < REC_MAX) s.reqs.set(requestId, row);
    }
  },
  { urls: ['<all_urls>'] },
);

// onCompleted — finalize a recorded request (status, ip, content meta).
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const finalize = (r) => {
      r.endTime       = details.timeStamp;
      r.statusCode    = details.statusCode;
      r.ip            = details.ip || '';
      r.blocked       = details.statusCode === BLOCK_CODE;
      r.contentType   = recHeader(details.responseHeaders, 'content-type');
      const len       = recHeader(details.responseHeaders, 'content-length');
      if (len != null && !Number.isNaN(Number(len))) r.contentLength = Number(len);
    };
    if (grecSession) {
      const gr = grecSession.reqs.get(details.requestId);
      if (gr) { finalize(gr); grecSchedulePersist(); }
    }
    const s = recSessions.get(details.tabId);
    if (!s) return;
    const r = s.reqs.get(details.requestId);
    if (!r) return;
    finalize(r);
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
    if (grecSession) {
      const gr = grecSession.reqs.get(details.requestId);
      if (gr) { gr.endTime = details.timeStamp; gr.error = details.error; grecSchedulePersist(); }
    }
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
// Screen recording → NetFree upload → embedded in a ticket
// ─────────────────────────────────────────────────────────
// NetFree's own filter lets a user record their screen and attach the video
// to a support ticket. Users filtered at the NETWORK level can't run that
// native recorder, so we reproduce it end-to-end:
//   1. A "recorder" window (recorder.html) shows the desktopCapture picker
//      (Entire screen / Window / Tab — the user's choice), records the chosen
//      source with MediaRecorder, and POSTs the webm to NetFree's own
//      /api/upload-file, handing back a filekey. It's ONE page because a
//      chooseDesktopMedia streamId is only usable by the context that
//      requested it (the SW can't open the picker; an offscreen doc has no
//      desktopCapture API). The window persists across page navigation, so
//      recording keeps rolling wherever the user demonstrates the problem.
//   2. In parallel the SW captures browser-wide traffic (grecSession) and
//      builds a NetFree traffic recording from it.
//   3. We stash a pre-filled ticket whose body embeds the filekey exactly as
//      NetFree does — [video-embedded#](/upload-file/<filekey>) — plus the
//      traffic-recording link, and open the new-ticket form; netfree-fill.js
//      fills it, the user submits.
//
// State lives in storage.local so the popup + on-page pill can read it and it
// survives a service-worker restart mid-recording (the recorder window keeps
// recording, independent of the SW).
const SR_STATE  = 'screenRec';        // live: { status, startedAt, tabId, host, ticket, recorderWinId }
const SR_RESULT = 'screenRecResult';  // last outcome: { ok, error?, partial?, ts }

async function srGet() {
  try { const r = await chrome.storage.local.get(SR_STATE); return r[SR_STATE] || null; }
  catch { return null; }
}
async function srSet(state) {
  try {
    if (state) await chrome.storage.local.set({ [SR_STATE]: state });
    else       await chrome.storage.local.remove(SR_STATE);
  } catch { /* storage gone — popup just won't reflect state */ }
}
async function srResult(result) {
  try { await chrome.storage.local.set({ [SR_RESULT]: { ...result, ts: Date.now() } }); }
  catch { /* non-fatal */ }
}

// Close the recorder window as a backstop. The recorder page self-closes on
// success/error, so this only matters if it crashed. Takes an explicit id
// because the terminal handlers clear state (srGet → null) before calling it.
async function closeRecorderWindow(winId) {
  let id = winId;
  if (id == null) { const st = await srGet(); id = st && st.recorderWinId; }
  if (id != null) { try { await chrome.windows.remove(id); } catch { /* already gone */ } }
}

// Begin a recording. The popup passes the localized ticket subject + intro +
// page URL; the video embed line is appended after upload.
//
// A single extension PAGE does the whole capture: it shows the desktopCapture
// picker, records the chosen source, and uploads the webm. It has to be one
// context — chooseDesktopMedia can't run in a service worker, doesn't exist
// in an offscreen document, and its streamId is consumable only by the page
// that requested it. This "recorder" window persists while the user
// demonstrates in other tabs, so recording survives navigation. It reports
// RECORDER_STARTED / RECORDER_DONE / RECORDER_ERROR back here.
async function startScreenRecording({ tabId, host, ticket }) {
  const existing = await srGet();
  if (existing && ['picking', 'recording', 'uploading'].includes(existing.status)) {
    return { ok: false, reason: 'busy' };
  }
  await srSet({ status: 'picking', startedAt: 0, tabId: tabId ?? null, host: host || '', ticket: ticket || null });

  let win = null;
  try {
    // Visible only during the source pick, then minimized the instant
    // recording starts (see handleRecorderStarted). Chrome renders the
    // "Choose what to share" picker INSIDE this window and clips it to the
    // window's size — too small and the screen thumbnails you must click to
    // select "Entire Screen" are hidden. So size it to comfortably fit the
    // whole picker (thumbnails + Share button), centered on the display.
    const opts = { url: 'recorder.html', type: 'popup', focused: true };
    try {
      const displays = await chrome.system.display.getInfo();
      const d  = displays.find(x => x.isPrimary) || displays[0];
      const wa = (d && d.workArea) || { left: 0, top: 0, width: 1280, height: 800 };
      // The picker shows the screen/window thumbnails side-by-side, so it
      // needs real width AND height or they clip. Fill most of the work area
      // (it minimizes the moment recording starts anyway).
      const w  = Math.min(1000, wa.width  - 40);
      const h  = Math.min(860,  wa.height - 40);
      opts.width = w;
      opts.height = h;
      opts.left = wa.left + Math.max(0, Math.round((wa.width  - w) / 2));
      opts.top  = wa.top  + Math.max(0, Math.round((wa.height - h) / 2));
    } catch {
      opts.width = 720; opts.height = 720; opts.top = 40; opts.left = 120;
    }
    win = await chrome.windows.create(opts);
  } catch {
    await srSet(null);
    await srResult({ ok: false, error: 'recorder-open-failed' });
    return { ok: false, reason: 'recorder-open-failed' };
  }
  if (win && win.id != null) {
    const st = await srGet();
    if (st) await srSet({ ...st, recorderWinId: win.id });
  }
  // If the recorder page dies during source selection without reporting,
  // don't leave 'picking' stuck forever — it would hide the record button.
  armPickingWatchdog();
  return { ok: true };
}

// The recorder page began capturing (user picked a source). Start the
// browser-wide traffic capture that rides alongside the video: whichever tab
// the user demonstrates in gets captured.
async function handleRecorderStarted() {
  const st = await srGet();
  if (!st || st.status !== 'picking') return;
  await srSet({ ...st, status: 'recording', startedAt: Date.now() });
  await grecStart();
  await injectOverlayAllTabs();   // show the floating stop pill everywhere
  // Get the recorder window out of the way: it only needed to be visible so
  // the source picker could anchor to it. Minimizing keeps MediaRecorder
  // running (verified) while removing the confusing little window from the
  // screen (and from the recording). The user stops via the floating pill or
  // Chrome's native "Stop sharing" bar; restoring the window from the taskbar
  // is a fallback that still shows its own Stop button.
  //
  // A couple of retries over the first second: when the capture actually
  // starts, Chrome tends to (re)focus the sharing surface, which can pop the
  // window back to 'normal'. After that it stays minimized so a user who
  // deliberately restores it later isn't fought.
  minimizeRecorderWindow(st.recorderWinId);
}

function minimizeRecorderWindow(winId) {
  if (winId == null) return;
  const doMin = () => { try { chrome.windows.update(winId, { state: 'minimized' }); } catch { /* ok */ } };
  doMin();
  setTimeout(doMin, 500);
  setTimeout(doMin, 1200);
}

// The floating stop pill (rec-overlay.js) is injected programmatically rather
// than relied on declaratively: Edge/Chrome can gate broad-match ("<all_urls>")
// declarative content scripts, so they silently don't run. Injecting from the
// SW while a recording is active is both reliable and tidy (the overlay only
// exists when it's needed). rec-overlay.js self-guards against double runs.
async function injectOverlayInto(tabId, url) {
  if (!/^https?:/i.test(url || '')) return;         // can't inject into chrome://, extension pages, etc.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['rec-overlay.js'] });
  } catch { /* restricted page (web store, PDF viewer, …) — nothing to do */ }
}

async function injectOverlayAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    await Promise.all(tabs.map(t => injectOverlayInto(t.id, t.url)));
  } catch { /* best effort */ }
}

// While a recording is active, a tab that finishes loading (fresh navigation
// or a new tab) also needs the pill — inject on completion.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const st = await srGet();
  if (!st || (st.status !== 'recording' && st.status !== 'uploading')) return;
  await injectOverlayInto(tabId, tab && tab.url);
});

// The recorder page reported the picker was cancelled or failed.
async function handleRecorderCancelled(err) {
  const st = await srGet();
  if (!st || st.status !== 'picking') return;   // already recording — ignore
  await srSet(null);
  await grecStop();
  clearWatchdog();
  // Cancel resets quietly; a real picker failure is surfaced.
  if (err) await srResult({ ok: false, error: `picker: ${err}` });
}

// The recorder window was closed by hand mid-recording (no Stop). The capture
// in that page is gone — nothing to upload. Clear state; no ticket.
async function handleRecorderAborted() {
  const st = await srGet();
  if (!st || (st.status !== 'recording' && st.status !== 'picking')) return;
  await srSet(null);
  await grecStop();
  clearWatchdog();
  await srResult({ ok: false, error: 'aborted' });
}

// Watchdog — if a stage never reports back (recorder page crashed, or the SW
// died mid-flight AND the storage backup write failed), don't leave the UI
// stuck. Fail the session after a bounded wait.
const SR_WATCHDOG = 'nf-screenrec-watchdog';
// 10 min: long enough for a big webm on a slow uplink, short enough that a
// genuinely dead upload doesn't look "in progress" forever.
function armWatchdog()        { try { chrome.alarms.create(SR_WATCHDOG, { delayInMinutes: 10 }); } catch { /* ok */ } }
// 5 min to pick a source — generous for a human, finite for a dead picker.
function armPickingWatchdog() { try { chrome.alarms.create(SR_WATCHDOG, { delayInMinutes: 5 }); } catch { /* ok */ } }
function clearWatchdog()      { try { chrome.alarms.clear(SR_WATCHDOG); } catch { /* ok */ } }

// Popup / floating-pill Stop. The recorder page also listens for this same
// broadcast and does the actual stop+upload; here we just reflect state.
async function stopScreenRecording() {
  const st = await srGet();
  if (st) await srSet({ ...st, status: 'uploading' });
  armWatchdog();
  return { ok: true };
}

// Build + upload the browser-wide traffic recording captured alongside the
// video. Every blocked row gets NetFree's real block code (fetched live from
// the 418 body), with the always-on tracker's classification as fallback.
async function buildGlobalTrafficUrl() {
  await hydrateRecordings();
  if (!grecSession || !grecSession.reqs.size) return null;
  const reqs = [...grecSession.reqs.values()];

  const blockedRows = reqs.filter(r => r.blocked);
  const codes = {};
  // Bounded fan-out: an ad-heavy multi-tab session can have hundreds of
  // unique blocked URLs. Firing them all at once hammers the network and,
  // because each fetch's 6 s abort timer starts at queue time, the tail
  // aborts before it runs (codes silently null) — and the ticket-open is
  // delayed meanwhile. A small worker pool keeps codes accurate and fast.
  const blockedUrls = [...new Set(blockedRows.map(r => r.url))];
  const POOL = 8;
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(POOL, blockedUrls.length) }, async () => {
    while (next < blockedUrls.length) {
      const u = blockedUrls[next++];
      codes[u] = await fetchBlockCode(u);
    }
  }));

  // blockType fallback from the per-tab block store of every tab that had
  // a blocked row (exact URL match first, then same-host).
  const typeByUrl  = {};
  const typeByHost = {};
  const tabIds = [...new Set(blockedRows.map(r => r.tabId).filter(t => typeof t === 'number' && t >= 0))];
  for (const tid of tabIds) {
    const data = await getTabData(tid);
    for (const g of (data.blocks || [])) {
      for (const r of (g.requests || [])) {
        typeByUrl[r.url] = g.blockType;
        try { typeByHost[new URL(r.url).hostname] = g.blockType; } catch { /* skip */ }
        if (r.blockCode && codes[r.url] == null) codes[r.url] = r.blockCode;
      }
    }
  }

  const enriched = reqs.map(r => ({
    ...r,
    blockType: r.blocked ? (typeByUrl[r.url] || typeByHost[r.host] || 'unknown') : undefined,
    blockCode: r.blocked ? (codes[r.url] || null) : undefined,
  }));
  const arr = self.NF.buildTrafficRecording(enriched);
  if (!arr || !arr.length) return null;
  return await self.NF.uploadTrafficRecording(arr);
}

// Terminal transitions. Both are reachable from TWO channels — the runtime
// message and the storage.local backup write — so they must be idempotent:
// the first caller consumes the state (srGet → null) and later callers no-op.
let srFinalizing = false;

async function completeScreenRecording(filekey) {
  if (srFinalizing) return;
  srFinalizing = true;
  let recWinId = null;
  try {
    const st = await srGet();
    if (!st) return;                       // other channel already handled it
    recWinId = st.recorderWinId;
    let trafficUrl = null, trafficFailed = false;
    try {
      trafficUrl = await buildGlobalTrafficUrl();
    } catch (e) {
      trafficFailed = true;
      console.warn('[NetFree Inspector] traffic-recording upload failed:', e?.message || e);
    }
    await grecStop();
    await finalizeScreenTicket(st, filekey, trafficUrl, trafficFailed);
    await srSet(null);
    await srResult({ ok: true });
  } finally {
    srFinalizing = false;
    clearWatchdog();
    try { await chrome.storage.local.remove('screenRecUpload'); } catch { /* ok */ }
    await closeRecorderWindow(recWinId);
  }
}

// phase 'start' → the capture never began: nothing was demonstrated, so
// there is nothing to file — flash the error and let the user retry.
// Any later phase → a demo DID happen, and the user must still end up
// with an open support request: attach the traffic recording if it can be
// built, note the missing video, and open the form regardless.
async function failScreenRecording(error, phase) {
  if (srFinalizing) return;
  srFinalizing = true;
  let recWinId = null;
  try {
    const st = await srGet();
    if (!st) return;
    recWinId = st.recorderWinId;
    let ticketOpened = false;
    if (phase !== 'start') {
      let trafficUrl = null, trafficFailed = false;
      try {
        trafficUrl = await buildGlobalTrafficUrl();
      } catch (e) {
        trafficFailed = true;
        console.warn('[NetFree Inspector] traffic-recording upload failed:', e?.message || e);
      }
      try {
        await finalizeScreenTicket(st, null, trafficUrl, trafficFailed);
        ticketOpened = true;
      } catch { /* form didn't open — plain failure toast below */ }
    }
    await grecStop();
    await srSet(null);
    await srResult({ ok: false, error: error || 'error', partial: ticketOpened });
  } finally {
    srFinalizing = false;
    clearWatchdog();
    try { await chrome.storage.local.remove('screenRecUpload'); } catch { /* ok */ }
    await closeRecorderWindow(recWinId);
  }
}

// Recorder window → background lifecycle messages (fast path).
async function handleRecorderMessage(msg) {
  switch (msg.type) {
    case 'RECORDER_STARTED':   return handleRecorderStarted();
    case 'RECORDER_CANCELLED': return handleRecorderCancelled(msg.err);
    case 'RECORDER_ABORTED':   return handleRecorderAborted();
    case 'RECORDER_STOPPING': {
      const st = await srGet();
      if (st) await srSet({ ...st, status: 'uploading' });
      armWatchdog();
      return;
    }
    case 'RECORDER_DONE':  return completeScreenRecording(msg.filekey);
    case 'RECORDER_ERROR': return failScreenRecording(msg.error, msg.phase);
  }
}

// Backup path: the recorder page also writes its outcome to storage.local.
// storage.onChanged wakes the service worker, so even a lost runtime message
// (SW restart mid-upload) can't strand the flow at "Uploading…".
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.screenRecUpload) return;
  const v = changes.screenRecUpload.newValue;
  if (!v) return;
  if (v.type === 'RECORDER_DONE' && v.filekey) completeScreenRecording(v.filekey);
  else if (v.type === 'RECORDER_ERROR')        failScreenRecording(v.error, v.phase);
});

// Watchdog firing = a stage never reported back.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SR_WATCHDOG) return;
  const st = await srGet();
  if (!st) return;
  if (st.status === 'uploading') await failScreenRecording('upload-timeout', 'upload');
  else if (st.status === 'picking' || st.status === 'recording') {
    // Recorder page died without reporting — unlock the record button.
    if (st.recorderWinId != null) { try { await chrome.windows.remove(st.recorderWinId); } catch { /* gone */ } }
    await srSet(null);
    await grecStop();
    await srResult({ ok: false, error: st.status === 'picking' ? 'picker-timeout' : 'recorder-lost' });
  }
});

// Recorder window closed by hand (X) mid-recording — the beforeunload
// RECORDER_ABORTED usually beats this, but cover the case where it didn't.
chrome.windows.onRemoved.addListener(async (winId) => {
  const st = await srGet();
  if (!st || st.recorderWinId !== winId) return;
  if (st.status === 'picking' || st.status === 'recording') await handleRecorderAborted();
});

// Service-worker startup reconciliation. The SW can be killed at any point;
// on restart, recover anything the two completion channels left behind.
(async () => {
  try {
    // 1. An upload outcome that was written to storage.local but whose
    //    handler didn't finish before the SW died (e.g. killed between
    //    opening the ticket tab and clearing state). Re-dispatch it — the
    //    idempotent srGet→null guard makes a genuine duplicate a no-op, but
    //    an unfinished one now completes (or fails) properly instead of the
    //    watchdog later opening a second, video-less ticket.
    const up = (await chrome.storage.local.get('screenRecUpload')).screenRecUpload;
    if (up) {
      if (up.type === 'RECORDER_DONE' && up.filekey) { await completeScreenRecording(up.filekey); return; }
      if (up.type === 'RECORDER_ERROR')              { await failScreenRecording(up.error, up.phase); return; }
    }

    const st = await srGet();
    if (!st) return;

    // 2. Stranded 'picking'/'recording' (restart during selection or capture).
    //    The recorder window holds the only copy of the capture — if it's gone,
    //    the recording is lost; clear state so the button unlocks. If the
    //    window is somehow still alive, leave it: its own report will drive
    //    the flow. No 'interrupted' toast for 'picking' (nothing recorded).
    if (st.status === 'picking' || st.status === 'recording') {
      const alive = st.recorderWinId != null &&
        await chrome.windows.get(st.recorderWinId).then(() => true).catch(() => false);
      if (!alive) {
        await srSet(null);
        await grecStop();
        if (st.status === 'recording') await srResult({ ok: false, error: 'interrupted' });
      }
      return;
    }

    // 3. Stranded 'uploading' — the recorder page's upload was in flight when
    //    the SW died and its result never landed. If the window is gone, the
    //    upload can't complete; fail cleanly (a ticket still opens if a demo
    //    happened, via the failScreenRecording path).
    if (st.status === 'uploading') {
      const alive = st.recorderWinId != null &&
        await chrome.windows.get(st.recorderWinId).then(() => true).catch(() => false);
      if (!alive) await failScreenRecording('interrupted', 'upload');
    }
  } catch { /* best effort */ }
})();

// Stash the finished ticket (subject + intro + video embed + traffic-
// recording link) for netfree-fill, then open NetFree's new-ticket form.
// Opened as a regular TAB in the last-focused window — a transient popup
// window proved easy to miss ("blinks" and is gone if anything closes it).
// Driven from the background so it works even if the user stopped via
// Chrome's native "Stop sharing" bar with the popup already closed.
async function finalizeScreenTicket(state, filekey, trafficUrl, trafficFailed) {
  const ticket  = (state && state.ticket) || {};
  const subject = ticket.subject || 'Screen recording';
  const parts   = [];
  if (ticket.bodyIntro) parts.push(ticket.bodyIntro);
  if (filekey) parts.push(`[video-embedded#](/upload-file/${filekey})`);
  else         parts.push(ticket.videoFailedNote || 'Note: the screen-recording video failed to upload.');
  if (trafficUrl) parts.push(`${ticket.trafficLabel || 'Traffic recording'}: ${trafficUrl}`);
  else if (trafficFailed) parts.push(ticket.trafficFailedNote || 'Note: the traffic recording failed to upload.');
  const body = parts.join('\n\n');
  try {
    await chrome.storage.local.set({ pendingTicket: { subject, body, ts: Date.now() } });
  } catch { /* the form still opens; user can paste by hand */ }

  const pageUrl   = ticket.url || '';
  const u         = encodeURIComponent(pageUrl);
  const ticketUrl = `https://netfree.link/app/#/tickets/new?u=${u}&r=${u}&t=site&bi=`;
  try {
    const tab = await chrome.tabs.create({ url: ticketUrl, active: true });
    try { await chrome.windows.update(tab.windowId, { focused: true }); } catch { /* ok */ }
  } catch {
    try { await chrome.windows.create({ url: ticketUrl }); } catch { /* nothing more we can do */ }
  }
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
  if (!msg) return;
  // The recorder window addresses the background with target:'background'
  // (fire-and-forget lifecycle events). SCREEN_RECORD_STOP is a broadcast the
  // recorder ALSO listens for, so let it fall through to the switch too.
  if (msg.target === 'background') { handleRecorderMessage(msg); return; }

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

    // ── Screen recording (video) ────────────────────────────────────────
    case 'SCREEN_RECORD_START':
      startScreenRecording(msg).then(reply);
      return true;

    case 'SCREEN_RECORD_STOP':
      // The recorder window handles the actual stop+upload (it also receives
      // this broadcast); here we just reflect state to 'uploading'.
      stopScreenRecording().then(reply);
      return true;

    case 'SCREEN_RECORD_STATUS':
      srGet().then((state) => reply({ state }));
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
