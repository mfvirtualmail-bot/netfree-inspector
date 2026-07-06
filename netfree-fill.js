// NetFree Inspector — content script injected into netfree.link.
// Auto-fills the ticket form's "Topic" and "Request content" fields
// from chrome.storage.local.pendingTicket (set by the popup).
//
// Why chrome.storage.local and not .session?
// chrome.storage.session defaults to TRUSTED_CONTEXTS access — content
// scripts are "untrusted" so they can't read it without an explicit
// setAccessLevel call. .local is accessible to content scripts by default.

(() => {
  const STORAGE_KEY  = 'pendingTicket';
  const MAX_WAIT_MS  = 30000;
  const RETRY_MS     = 200;
  const STALE_MS     = 10 * 60 * 1000;  // a ticket older than this is dead
  const LOG          = (...a) => console.log('[NetFree Inspector]', ...a);

  function isTicketRoute() {
    return /#\/tickets\/new/.test(location.hash || location.href);
  }

  async function readPending() {
    try {
      const res = await chrome.storage.local.get([STORAGE_KEY]);
      const p = res?.[STORAGE_KEY] ?? null;
      // A ticket that was stashed but never filled — e.g. the upload flow
      // opened the form but NetFree bounced to #/login — would otherwise
      // sit in storage.local across restarts and silently autofill an
      // unrelated ticket the user opens days later. Expire it.
      if (p && p.ts && (Date.now() - p.ts) > STALE_MS) {
        await clearPending();
        return null;
      }
      return p;
    } catch (e) {
      LOG('readPending error:', e);
      return null;
    }
  }

  async function clearPending() {
    try { await chrome.storage.local.remove(STORAGE_KEY); } catch {}
  }

  // Detect Hebrew (or Arabic) characters in a string. NetFree's
  // ticket textarea defaults to LTR, so Hebrew content ends up with
  // punctuation on the wrong side and mixed Hebrew/Latin runs look
  // scrambled. When the content is RTL, force the element direction.
  const RTL_RE = /[֐-׿؀-ۿ܀-ݏיִ-ﻼ]/;
  function applyDirection(el, value) {
    if (!el || typeof value !== 'string') return;
    if (RTL_RE.test(value)) {
      el.setAttribute('dir', 'rtl');
      el.style.direction = 'rtl';
      el.style.textAlign = 'right';
    }
  }

  // Set an <input>/<textarea> value the way Angular's ngModel observer
  // will react to: focus → use the prototype's native setter →
  // dispatch input + change → blur. The native setter is required
  // because some frameworks override the property setter on the
  // element instance.
  function setFieldValue(el, value) {
    if (!el || typeof value !== 'string') return false;
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    try { el.focus(); } catch {}
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try { el.blur(); } catch {}
    applyDirection(el, value);
    return el.value === value;
  }

  let pendingCache = null;     // remember in-memory across retries
  let storageCleared = false;  // only clear chrome.storage.local once
  let verifiedOnce = false;    // both fields have held the value at least once

  async function getPending() {
    if (pendingCache) return pendingCache;
    pendingCache = await readPending();
    return pendingCache;
  }

  async function tryFill() {
    if (!isTicketRoute()) return { mounted: false, filled: false };
    const pending = await getPending();
    if (!pending || (!pending.subject && !pending.body)) {
      return { mounted: false, filled: false };
    }

    const title   = document.querySelector('input[name="title"]');
    const content = document.querySelector('textarea[name="content"]');
    if (!title && !content) return { mounted: false, filled: false };

    // Before the first successful fill, write whenever the field doesn't
    // match. AFTER it (verifiedOnce), only rewrite a field that Angular has
    // reset to empty — otherwise the retry loop would clobber edits the
    // user makes to the pre-filled text (they usually add a sentence).
    const needsWrite = (el, want) =>
      verifiedOnce ? el.value === '' : el.value !== want;

    let filled = false;
    if (title && pending.subject && needsWrite(title, pending.subject)) {
      filled = setFieldValue(title, pending.subject) || filled;
    }
    if (content && pending.body && needsWrite(content, pending.body)) {
      filled = setFieldValue(content, pending.body) || filled;
    }

    // Once both fields hold the expected value, retire the storage entry.
    const titleOk   = !title   || !pending.subject || title.value   === pending.subject;
    const contentOk = !content || !pending.body    || content.value === pending.body;
    if (titleOk && contentOk) {
      verifiedOnce = true;
      if (!storageCleared) {
        await clearPending();
        storageCleared = true;
        LOG('filled subject + body OK');
      }
    }

    return { mounted: !!(title || content), filled };
  }

  // Keep retrying every RETRY_MS for up to MAX_WAIT_MS. Even after a
  // successful first fill we keep watching: Angular's form initialisation
  // sometimes fires AFTER document_idle and resets ngModel-bound inputs
  // back to '', so we need to refill if that happens.
  let stopAt = 0;
  let timer  = null;

  function startLoop() {
    stopAt = Date.now() + MAX_WAIT_MS;
    if (timer) clearInterval(timer);
    LOG('content script active on', location.href);
    timer = setInterval(async () => {
      if (Date.now() > stopAt) {
        clearInterval(timer); timer = null; return;
      }
      const pending = await getPending();
      if (!pending) { clearInterval(timer); timer = null; return; }
      await tryFill();
    }, RETRY_MS);
    // Fire one immediately too
    tryFill().catch(() => {});
  }

  // ── Block-page code reader ───────────────────────────────────────────
  // When a request is blocked, the browser renders NetFree's block page
  // (netfree.link/block/) inside the blocked origin — usually as an iframe,
  // which is why this content script runs in all_frames. Its URL fragment
  // holds the authoritative reason, e.g.
  //     #{"block":"deny","page_info":{"url":"https:%2F%2F…"}}
  // Reading it straight from the hash (exactly what NetFree's own block
  // page does) is the most reliable code source for any block that renders
  // a page — no re-fetch, no Sec-Fetch ambiguity. Sub-resource blocks
  // (media/ping/xhr) don't render a page; those still rely on the SW fetch.
  function reportBlockPageCode() {
    if (!/\/block\/?$/.test(location.pathname)) return;
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return;
    let json = null;
    try { json = JSON.parse(decodeURIComponent(raw)); }
    catch { try { json = JSON.parse(raw); } catch { return; } }
    if (!json || typeof json.block !== 'string') return;
    let url = json.page_info && json.page_info.url;
    if (url) { try { url = decodeURIComponent(url); } catch {} }
    try {
      chrome.runtime.sendMessage({ type: 'BLOCK_PAGE_CODE', url: url || '', code: json.block });
    } catch { /* SW asleep / context gone — re-fetch path still covers it */ }
  }
  reportBlockPageCode();

  startLoop();

  // Re-arm on SPA hash navigations (user re-opens the new-ticket page).
  window.addEventListener('hashchange', () => {
    pendingCache   = null;
    storageCleared = false;
    verifiedOnce   = false;
    startLoop();
  });
})();
