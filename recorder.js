// NetFree Inspector — recorder window (picker + MediaRecorder + uploader).
//
// Why one page does all three:
//   • chrome.desktopCapture.chooseDesktopMedia can't run in a service worker
//     ("a target tab is required") and doesn't exist in an offscreen
//     document. It DOES run from an extension page.
//   • The streamId it returns is consumable ONLY by the same rendering
//     context that requested it. Handing it to another page (offscreen or a
//     tab) fails with "Error starting tab capture". So the page that picks
//     must also getUserMedia + record + upload.
// This window persists independently of the popup and of page navigation, so
// the recording keeps rolling while the user demonstrates the problem in any
// other tab, window, or app (whatever they chose in the source picker).
//
// Format matches NetFree's own recorder so support views it identically:
//   video/webm;codecs=avc1,opus @ ~1.5 Mbps (fallbacks if avc1 absent).
//   Upload: POST /api/upload-file?mode=private, multipart field "file",
//   credentials:include (the netfree.session cookie rides along) → {filekey}.

const UPLOAD_URL = 'https://netfree.link/api/upload-file?mode=private';

let recorder   = null;
let stream     = null;
let chunks     = [];
let activeMime = '';
let failed     = false;     // fatal error already reported — ignore later events
let stopping   = false;     // a stop is in progress — ignore duplicate triggers
let startedAt  = 0;
let tickTimer  = null;

const $ = (id) => document.getElementById(id);

// ── Real-filter (SSE) capture ─────────────────────────────────────────────
// Alongside the screen video, read NetFree's OWN live event stream and build
// the traffic recording from it verbatim (parser/grouper in sse-recording.js),
// so the uploaded recording IS NetFree's own data — real identity/socket rows,
// true filter categories, real block reasons/error details. Best-effort: if
// the stream is unreachable (not behind the filter) or the Origin rule doesn't
// take, we upload nothing here and the background falls back to its
// chrome.webRequest reconstruction.
//
// The stream host gates on the request header Origin === "https://netfree.link/"
// exactly. fetch() can't set Origin, so a declarativeNetRequest session rule
// rewrites it (this extension page holds declarativeNetRequestWithHostAccess +
// <all_urls>). No credentials are needed — the filter identifies the user by
// network position (the stream already carries user::<id> rows).
const SSE_URL        = 'https://eeapi.internal.netfree.link/traffic/sse';
const NF_SAVE_URL    = 'https://netfree.link/api/user/save-traffic-record';
const NF_VIEW_PREFIX = 'https://netfree.link/app/#/tools/traffic/view/';
const DNR_RULE_ID    = 9101;
const SSE_MAX_EVENTS = 300000;   // hard cap so a very long recording can't OOM

let sseEvents = [];
let sseAbort  = null;
// Why a recording did/didn't use the real stream. Persisted to
// storage.local (`nfSseDiag`) at the end of every recording, because the
// recorder window closes and takes its console with it — this is the only
// way to see afterwards what happened. Viewable in sse-test.html.
let sseStreamDiag = { started: false, ruleOk: false, status: 0, rejected: false, err: null, first: '' };

async function installOriginRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [DNR_RULE_ID],
    addRules: [{
      id: DNR_RULE_ID,
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'set', value: 'https://netfree.link/' }] },
      condition: { requestDomains: ['eeapi.internal.netfree.link'], resourceTypes: ['xmlhttprequest', 'other'] },
    }],
  });
}
async function removeOriginRule() {
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DNR_RULE_ID] }); } catch { /* ok */ }
}

