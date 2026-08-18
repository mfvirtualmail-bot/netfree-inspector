// NetFree Inspector — floating TRAFFIC-recording control.
//
// While an interactive traffic recording runs, the user needs to USE the page
// (click a button, play the video they're reporting) with a visible, always-on-
// top way to stop — the popup closes the instant they click the page. This
// content script shows a small draggable pill on the recording tab:
//   recording → red pill with a live timer + "Stop & send" button
//   uploading → amber pill ("Uploading recording…")
//   finished  → green/red flash with the outcome, then disappears
//
// It is a deliberate, standalone sibling of rec-overlay.js (the screen-record
// pill) — NOT a shared edit — so the proven screen-recording flow can't break.
// Driven purely by chrome.storage.local `trafficRec` / `trafficRecResult`
// (written by the service worker), injected via chrome.scripting when a
// recording starts and re-injected after in-tab navigation.
//
// Styling is CSSOM inside a shadow root — no <style> tags, so strict page CSPs
// can't break it and page CSS can't restyle it.

(() => {
  if (window !== window.top) return;
  if (window.__nfTrafficOverlayLoaded) return;
  window.__nfTrafficOverlayLoaded = true;

  const T = {
    he: {
      recording: 'מקליט תעבורה',
      hint:      'השתמשו בדף כרגיל, ואז לחצו',
      stop:      'עצור ושלח בקשה',
      uploading: 'מעלה הקלטה…',
      done:      '✓ ההקלטה מוכנה — טופס הבקשה נפתח',
      failed:    'העלאת ההקלטה נכשלה',
      notAuth:   'יש להתחבר כדי להעלות הקלטה',
    },
    en: {
      recording: 'Recording traffic',
      hint:      'Use the page normally, then click',
      stop:      'Stop & send request',
      uploading: 'Uploading recording…',
      done:      '✓ Recording ready — request form opened',
      failed:    'Recording upload failed',
      notAuth:   'Log in to upload the recording',
    },
  };

  const css = (el, props) => Object.assign(el.style, props);

  let lang       = 'he';
  let hostEl     = null;
  let pill       = null;
  let dotEl      = null;
  let textEl     = null;
  let stopBtn    = null;
  let tickTimer  = null;
  let hideTimer  = null;
  let pulseTimer = null;
  let shownResultTs = 0;
  let savedPos   = null;

  function fmtElapsed(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function ensurePill() {
    if (hostEl && hostEl.isConnected) return;
    if (hostEl && !hostEl.isConnected) removePill();
    hostEl = document.createElement('div');
    hostEl.id = 'netfree-inspector-traffic-overlay';
    const shadow = hostEl.attachShadow({ mode: 'open' });

    pill = document.createElement('div');
    pill.setAttribute('role', 'status');
    css(pill, {
      position:     'fixed',
      zIndex:       '2147483647',
      display:      'flex',
      alignItems:   'center',
      gap:          '11px',
      padding:      '12px 18px',
      borderRadius: '999px',
      background:   '#DC2626',
      color:        '#FFFFFF',
      font:         '600 15px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif',
      boxShadow:    '0 6px 22px rgba(0,0,0,.4)',
      cursor:       'move',
      userSelect:   'none',
      touchAction:  'none',
      whiteSpace:   'nowrap',
      direction:    lang === 'he' ? 'rtl' : 'ltr',
    });

    dotEl = document.createElement('span');
    css(dotEl, { width: '13px', height: '13px', borderRadius: '50%', background: '#FFFFFF', flexShrink: '0' });

    textEl = document.createElement('span');

    stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    css(stopBtn, {
      border:       'none',
      borderRadius: '999px',
      padding:      '8px 16px',
      background:   '#FFFFFF',
      color:        '#B91C1C',
      font:         '700 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif',
      cursor:       'pointer',
      flexShrink:   '0',
    });
    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopBtn.disabled = true;
      try { chrome.runtime.sendMessage({ type: 'TRAFFIC_RECORD_STOP' }); } catch { /* extension reloaded */ }
    });

    pill.append(dotEl, textEl, stopBtn);
    shadow.appendChild(pill);
    (document.body || document.documentElement).appendChild(hostEl);

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

  function applyPosition() {
    if (!pill) return;
    requestAnimationFrame(() => {
      if (!pill) return;
      const w = pill.offsetWidth  || 240;
      const h = pill.offsetHeight || 40;
      let left, top;
      if (savedPos && typeof savedPos.left === 'number') { left = savedPos.left; top = savedPos.top; }
      else { left = window.innerWidth - w - 24; top = window.innerHeight - h - 24; }
      left = Math.min(Math.max(8, left), window.innerWidth  - w - 8);
      top  = Math.min(Math.max(8, top),  window.innerHeight - h - 8);
      css(pill, { left: `${left}px`, top: `${top}px` });
    });
  }

  function installDrag() {
    let startX = 0, startY = 0, origL = 0, origT = 0, moved = false;
    pill.addEventListener('pointerdown', (e) => {
      if (e.target === stopBtn) return;
      moved = false; startX = e.clientX; startY = e.clientY;
      const r = pill.getBoundingClientRect(); origL = r.left; origT = r.top;
      pill.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
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
          try { chrome.storage.local.set({ trafficRecOverlayPos: savedPos }); } catch { /* ok */ }
        }
      };
      pill.addEventListener('pointermove', onMove);
      pill.addEventListener('pointerup', onUp);
      pill.addEventListener('pointercancel', onUp);
    });
    window.addEventListener('resize', applyPosition);
  }

  function render(state, result) {
    const t = T[lang];
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

    // Idle. Flash a fresh outcome once, then remove.
    if (result && result.ts && result.ts !== shownResultTs && (Date.now() - result.ts) < 30000) {
      shownResultTs = result.ts;
      ensurePill();
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      stopBtn.style.display = 'none';
      if (result.ok) { css(pill, { background: '#15803D' }); textEl.textContent = t.done; }
      else {
        css(pill, { background: '#7F1D1D' });
        textEl.textContent = result.error === 'not-authenticated' ? t.notAuth : t.failed;
      }
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(removePill, result.ok ? 6000 : 9000);
      return;
    }

    if (!hideTimer) removePill();
  }

  async function refresh() {
    let r;
    try { r = await chrome.storage.local.get(['trafficRec', 'trafficRecResult', 'trafficRecOverlayPos', 'lang']); }
    catch { return; }
    if (r.lang === 'he' || r.lang === 'en') lang = r.lang;
    if (r.trafficRecOverlayPos) savedPos = r.trafficRecOverlayPos;
    if (r.trafficRecResult && r.trafficRecResult.ts && (Date.now() - r.trafficRecResult.ts) > 30000) {
      shownResultTs = r.trafficRecResult.ts;
    }
    render(r.trafficRec || null, r.trafficRecResult || null);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.trafficRec || changes.trafficRecResult || changes.lang) refresh();
      if (changes.trafficRecOverlayPos && changes.trafficRecOverlayPos.newValue) {
        savedPos = changes.trafficRecOverlayPos.newValue;
      }
    });
  } catch { /* extension context gone */ }

  refresh();
})();
