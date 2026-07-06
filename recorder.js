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
  document.body.classList.add('recording');   // swap the pick panel → live state
  $('stop').disabled = false;
  const tick = () => { if ($('time')) $('time').textContent = fmt(Date.now() - startedAt); };
  tick();
  tickTimer = setInterval(tick, 1000);
}

function stop() {
  if (stopping) return;
  stopping = true;
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
    const filekey = await uploadRecording(blob);
    reportOutcome({ type: 'RECORDER_DONE', filekey, bytes: blob.size });
  } catch (e) {
    finishWithError((e && e.message) || 'upload-failed', 'upload');
    return;
  } finally {
    recorder = null;
    stream   = null;
  }
  // Background opens the ticket; this window's work is done.
  window.close();
}

function finishWithError(message, phase = 'record') {
  if (failed) return;
  failed = true;
  try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* ok */ }
  recorder = null;
  stream   = null;
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