// Begin consuming the stream. Never throws — a failure just means no
// stream-based recording (the background reconstruction still runs).
async function startSSE() {
  sseEvents = [];
  sseStreamDiag = { started: false, ruleOk: false, status: 0, rejected: false, err: null, first: '' };
  if (!self.NF || !chrome.declarativeNetRequest) { sseStreamDiag.err = 'no-api'; return; }
  try { await installOriginRule(); sseStreamDiag.ruleOk = true; }
  catch (e) { sseStreamDiag.err = 'dnr-rule: ' + ((e && e.message) || 'failed'); return; }
  sseAbort = new AbortController();
  const parser = self.NF.createSSEStreamParser((ev) => {
    if (sseEvents.length < SSE_MAX_EVENTS) sseEvents.push(ev);
  });
  (async () => {
    try {
      const res = await fetch(SSE_URL, { credentials: 'omit', signal: sseAbort.signal });
      sseStreamDiag.started = true;
      sseStreamDiag.status  = res.status;
      if (!res.ok || !res.body) { sseStreamDiag.err = 'http-' + res.status; return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let sniffed = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = dec.decode(value, { stream: true });
        // Origin rejected / not behind the filter → the server sends an
        // error frame instead of the stream. Give up quietly; fall back.
        if (!sniffed) {
          sniffed = true;
          sseStreamDiag.first = text.slice(0, 120);
          if (text.includes('some-error')) {
            sseStreamDiag.rejected = true;
            sseStreamDiag.err = 'origin-rejected';
            sseEvents = [];
            return;
          }
        }
        parser.push(text);
      }
    } catch (e) {
      // AbortError is the normal stop path, not a failure.
      if (e && e.name !== 'AbortError') sseStreamDiag.err = (e && e.message) || 'stream-error';
    }
    finally { parser.flush(); }
  })();
}

function stopSSE() {
  if (sseAbort) { try { sseAbort.abort(); } catch { /* ok */ } sseAbort = null; }
}

// Build + upload the real-stream recording. Returns a view URL, or null if
// nothing usable was captured (→ background falls back to reconstruction).
async function buildAndUploadSSE() {
  const diag = {
    at: Date.now(), stream: sseStreamDiag,
    events: sseEvents.length, rows: 0, bytes: 0,
    status: 0, ok: false, url: null, error: null,
  };
  try {
    if (!self.NF)          { diag.error = 'no-module';  return null; }
    if (!sseEvents.length) { diag.error = 'no-events';  return null; }
    const rec = self.NF.buildRecordingFromEvents(sseEvents);
    diag.rows = rec.length;
    if (!rec.length)       { diag.error = 'no-rows';    return null; }
    const body = JSON.stringify(rec);
    diag.bytes = body.length;
    const res = await fetch(NF_SAVE_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'text/plain' },
      body,
    });
    diag.status = res.status;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    // Not JSON → logged out (HTML login page); !ok → rejected (e.g. payload too big).
    if (!res.ok)             { diag.error = 'http-' + res.status;  return null; }
    if (!ct.includes('json')) { diag.error = 'not-authenticated';   return null; }
    const j = await res.json();
    if (!j || !j.key)        { diag.error = 'no-key';               return null; }
    diag.ok  = true;
    diag.url = NF_VIEW_PREFIX + j.key;
    return diag.url;
  } catch (e) {
    diag.error = (e && e.message) || 'exception';
    return null;
  } finally {
    sseEvents = [];
    try { chrome.storage.local.set({ nfSseDiag: diag }); } catch { /* ok */ }
  }
}

function toBackground(msg) {
  try { chrome.runtime.sendMessage({ target: 'background', ...msg }); } catch { /* SW asleep; it wakes */ }
}
// Terminal outcomes go over TWO channels — the runtime message AND a
// storage.local write — so a lost message (SW restart mid-upload) can't
// strand the flow. The background clears the key once handled.
function reportOutcome(msg) {
  toBackground(msg);
  try { chrome.storage.local.set({ screenRecUpload: { ...msg, ts: Date.now() } }); } catch { /* message path remains */ }
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=avc1,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* keep trying */ }
  }
  return '';
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let lang = 'en';
const TXT = {
  he: {
    pickHead: 'בחר מה להקליט',
    pickHint: 'בחר מסך, חלון או לשונית בחלון שנפתח. חלון קטן זה ייעלם אוטומטית ברגע שההקלטה תתחיל.',
    recording: 'מקליט מסך',
    uploading: 'מעלה הקלטה…',
    stop: 'עצור ושלח',
    foot: 'אפשר לעצור גם דרך הכפתור הצף בעמוד או שורת "הפסק שיתוף" של הדפדפן.',
  },
  en: {
    pickHead: 'Choose what to record',
    pickHint: 'Pick a screen, window, or tab in the dialog that just opened. This little window tucks away automatically once recording begins.',
    recording: 'Recording screen',
    uploading: 'Uploading recording…',
    stop: 'Stop & send',
    foot: 'You can also stop from the floating button on the page, or the browser’s “Stop sharing” bar.',
  },
};

