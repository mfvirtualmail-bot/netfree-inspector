// NetFree Inspector — standalone in-browser test for the v1.8 SSE recorder.
// De-risks the ONE thing that can't be tested from a shell: whether the
// extension can set the required Origin header on its own fetch via
// declarativeNetRequest, and read the resulting stream from a page context.
//
// Load at chrome-extension://<id>/sse-test.html (behind the NetFree filter).

const SSE_URL   = 'https://eeapi.internal.netfree.link/traffic/sse';
const SAVE_URL  = 'https://netfree.link/api/user/save-traffic-record';
const VIEW_PFX  = 'https://netfree.link/app/#/tools/traffic/view/';
const RULE_ID   = 9101;
const STREAM_MS = 8000;

const logEl = document.getElementById('log');
const verdictEl = document.getElementById('verdict');
const log = (m) => { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; };
const setVerdict = (txt, cls) => { verdictEl.textContent = txt; verdictEl.className = cls; };

// Install a session DNR rule that sets Origin: https://netfree.link/ on every
// request to the stream host. fetch() can't set Origin; the server rejects
// anything but this exact value. declarativeNetRequestWithHostAccess is enough
// (modifyHeaders is a host-access rule) — we already hold <all_urls>.
async function installOriginRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'origin', operation: 'set', value: 'https://netfree.link/' }],
      },
      condition: {
        requestDomains: ['eeapi.internal.netfree.link'],
        resourceTypes: ['xmlhttprequest', 'other'],
      },
    }],
  });
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  log(`DNR: session rule installed (${rules.filter(r => r.id === RULE_ID).length === 1 ? 'ok' : 'MISSING'})`);
}

async function removeOriginRule() {
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] }); } catch { /* ok */ }
}

async function streamFor(ms) {
  const events = [];
  let firstChunkSeen = false;
  const parser = self.NF.createSSEStreamParser((ev) => events.push(ev));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  let raw = '';
  try {
    const res = await fetch(SSE_URL, { credentials: 'omit', signal: ctrl.signal });
    log(`fetch: HTTP ${res.status} ${res.headers.get('content-type') || ''}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = dec.decode(value, { stream: true });
      if (!firstChunkSeen) {
        firstChunkSeen = true;
        raw = text.slice(0, 200);
        log(`first bytes: ${raw.replace(/\n/g, '\\n').slice(0, 160)}`);
      }
      parser.push(text);
    }
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  } finally {
    clearTimeout(timer);
    parser.flush();
  }
  return { events, raw };
}

async function run(doUpload) {
  logEl.textContent = '';
  setVerdict('running…', 'wait');
  document.getElementById('run').disabled = true;
  document.getElementById('streamOnly').disabled = true;
  try {
    log(`Origin rule → ${SSE_URL}`);
    await installOriginRule();
    log(`streaming ${STREAM_MS / 1000}s (generate some browsing in other tabs to fill it)…`);
    const { events, raw } = await streamFor(STREAM_MS);

    // Detect the rejection shape: server answers {"error":"some-error"} when
    // Origin is wrong/absent (i.e. the DNR rule didn't take effect).
    if (raw.includes('some-error') || (events.length === 0 && raw.includes('error'))) {
      setVerdict('❌ FAIL — Origin header not accepted (DNR did not set it)', 'bad');
      log('The server returned an error frame → the Origin rewrite is not reaching the wire.');
      return;
    }
    const identity = events.filter(e => String(e.action || '').startsWith('user::')).length;
    const rec = self.NF.buildRecordingFromEvents(events);
    log(`events: ${events.length}   grouped rows: ${rec.length}   identity(user::) rows: ${identity}`);

    if (events.length === 0) {
      setVerdict('⚠️ No events — behind the filter? any traffic during the window?', 'wait');
      return;
    }
    if (!identity) {
      setVerdict('⚠️ Streamed, but no user:: rows — unexpected; check the log', 'wait');
    } else {
      setVerdict('✅ PASS — real NetFree stream captured via the extension', 'ok');
    }

    if (doUpload && rec.length) {
      log('uploading built recording to NetFree…');
      const res = await fetch(SAVE_URL, {
        method: 'PUT', credentials: 'include',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(rec),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok || !ct.includes('json')) { log(`upload failed: HTTP ${res.status} (logged in to netfree.link?)`); return; }
      const j = await res.json();
      if (j && j.key) {
        const url = VIEW_PFX + j.key;
        log('VIEW: ' + url);
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.textContent = 'Open the recording ↗';
        verdictEl.appendChild(document.createElement('br'));
        verdictEl.appendChild(a);
      }
    }
  } catch (e) {
    setVerdict('❌ error: ' + (e && e.message || e), 'bad');
    log('exception: ' + (e && e.stack || e));
  } finally {
    await removeOriginRule();
    log('DNR: session rule removed.');
    document.getElementById('run').disabled = false;
    document.getElementById('streamOnly').disabled = false;
  }
}

document.getElementById('run').addEventListener('click', () => run(true));
document.getElementById('streamOnly').addEventListener('click', () => run(false));

// Diagnostics from the last REAL recording (the recorder window writes these
// before it closes, so this is the only way to see why a recording did or
// didn't use NetFree's own stream).
document.getElementById('diag').addEventListener('click', async () => {
  logEl.textContent = '';
  const r = await chrome.storage.local.get('nfSseDiag');
  const d = r.nfSseDiag;
  if (!d) {
    setVerdict('no diagnostics yet — make a screen recording first', 'wait');
    log('storage.local.nfSseDiag is empty. Record once via the extension popup, then come back.');
    return;
  }
  const when = new Date(d.at).toLocaleString();
  setVerdict(d.ok ? '✅ last recording USED the real stream' : '⚠️ last recording fell back to reconstruction', d.ok ? 'ok' : 'wait');
  log(`when            : ${when}`);
  log(`stream started  : ${d.stream && d.stream.started}`);
  log(`DNR rule set    : ${d.stream && d.stream.ruleOk}`);
  log(`http status     : ${d.stream && d.stream.status}`);
  log(`origin rejected : ${d.stream && d.stream.rejected}`);
  log(`stream error    : ${(d.stream && d.stream.err) || 'none'}`);
  log(`first bytes     : ${((d.stream && d.stream.first) || '').replace(/\n/g, '\\n')}`);
  log(`events captured : ${d.events}`);
  log(`rows built      : ${d.rows}`);
  log(`payload bytes   : ${d.bytes}`);
  log(`upload status   : ${d.status}`);
  log(`upload error    : ${d.error || 'none'}`);
  if (d.url) {
    log(`VIEW: ${d.url}`);
    const a = document.createElement('a');
    a.href = d.url; a.target = '_blank'; a.textContent = 'Open that recording ↗';
    verdictEl.appendChild(document.createElement('br'));
    verdictEl.appendChild(a);
  }
});
