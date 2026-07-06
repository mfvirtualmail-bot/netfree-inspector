// NetFree Inspector — floating screen-recording control.
//
// While a screen recording runs, every page needs a visible, always-on-top
// way to stop it — the popup closes the moment the user clicks anywhere,
// and Chrome's own "Stop sharing" bar can be dismissed ("Hide"). This
// content script shows a small draggable pill on every http(s) page:
//   recording → red pill with a live timer + "Stop & send" button
//   uploading → amber pill ("Uploading recording…")
//   finished  → green/red flash with the outcome, then disappears
//
// The pill is only rendered while a recording session exists in
// chrome.storage.local (written by the service worker), so on 99.9% of
// page loads this script does one storage read and exits quietly.
//
// Limits: content scripts exist only inside Chrome pages. When the user
// switches to another desktop app, the way to stop is Chrome's native
// "Stop sharing" bar (also wired: stopping there uploads + opens the
// ticket) — or coming back to any Chrome tab and using this pill.
//
// Styling is done through CSSOM property assignment inside a shadow root —
// no <style> tags, so strict page CSPs can't break it and page CSS can't
// restyle it.

(() => {
  if (window !== window.top) return;
  // This runs both as a declarative content script AND via
  // chrome.scripting.executeScript when a recording starts (Edge/Chrome can
  // gate broad-match declarative injection, so the SW injects it too). Guard
  // against running twice in the same page — the flag lives in this isolated
  // world and survives re-injection.
  if (window.__nfRecOverlayLoaded) return;
  window.__nfRecOverlayLoaded = true;

  const T = {
    he: {
      recording: 'מקליט מסך',
      stop:      'עצור ושלח',
      uploading: 'מעלה הקלטה…',
      done:      '✓ ההקלטה הועלתה — טופס הבקשה נפתח',
      partial:   'טופס הבקשה נפתח — אך העלאת הווידאו נכשלה',
      failed:    'העלאת ההקלטה נכשלה',
      notAuth:   'יש להתחבר ל-NetFree כדי להעלות הקלטה',
      dragHint:  'אפשר לגרור את הכפתור לכל מקום',
    },
    en: {
      recording: 'Recording screen',
      stop:      'Stop & send',
      uploading: 'Uploading recording…',
      done:      '✓ Recording uploaded — request form opened',
      partial:   'Request form opened — but the video upload failed',
      failed:    'Recording upload failed',
      notAuth:   'Log in to NetFree to upload the recording',
      dragHint:  'Drag to move this button anywhere',
    },
  };

  const css = (el, props) => Object.assign(el.style, props);

  let lang        = 'he';
  let hostEl      = null;   // mount node in the page
  let pill        = null;   // the pill element inside the shadow root
  let dotEl       = null;
  let textEl      = null;
  let stopBtn     = null;
  let tickTimer   = null;
  let hideTimer   = null;
  let pulseTimer  = null;
  let shownResultTs = 0;    // result timestamps already flashed
  let savedPos    = null;   // { left, top } persisted across pages

  function fmtElapsed(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function ensurePill() {
    // Re-create if a page script detached our host node (some SPAs/consent
    // walls rewrite document.body, silently removing the pill).
    if (hostEl && hostEl.isConnected) return;
    if (hostEl && !hostEl.isConnected) removePill();
    hostEl = document.createElement('div');
    hostEl.id = 'netfree-inspector-rec-overlay';
    const shadow = hostEl.attachShadow({ mode: 'open' });

    pill = document.createElement('div');
    pill.setAttribute('role', 'status');
    pill.title = T[lang].dragHint;
    css(pill, {
      position:      'fixed',
      zIndex:        '2147483647',
      display:       'flex',
      alignItems:    'center',
      gap:           '9px',
      padding:       '9px 14px',
      borderRadius:  '999px',
      background:    '#DC2626',
      color:         '#FFFFFF',
      font:          '600 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif',
      boxShadow:     '0 4px 18px rgba(0,0,0,.35)',
      cursor:        'move',
      userSelect:    'none',
      touchAction:   'none',
      whiteSpace:    'nowrap',
      direction:     lang === 'he' ? 'rtl' : 'ltr',
    });

    dotEl = document.createElement('span');
    css(dotEl, {
      width:        '10px',
      height:       '10px',
      borderRadius: '50%',
      background:   '#FFFFFF',
      flexShrink:   '0',
    });

    textEl = document.createElement('span');

    stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    css(stopBtn, {
      border:       'none',
      borderRadius: '999px',
      padding:      '5px 12px',
      background:   '#FFFFFF',
      color:        '#B91C1C',
      font:         '700 12.5px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif',
      cursor:       'pointer',
      flexShrink:   '0',
    });
    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopBtn.disabled = true;
      try { chrome.runtime.sendMessage({ type: 'SCREEN_RECORD_STOP' }); } catch { /* extension reloaded */ }
    });

    pill.append(dotEl, textEl, stopBtn);
    shadow.appendChild(pill);
    (document.body || document.documentElement).appendChild(hostEl);

    // White dot pulse (CSSOM only — no keyframes available without <style>).
    // Doubles as a liveness check: if the extension was reloaded/updated,
    // this content script is orphaned — chrome.runtime.id goes undefined and
    // storage.onChanged stops firing, so the pill would otherwise tick
    // forever with a dead Stop button. Detect that and remove it.
    let visible = true;
    pulseTimer = setInterval(() => {
      if (!chrome.runtime || !chrome.runtime.id) { removePill(); return; }
      visible = !visible;
      if (dotEl) dotEl.style.opacity = visible ? '1' : '.25';
    }, 600);

    installDrag();
    applyPosition();
  }

  function removePill() {
    if (tickTimer)  { clearInterval(tickTimer);  tickTimer  = null; }
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
    if (hideTimer)  { clearTimeout(hideTimer);   hideTimer  = null; }
    if (hostEl) { hostEl.remove(); hostEl = null; pill = null; dotEl = null; textEl = null; stopBtn = null; }
  }

  // ── Position: default bottom-right, draggable anywhere, remembered ──
  function applyPosition() {
    if (!pill) return;
    requestAnimationFrame(() => {
      if (!pill) return;
      const w = pill.offsetWidth  || 220;
      const h = pill.offsetHeight || 40;
      let left, top;
      if (savedPos && typeof savedPos.left === 'number') {
        left = savedPos.left;
        top  = savedPos.top;
      } else {
        left = window.innerWidth  - w - 24;
        top  = window.innerHeight - h - 24;
      }
      left = Math.min(Math.max(8, left), window.innerWidth  - w - 8);
      top  = Math.min(Math.max(8, top),  window.innerHeight - h - 8);
      css(pill, { left: `${left}px`, top: `${top}px` });
    });
  }

  function installDrag() {
    let startX = 0, startY = 0, origL = 0, origT = 0, moved = false;
    pill.addEventListener('pointerdown', (e) => {
      if (e.target === stopBtn) return;      // button stays a plain click
      moved  = false;
      startX = e.clientX;
      startY = e.clientY;
      const r = pill.getBoundingClientRect();
      origL = r.left;
      origT = r.top;
      pill.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (!moved) return;
        const w = pill.offsetWidth, h = pill.offsetHeight;
        const left = Math.min(Math.max(8, origL + dx), window.innerWidth  - w - 8);
        const top  = Math.min(Math.max(8, origT + dy), window.innerHeight - h - 8);
        css(pill, { left: `${left}px`, top: `${top}px` });
      };
      const onUp = () => {
        pill.removeEventListener('pointermove', onMove);
        pill.removeEventListener('pointerup', onUp);
        pill.removeEventListener('pointercancel', onUp);
        if (moved) {
          const r2 = pill.getBoundingClientRect();
          savedPos = { left: r2.left, top: r2.top };
          try { chrome.storage.local.set({ screenRecOverlayPos: savedPos }); } catch { /* ok */ }
        }
      };
      pill.addEventListener('pointermove', onMove);
      pill.addEventListener('pointerup', onUp);
      pill.addEventListener('pointercancel', onUp);
    });
    window.addEventListener('resize', applyPosition);
  }

  // ── State → pill rendering ──
  function render(state, result) {
    const t      = T[lang];
    const status = state && state.status;

    if (status === 'recording') {
      ensurePill();
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      css(pill, { background: '#DC2626' });
      stopBtn.style.display = '';
      stopBtn.disabled = false;
      stopBtn.textContent = t.stop;
      const startedAt = state.startedAt || Date.now();
      const tick = () => { if (textEl) textEl.textContent = `${t.recording} · ${fmtElapsed(Date.now() - startedAt)}`; };
      tick();
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = setInterval(tick, 1000);
      return;
    }

    if (status === 'uploading') {
      ensurePill();
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      css(pill, { background: '#B45309' });
      stopBtn.style.display = 'none';
      textEl.textContent = t.uploading;
      return;
    }

    // Idle. Flash a fresh outcome once, then remove the pill.
    if (result && result.ts && result.ts !== shownResultTs && (Date.now() - result.ts) < 30000) {
      shownResultTs = result.ts;
      ensurePill();
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      stopBtn.style.display = 'none';
      const code = result.error && result.error !== 'error' ? ` [${result.error}]` : '';
      if (result.ok) {
        css(pill, { background: '#15803D' });
        textEl.textContent = t.done;
      } else if (result.partial) {
        // A request form DID open — only the video is missing.
        css(pill, { background: '#B45309' });
        textEl.textContent = t.partial + code;
      } else {
        css(pill, { background: '#7F1D1D' });
        textEl.textContent = result.error === 'not-authenticated' ? t.notAuth : t.failed + code;
      }
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(removePill, result.ok ? 6000 : 9000);
      return;
    }

    if (!hideTimer) removePill();   // let an outcome flash finish before removing
  }

  async function refresh() {
    let r;
    try {
      r = await chrome.storage.local.get(['screenRec', 'screenRecResult', 'screenRecOverlayPos', 'lang']);
    } catch { return; /* extension context gone */ }
    if (r.lang === 'he' || r.lang === 'en') lang = r.lang;
    if (r.screenRecOverlayPos) savedPos = r.screenRecOverlayPos;
    // A result older than the freshness window is history, not news — mark
    // it shown so a page load days later doesn't flash it.
    if (r.screenRecResult && r.screenRecResult.ts && (Date.now() - r.screenRecResult.ts) > 30000) {
      shownResultTs = r.screenRecResult.ts;
    }
    render(r.screenRec || null, r.screenRecResult || null);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.screenRec || changes.screenRecResult || changes.lang) refresh();
      if (changes.screenRecOverlayPos && changes.screenRecOverlayPos.newValue) {
        savedPos = changes.screenRecOverlayPos.newValue;   // moved on another tab
      }
    });
  } catch { /* extension context gone */ }

  refresh();
})();