function setLang(l) {
  lang = l === 'he' ? 'he' : 'en';
  const t = TXT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'he' ? 'rtl' : 'ltr';
  $('pickHead').textContent = t.pickHead;
  $('pickHint').textContent = t.pickHint;
  $('stop').textContent = t.stop;
  $('foot').textContent = t.foot;
  if (!stopping && !document.body.classList.contains('uploading')) $('title').textContent = t.recording;
}

// ── Pick a source, then record it ──────────────────────────────────────
async function begin() {
  // GUARD: this page auto-runs begin() on every load. If the extension is
  // reloaded while a recorder window is still open, that window reloads and
  // would re-launch the capture picker (or a fresh recording) out of nowhere —
  // the "why did it start recording by itself?" bug. Only proceed if the
  // background is actually waiting for a source pick (status 'picking'); any
  // other state means we're an orphan, so close silently.
  try {
    const res = await chrome.runtime.sendMessage({ type: 'SCREEN_RECORD_STATUS' });
    if (!res || !res.state || res.state.status !== 'picking') { window.close(); return; }
  } catch {
    // Background unreachable (extension reloading) → we can't be a legit new
    // recorder; don't pop a picker.
    window.close();
    return;
  }

  let picked;
  try {
    picked = await new Promise((resolve) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab', 'audio'],
        (streamId, options) => resolve({ streamId, options, err: chrome.runtime.lastError && chrome.runtime.lastError.message }),
      );
    });
  } catch (e) {
    picked = { streamId: '', err: (e && e.message) || 'picker-threw' };
  }

  if (!picked.streamId) {
    // Cancelled (no err) or the picker failed (err). Either way this window's
    // job is done; the background resets state and a picker failure is shown.
    toBackground({ type: 'RECORDER_CANCELLED', err: picked.err || '' });
    window.close();
    return;
  }

  const withAudio = !!(picked.options && picked.options.canRequestAudioTrack);
  try {
    await startCapture(picked.streamId, withAudio);
    toBackground({ type: 'RECORDER_STARTED' });   // → background starts traffic capture
  } catch (e) {
    reportOutcome({ type: 'RECORDER_ERROR', error: (e && e.message) || 'getusermedia-failed', phase: 'start' });
    window.close();
  }
}

async function startCapture(streamId, withAudio) {
  failed = false;
  const video = {
    mandatory: {
      chromeMediaSource:   'desktop',
      chromeMediaSourceId: streamId,
      maxWidth:  1920,
      maxHeight: 1080,
      maxFrameRate: 15,
    },
  };
  const audio = withAudio
    ? { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId } }
    : false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch (e) {
    // Audio offered but not actually shareable → retry video-only.
    if (audio) stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    else throw e;
  }

  activeMime = pickMimeType();
  const opts = { videoBitsPerSecond: 1_500_000 };
  if (activeMime) opts.mimeType = activeMime;
  recorder = new MediaRecorder(stream, opts);
  chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop  = onRecorderStop;
  recorder.onerror = () => finishWithError('recorder-error');

  // Clicking Chrome's own "Stop sharing" bar ends the track — treat it as a
  // Stop so the user never has to return to this window to finish.
  stream.getVideoTracks().forEach((tr) => tr.addEventListener('ended', () => stop()));

  recorder.start(1000);   // flush a chunk every second so nothing is lost
  startedAt = Date.now();
  startSSE();              // read NetFree's own stream alongside the video
  document.body.classList.add('recording');   // swap the pick panel → live state
  $('stop').disabled = false;
  const tick = () => { if ($('time')) $('time').textContent = fmt(Date.now() - startedAt); };
  tick();
  tickTimer = setInterval(tick, 1000);
}

