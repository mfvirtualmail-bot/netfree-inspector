// NetFree Inspector — Options page

const USER_CUSTOM_KEY  = 'harmlessUserList';
const REMOTE_CACHE_KEY = 'harmlessRemoteCache';
const LANG_KEY         = 'lang';

let lang = 'he';

// ── Dynamic strings (static labels use data-he/data-en in the HTML) ──
const STR = {
  refreshing: { he: 'מרענן…',           en: 'Refreshing…' },
  updated:    { he: '✓ עודכן',           en: '✓ Updated' },
  upToDate:   { he: '✓ הרשימה מעודכנת',  en: '✓ Up to date' },
  errBlocked: { he: '✗ לא ניתן להגיע לרשימה — העותק השמור עדיין פעיל', en: "✗ Can't reach it now — saved list still active" },
  errFailed:  { he: '✗ הרענון נכשל',     en: '✗ Refresh failed' },
  never:      { he: 'מעולם לא',           en: 'Never' },
  justNow:    { he: 'עכשיו',              en: 'just now' },
  badUrl:     { he: '✗ כתובת לא תקינה',   en: '✗ Not a valid address' },
  reqOpened:  { he: '✓ הבקשה נפתחה',      en: '✓ Request opened' },
  reviewSubject: { he: (host) => `בקשה לאתר - ${host}`,        en: (host) => `Website request — ${host}` },
  reviewBody:    { he: (url) => `שלום,\nהאתר הבא חשוב לי ואינו נפתח. אבקש לבדוק ולאשר אותו:\n${url}\n\nתודה רבה.`,
                   en: (url) => `Hello,\nThe following website is important to me and won't open. Please review and approve it:\n${url}\n\nThank you.` },
};
function T(k) { return STR[k]?.[lang] ?? k; }

