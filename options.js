// NetFree Inspector — Options page

const REMOTE_CACHE_KEY = 'harmlessRemoteCache';
const LANG_KEY         = 'lang';
const CONTACT_EMAIL    = 'mf.virtualmail@gmail.com';

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
  // Feedback e-mail subjects/bodies (version filled in at wiring time)
  suggestSubject: { he: 'NetFree Inspector — רעיון / הצעה', en: 'NetFree Inspector — Idea / suggestion' },
  contactSubject: { he: 'NetFree Inspector — דיווח על תקלה', en: 'NetFree Inspector — Issue report' },
  suggestBody: { he: (v) => `\n\n—\nNetFree Inspector v${v}\nהרעיון שלי:\n`,
                 en: (v) => `\n\n—\nNetFree Inspector v${v}\nMy idea:\n` },
  contactBody: { he: (v) => `\n\n—\nNetFree Inspector v${v}\nהתקלה (ובאיזה אתר היא קורית):\n`,
                 en: (v) => `\n\n—\nNetFree Inspector v${v}\nThe problem (and which website it happens on):\n` },
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

function extVersion() {
  try { return chrome.runtime.getManifest().version; } catch { return ''; }
}

// ── i18n ─────────────────────────────────────────────
function applyLang(newLang) {
  lang = newLang;
  const html = document.documentElement;
  html.lang  = lang;
  html.dir   = lang === 'he' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-he][data-en]').forEach(el => {
    if (el.children.length === 0 || el.tagName === 'A') {
      el.textContent = el.dataset[lang];
    }
  });
  // Language segmented control — highlight the active language.
  document.querySelectorAll('#langSeg button').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === lang));
  wireFeedback();          // rebuild mailto links in the chosen language
  chrome.storage.local.set({ [LANG_KEY]: lang });
}

// ── Feedback / contact ──────────────────────────────
function mailto(subject, body) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function wireFeedback() {
  const v = extVersion();
  const suggest = document.getElementById('suggestBtn');
  const contact = document.getElementById('contactBtn');
  if (suggest) suggest.href = mailto(T('suggestSubject'), STR.suggestBody[lang](v));
  if (contact) contact.href = mailto(T('contactSubject'), STR.contactBody[lang](v));
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

  document.getElementById('extVersion').textContent = extVersion();

  await refreshRemoteInfo();

  document.querySelectorAll('#langSeg button').forEach(b =>
    b.addEventListener('click', () => applyLang(b.dataset.lang)));
  document.getElementById('refreshBtn').addEventListener('click', forceRefreshRemote);
  document.getElementById('reviewBtn').addEventListener('click', openReviewRequest);
  document.getElementById('reviewUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openReviewRequest();
  });
});