function stop() {
  if (stopping) return;
  stopping = true;
  stopSSE();               // stop reading the stream; keep what we captured
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  document.body.classList.remove('recording');
  document.body.classList.add('uploading');
  $('stop').disabled = true;
  $('title').textContent = TXT[lang].uploading;
  $('time').textContent = '';
  toBackground({ type: 'RECORDER_STOPPING' });   // → background: status 'uploading' + watchdog
  if (recorder && recorder.state !== 'inactive') {
    try { recorder.stop(); } catch { finishWithError('stop-failed'); }
  } else {
    onRecorderStop();
  }
}

async function onRecorderStop() {
  if (failed) return;
  try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* already gone */ }

  const type = activeMime ? activeMime.split(';')[0] : 'video/webm';
  const blob = new Blob(chunks, { type });
  chunks = [];
  if (!blob.size) { finishWithError('empty-recording', 'upload'); return; }

  try {
    // Build + upload the real-stream (SSE) recording first, so its view URL
    // rides in the same RECORDER_DONE. null → not behind the filter / stream
    // unavailable → the background reconstructs from chrome.webRequest instead.
    const trafficUrl = await buildAndUploadSSE();
    const filekey = await uploadRecording(blob);
    reportOutcome({ type: 'RECORDER_DONE', filekey, bytes: blob.size, trafficUrl: trafficUrl || null });
  } catch (e) {
    finishWithError((e && e.message) || 'upload-failed', 'upload');
    return;
  } finally {
    recorder = null;
    stream   = null;
    removeOriginRule();
  }
  // Background opens the ticket; this window's work is done.
  window.close();
}

function finishWithError(message, phase = 'record') {
  if (failed) return;
  failed = true;
  stopSSE();
  try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* ok */ }
  recorder = null;
  stream   = null;
  removeOriginRule();
  reportOutcome({ type: 'RECORDER_ERROR', error: message, phase });
  window.close();
}

// Upload in NetFree's own shape. credentials:'include' carries the
// netfree.session cookie (host permission lets an extension page send it),
// so the shipped extension uses the user's real login with no cookie code.
// Don't set Content-Type by hand — the browser writes the multipart boundary.
async function uploadRecording(blob) {
  const form = new FormData();
  const ext  = blob.type.includes('webm') ? 'webm' : 'video';
  form.append('file', blob, `netfree-inspector-recording.${ext}`);

  const res = await fetch(UPLOAD_URL, { method: 'POST', credentials: 'include', body: form });
  if (!res.ok) throw new Error(`http-${res.status}`);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('json')) throw new Error('not-authenticated');   // logged-out → HTML login page
  const json = await res.json();
  if (!json || !json.filekey) throw new Error('no-filekey');
  return json.filekey;
}

// Stop can be triggered from the popup, the on-page floating pill, or here.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'SCREEN_RECORD_STOP') stop();
});
$('stop').addEventListener('click', stop);

// If the user closes this window mid-recording (before a Stop), the capture
// is lost — tell the background so it doesn't wait on a result that's not
// coming. A normal stop sets `stopping`/`failed` first, so this no-ops then.
window.addEventListener('beforeunload', () => {
  if (stopping || failed) return;
  if (recorder) toBackground({ type: 'RECORDER_ABORTED' });
});

// Language for the labels (mirrors the popup's stored choice).
chrome.storage.local.get('lang').then((r) => setLang(r.lang === 'he' ? 'he' : 'en')).catch(() => setLang('en'));

begin();