function relTime(ts) {
  if (!ts) return T('never');
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1)  return T('justNow');
  if (min < 60) return lang === 'he' ? `לפני ${min} דק׳` : `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24)  return lang === 'he' ? `לפני ${hr} שע׳` : `${hr} h ago`;
  const d = Math.round(hr / 24);
  return lang === 'he' ? `לפני ${d} ימים` : `${d} d ago`;
}

// ── i18n ─────────────────────────────────────────────
function applyLang(newLang) {
  lang = newLang;
  const html = document.documentElement;
  html.lang  = lang;
  html.dir   = lang === 'he' ? 'rtl' : 'ltr';
  document.getElementById('langBtn').textContent = lang === 'he' ? 'EN' : 'עב';
  document.querySelectorAll('[data-he][data-en]').forEach(el => {
    // Only swap leaf text nodes (skip containers that hold child elements,
    // e.g. the refresh button which wraps a spinner + label).
    if (el.children.length === 0 || el.tagName === 'A') {
      el.textContent = el.dataset[lang];
    }
  });
  chrome.storage.local.set({ [LANG_KEY]: lang });
}

// ── Load / save user list ───────────────────────────
async function loadUserList() {
  const r = await chrome.storage.local.get(USER_CUSTOM_KEY);
  const list = r[USER_CUSTOM_KEY] ?? [];
  document.getElementById('userList').value = list.join('\n');
}

async function saveUserList() {
  const raw = document.getElementById('userList').value;
  const list = raw
    .split(/[\n,]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s && !s.startsWith('#') && /^[a-z0-9.-]+$/.test(s));
  const unique = Array.from(new Set(list));
  await chrome.storage.local.set({ [USER_CUSTOM_KEY]: unique });
  document.getElementById('userList').value = unique.join('\n');
  flashStatus();
}

async function resetUserList() {
  await chrome.storage.local.remove(USER_CUSTOM_KEY);
  document.getElementById('userList').value = '';
  flashStatus();
}

function flashStatus() {
  const el = document.getElementById('status');
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 1500);
}

// ── Remote list info ────────────────────────────────
function paintRemote(cache) {
  document.getElementById('remoteVersion').textContent = cache?.version ?? '—';
  document.getElementById('remoteUpdated').textContent = cache?.updated ?? '—';
  document.getElementById('remoteCount').textContent =
    Array.isArray(cache?.domains) ? String(cache.domains.length) : '—';
  const fetchedEl = document.getElementById('remoteFetched');
  fetchedEl.textContent = relTime(cache?.fetchedAt);
  fetchedEl.title = cache?.fetchedAt ? new Date(cache.fetchedAt).toLocaleString() : '';
}

async function refreshRemoteInfo() {
  const r = await chrome.storage.local.get(REMOTE_CACHE_KEY);
  paintRemote(r[REMOTE_CACHE_KEY]);
}

function setPill(kind, text) {
  const el = document.getElementById('refreshStatus');
  el.textContent = text;
  el.className = 'pill show ' + kind;
  if (kind === 'ok') setTimeout(() => { el.className = 'pill'; }, 4000);
}

function errText(code) {
  // bad-json/bad-shape = the file was reached but malformed; anything else
  // (network / http-4xx / unavailable) is almost always a NetFree block.
  if (code === 'bad-json' || code === 'bad-shape') return T('errFailed');
  return T('errBlocked');
}

async function forceRefreshRemote() {
  const btn   = document.getElementById('refreshBtn');
  const label = btn.querySelector('.btn-label');
  const prev  = label.textContent;
  btn.disabled = true;
  btn.classList.add('loading');
  label.textContent = T('refreshing');
  document.getElementById('refreshStatus').className = 'pill';

  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: 'REFRESH_HARMLESS_LIST', force: true });
  } catch {
    result = { ok: false, error: 'unavailable' };
  }

  btn.disabled = false;
  btn.classList.remove('loading');
  label.textContent = prev;

  if (result?.cache) paintRemote(result.cache); else await refreshRemoteInfo();

  if (result?.ok && result.updated) setPill('ok',  T('updated'));
  else if (result?.ok)              setPill('ok',  T('upToDate'));
  else                              setPill('err', errText(result?.error));
}

// ── Request a review for a pasted address ────────────
// Mirrors the popup's "new website" flow: stash subject+body so the
// netfree-fill.js content script pre-fills NetFree's form, then open
// the ticket page (t=site) with the pasted URL.
function normalizeUrl(raw) {
  let s = (raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch { return null; }
}

function setReviewPill(kind, text) {
  const el = document.getElementById('reviewStatus');
  el.textContent = text;
  el.className = 'pill show ' + kind;
  if (kind === 'ok') setTimeout(() => { el.className = 'pill'; }, 4000);
}

async function openReviewRequest() {
  const input = document.getElementById('reviewUrl');
  const url = normalizeUrl(input.value);
  if (!url) { setReviewPill('err', T('badUrl')); input.focus(); return; }

  const host    = new URL(url).hostname;
  const subject = STR.reviewSubject[lang](host);
  const body    = STR.reviewBody[lang](url);
  try {
    await chrome.storage.local.set({ pendingTicket: { subject, body, ts: Date.now() } });
  } catch { /* the ticket page still opens with the URL pre-set */ }

  const ticket = 'https://netfree.link/app/#/tickets/new?u=' + encodeURIComponent(url) +
                 '&r=' + encodeURIComponent(url) + '&t=site&bi=';
  chrome.tabs.create({ url: ticket });
  setReviewPill('ok', T('reqOpened'));
  input.value = '';
}

// ── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(LANG_KEY);
  applyLang(stored[LANG_KEY] ?? 'he');

  try {
    document.getElementById('extVersion').textContent =
      chrome.runtime.getManifest().version;
  } catch {}

  await loadUserList();
  await refreshRemoteInfo();

  document.getElementById('langBtn').addEventListener('click', () => {
    applyLang(lang === 'he' ? 'en' : 'he');
    refreshRemoteInfo(); // re-render relative time in the new language
  });
  document.getElementById('saveBtn').addEventListener('click', saveUserList);
  document.getElementById('resetBtn').addEventListener('click', resetUserList);
  document.getElementById('refreshBtn').addEventListener('click', forceRefreshRemote);
  document.getElementById('reviewBtn').addEventListener('click', openReviewRequest);
  document.getElementById('reviewUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openReviewRequest();
  });
});
