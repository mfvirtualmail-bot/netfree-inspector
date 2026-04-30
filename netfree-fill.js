// NetFree Inspector — content script injected into netfree.link.
// Auto-fills the ticket form's "Topic" and "Request content" fields
// from chrome.storage.session.pendingTicket (set by the popup).

(() => {
  const STORAGE_KEY = 'pendingTicket';
  const MAX_WAIT_MS = 30000;

  function isTicketRoute() {
    return /#\/tickets\/new/.test(location.hash || location.href);
  }

  async function readPending() {
    try {
      const res = await chrome.storage.session.get([STORAGE_KEY]);
      return res?.[STORAGE_KEY] ?? null;
    } catch {
      return null;
    }
  }

  async function clearPending() {
    try { await chrome.storage.session.remove(STORAGE_KEY); } catch {}
  }

  // Set an <input>/<textarea> value in a way Angular's ngModel observer
  // will react to: use the prototype's native setter, then dispatch
  // the 'input' event (and 'change' as a safety net).
  function setFieldValue(el, value) {
    if (!el || typeof value !== 'string') return false;
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function tryFill() {
    if (!isTicketRoute()) return false;
    const pending = await readPending();
    if (!pending || (!pending.subject && !pending.body)) return false;

    const title   = document.querySelector('input[name="title"]');
    const content = document.querySelector('textarea[name="content"]');
    if (!title && !content) return false;

    let filled = false;
    if (title   && pending.subject) filled = setFieldValue(title,   pending.subject) || filled;
    if (content && pending.body)    filled = setFieldValue(content, pending.body)    || filled;

    if (filled) {
      // One-shot: don't re-fill if the user navigates back later.
      await clearPending();
    }
    return filled;
  }

  // Run once immediately, then keep watching the DOM until the form
  // mounts (Angular renders async). Stop after MAX_WAIT_MS as a safety net.
  let stopped = false;
  function start() {
    if (stopped) return;
    tryFill().then(done => {
      if (done) { stopped = true; return; }
      const obs = new MutationObserver(async () => {
        const ok = await tryFill();
        if (ok) { obs.disconnect(); stopped = true; }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); stopped = true; }, MAX_WAIT_MS);
    });
  }

  start();

  // Re-run on SPA hash navigations too (e.g. user clicks "New Request"
  // from inside the SPA after we've already disconnected).
  window.addEventListener('hashchange', () => {
    stopped = false;
    start();
  });
})();
