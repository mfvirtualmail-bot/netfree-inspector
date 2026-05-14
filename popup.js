// NetFree Inspector — Popup Script

// ─────────────────────────────────────────────
// i18n strings
// ─────────────────────────────────────────────
const T = {
  he: {
    subtitle:         'בודק חסימות',
    checking:         'בודק…',
    noBlocks:         'לא נמצאו חסימות',
    noBlocksSub:      'כל הבקשות בדף זה עברו בהצלחה דרך נט פרי.',
    noBlocksHint:     'אם הדף לא עובד כראוי, נסה לרענן.',
    noMeaningful:     'לא נמצאו חסימות משמעותיות',
    noMeaningfulSub:  'נמצאו רק חסימות פרסומות/מעקב שלא משפיעות על הדף.',
    blocksFound:      (n) => `נמצאו ${n} חסימ${n === 1 ? 'ה' : 'ות'} בדף זה`,
    blocksSubFound:   'לחץ על "פתח בקשה" לפנייה ישירה לנט פרי',
    blacklisted:      '🚫 חסום — האתר ברשימה השחורה',
    notWhitelisted:   '⏳ לא ברשימה הלבנה — ממתין לאישור',
    userSettings:     '⚙️ חסום בהגדרות אישיות',
    fileType:         '📁 סוג קובץ שאינו נתמך בסינון אוטומטי',
    unknown:          '❓ חסום — צד שלישי',
    copyUrl:          'העתק',
    copyAll:          'העתק הכל',
    openTicket:       'פתח בקשה ב-NetFree ↗',
    reload:           'רענן ורשום',
    copied:           '✓ הועתק',
    contentCopied:    '✓ תוכן הבקשה הועתק — הדבק עם Ctrl+V',
    requests:         (n) => `${n} ${n === 1 ? 'בקשה' : 'בקשות'}`,
    moreRequests:     (n) => `+ ${n} בקשות נוספות`,
    loading:          'טוען…',
    harmlessHidden:   (n) => `+ ${n} חסימות פרסומות/מעקב מוסתרות`,
    showHarmless:     'הצג חסימות פרסומות/מעקב',
    hideHarmless:     'הסתר חסימות פרסומות/מעקב',
    ticketSubject:    (host) => `בעיה באתר ${host}`,
    ticketIntro:      (host) => `שלום,\nאני מנסה להשתמש באתר ${host} והוא אינו עובד כראוי.\nבבדיקה ב-console של הדפדפן נמצא שהבקשות הבאות נחסמות על ידי נט פרי:`,
    ticketAsk:        'אבקש לבדוק ולאשר את החסימות הרלוונטיות כדי שהאתר יוכל לפעול תקין. תודה רבה.',
  },
  en: {
    subtitle:         'Block Inspector',
    checking:         'Checking…',
    noBlocks:         'No blocks detected',
    noBlocksSub:      'All requests on this page passed through NetFree successfully.',
    noBlocksHint:     'If the page isn\'t working correctly, try reloading below.',
    noMeaningful:     'No meaningful blocks detected',
    noMeaningfulSub:  'Only ad/tracker blocks were found — these don\'t affect the page.',
    blocksFound:      (n) => `${n} block${n !== 1 ? 's' : ''} found on this page`,
    blocksSubFound:   'Click "Open Request" to report directly to NetFree',
    blacklisted:      '🚫 Blacklisted — explicitly blocked',
    notWhitelisted:   '⏳ Not whitelisted — pending review',
    userSettings:     '⚙️ Blocked by personal settings',
    fileType:         '📁 File type not supported by automatic filtering',
    unknown:          '❓ Blocked — 3rd party resource',
    copyUrl:          'Copy',
    copyAll:          'Copy All',
    openTicket:       'Open NetFree Request ↗',
    reload:           'Reload & Record',
    copied:           '✓ Copied',
    contentCopied:    '✓ Request content copied — paste with Ctrl+V',
    requests:         (n) => `${n} request${n !== 1 ? 's' : ''}`,
    moreRequests:     (n) => `+ ${n} more request${n !== 1 ? 's' : ''}`,
    loading:          'Loading…',
    harmlessHidden:   (n) => `+ ${n} ad/tracker block${n !== 1 ? 's' : ''} hidden`,
    showHarmless:     'Show ad / tracker blocks',
    hideHarmless:     'Hide ad / tracker blocks',
    ticketSubject:    (host) => `Problem with website ${host}`,
    ticketIntro:      (host) => `Hello,\nI'm trying to use the website ${host} and it isn't working properly.\nWhen checking the browser console I found that the following requests are being blocked by NetFree:`,
    ticketAsk:        'Please review and whitelist the relevant requests so the site can work correctly. Thank you.',
  },
};

// Badge / card config per block type
const BLOCK_META = {
  blacklisted: {
    badgeClass: 'badge-blacklisted',
    stripClass: 'strip-blacklisted',
    label: (t) => t.blacklisted,
  },
  not_whitelisted: {
    badgeClass: 'badge-not-whitelisted',
    stripClass: 'strip-not-whitelisted',
    label: (t) => t.notWhitelisted,
  },
  user_settings: {
    badgeClass: 'badge-user-settings',
    stripClass: 'strip-user-settings',
    label: (t) => t.userSettings,
  },
  file_type: {
    badgeClass: 'badge-file-type',
    stripClass: 'strip-file-type',
    label: (t) => t.fileType,
  },
  unknown: {
    badgeClass: 'badge-unknown',
    stripClass: 'strip-unknown',
    label: (t) => t.unknown,
  },
};

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let lang           = 'he';
let tabId          = null;
let tabUrl         = '';
let blocks         = [];
let showHarmless   = false;   // persisted in chrome.storage.local

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Restore persisted preferences
  const stored = await chrome.storage.local.get(['lang', 'showHarmless']);
  // If the user never picked a language, detect from the browser locale.
  // Hebrew ("he") or Yiddish ("yi") fallback to he; everything else → en.
  lang         = stored.lang ?? detectInitialLang();
  showHarmless = !!stored.showHarmless;
  applyLang(lang, false);

  // Sync harmless toggle state
  const tg = document.getElementById('harmlessToggle');
  if (tg) tg.checked = showHarmless;

  // Identify current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabId  = tab.id;
  tabUrl = tab.url ?? '';

  // Show domain in page bar
  try {
    document.getElementById('pageDomain').textContent = new URL(tabUrl).hostname;
  } catch {
    document.getElementById('pageDomain').textContent = tabUrl || '—';
  }

  // Fetch block data from the service worker
  await loadBlocks();

  // Wire up buttons
  document.getElementById('langBtn').addEventListener('click', toggleLang);
  document.getElementById('reloadBtn').addEventListener('click', reloadTab);
  document.getElementById('copyAllBtn').addEventListener('click', copyAll);
  document.getElementById('reportBtn').addEventListener('click', copyReport);
  document.getElementById('optionsBtn').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  });

  const harmlessBtn = document.getElementById('harmlessBtn');
  if (harmlessBtn) {
    syncHarmlessBtn(harmlessBtn);
    harmlessBtn.addEventListener('click', async () => {
      showHarmless = !showHarmless;
      await chrome.storage.local.set({ showHarmless });
      syncHarmlessBtn(harmlessBtn);
      render();
    });
  }
});

function syncHarmlessBtn(btn) {
  btn.classList.toggle('is-active', showHarmless);
  btn.setAttribute('aria-pressed', String(showHarmless));
  const t = T[lang];
  btn.title = showHarmless ? t.hideHarmless : t.showHarmless;
  btn.setAttribute('aria-label', btn.title);
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
async function loadBlocks() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_BLOCKS', tabId });
  blocks = res?.blocks ?? [];
  render();
}

// ─────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────
function render() {
  const t     = T[lang];
  const list  = document.getElementById('blocksList');
  const sum   = document.getElementById('summary');
  const sumTl = document.getElementById('summaryTitle');
  const sumSb = document.getElementById('summarySub');
  const sumIc = document.getElementById('summaryIcon');
  const hBtn  = document.getElementById('harmlessBtn');
  const hBadge = document.getElementById('harmlessCount');

  // Count both harmless and total across all groups
  let totalAll       = 0;
  let totalHarmless  = 0;
  for (const g of blocks) {
    for (const r of g.requests) {
      totalAll++;
      if (r.harmless) totalHarmless++;
    }
  }
  const meaningful = totalAll - totalHarmless;

  // Harmless button — show count badge only if there are hidden harmless blocks
  if (hBtn && hBadge) {
    if (totalHarmless > 0 && !showHarmless) {
      hBadge.hidden = false;
      hBadge.textContent = String(totalHarmless);
      hBtn.classList.add('has-hidden');
    } else {
      hBadge.hidden = true;
      hBtn.classList.remove('has-hidden');
    }
  }

  // ── Summary banner ──────────────────────────────────────
  if (totalAll === 0) {
    sum.className    = 'summary state-clean';
    sumIc.textContent = '✅';
    sumTl.textContent = t.noBlocks;
    sumSb.textContent = '';

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">${esc(t.noBlocks)}</div>
        <div class="empty-sub">${esc(t.noBlocksSub)}<br/><br/>${esc(t.noBlocksHint)}</div>
      </div>
    `;
    return;
  }

  // Only harmless blocks found — green "no meaningful blocks" state
  if (meaningful === 0 && !showHarmless) {
    sum.className    = 'summary state-clean';
    sumIc.textContent = '✅';
    sumTl.textContent = t.noMeaningful;
    sumSb.textContent = t.noMeaningfulSub;

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">${esc(t.noMeaningful)}</div>
        <div class="empty-sub">${esc(t.noMeaningfulSub)}</div>
      </div>
    `;
    return;
  }

  // Filter requests per the toggle
  const visibleBlocks = blocks
    .map(g => ({
      ...g,
      requests: showHarmless ? g.requests : g.requests.filter(r => !r.harmless),
    }))
    .filter(g => g.requests.length > 0);

  const shownTotal = visibleBlocks.reduce((s, g) => s + g.requests.length, 0);

  sum.className     = 'summary state-blocks';
  sumIc.textContent = '🔴';
  sumTl.textContent = t.blocksFound(shownTotal);
  sumSb.textContent = t.blocksSubFound;

  // ── Block cards ─────────────────────────────────────────
  list.innerHTML = '';
  for (const group of visibleBlocks) {
    list.appendChild(buildCard(group, t));
  }
}

// ─────────────────────────────────────────────
// Build card DOM
// ─────────────────────────────────────────────
function buildCard(group, t) {
  const { domain, blockType, requests } = group;
  const meta = BLOCK_META[blockType] ?? BLOCK_META.unknown;

  // Ticket URL — describe the *parent page* the user is trying to use,
  // not the individual blocked sub-resource. The body lists all blocked
  // requests on the page so NetFree can review them together.
  const ticketUrl = makeTicketUrl(tabUrl, tabUrl);

  // Show up to 4 requests; collapse the rest
  const MAX_SHOW    = 4;
  const shown       = requests.slice(0, MAX_SHOW);
  const hiddenCount = requests.length - shown.length;

  const card = document.createElement('div');
  card.className = 'block-card';

  card.innerHTML = `
    <div class="block-card-strip ${meta.stripClass}"></div>

    <div class="block-card-head">
      <span class="block-badge ${meta.badgeClass}">${esc(meta.label(t))}</span>
    </div>

    <div style="display:flex;align-items:center;gap:6px;padding:4px 12px 8px;">
      <span class="block-domain">${esc(domain)}</span>
      <span class="block-count-pill">${esc(t.requests(requests.length))}</span>
    </div>

    <div class="block-requests" id="reqs-${esc(domain)}">
      ${shown.map(req => reqRowHtml(req)).join('')}
      ${hiddenCount > 0 ? `<div class="more-rows">${esc(t.moreRequests(hiddenCount))}</div>` : ''}
    </div>

    <div class="block-card-actions">
      <button class="card-action-btn ticket-btn" data-ticket-url="${esc(ticketUrl)}" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${esc(t.openTicket)}
      </button>
      <button class="card-action-btn copy-group-btn icon-only" title="${esc(t.copyUrl)}" aria-label="${esc(t.copyUrl)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  `;

  // Per-row copy buttons
  card.querySelectorAll('.req-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyText(btn.dataset.url);
    });
  });

  // Group copy button
  card.querySelector('.copy-group-btn').addEventListener('click', () => {
    copyText(requests.map(r => r.url).join('\n'));
  });

  // Ticket button — stash the subject+body in chrome.storage.session
  // (the netfree-fill content script reads it and auto-fills the form
  // fields), AND copy them to the clipboard as a paste fallback, then
  // open the NetFree form in a small Chrome popup window.
  const ticketBtn = card.querySelector('.ticket-btn');
  if (ticketBtn) {
    ticketBtn.addEventListener('click', async () => {
      await stashPendingTicket();
      await copyTicketContent();
      openTicketWindow(ticketBtn.dataset.ticketUrl);
    });
  }

  return card;
}

// Open the NetFree ticket form as a small popup window.
// Falls back to a new tab if the windows API is unavailable (very old Chrome).
function openTicketWindow(url) {
  if (!url) return;
  if (chrome.windows && chrome.windows.create) {
    chrome.windows.create({
      url,
      type:   'popup',
      width:  520,
      height: 720,
    });
  } else {
    chrome.tabs.create({ url });
  }
}

function reqRowHtml(req) {
  const short = shortenUrl(req.url);
  return `
    <div class="req-row">
      <span class="req-type">${esc(req.resourceType)}</span>
      <span class="req-url" title="${esc(req.url)}" dir="ltr">${esc(short)}</span>
      <button class="req-copy-btn" data-url="${esc(req.url)}" title="Copy URL">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────
function applyLang(newLang, doRender = true) {
  lang = newLang;
  const html = document.documentElement;
  html.lang = lang;
  html.dir  = lang === 'he' ? 'rtl' : 'ltr';

  document.getElementById('langBtn').textContent        = lang === 'he' ? 'EN' : 'עב';
  document.getElementById('hdr-subtitle').textContent   = T[lang].subtitle;

  // Update all data-he/data-en elements
  document.querySelectorAll('[data-he][data-en]').forEach(el => {
    el.textContent = el.dataset[lang];
  });

  // Re-localize harmless button title
  const hBtn = document.getElementById('harmlessBtn');
  if (hBtn) syncHarmlessBtn(hBtn);

  chrome.storage.local.set({ lang });
  if (doRender) render();
}

function toggleLang() {
  applyLang(lang === 'he' ? 'en' : 'he');
}

function detectInitialLang() {
  try {
    const uiLang = (chrome.i18n && chrome.i18n.getUILanguage?.())
                || navigator.language
                || 'he';
    const code = uiLang.toLowerCase();
    // Hebrew or Yiddish user → default to Hebrew. Otherwise English.
    if (code.startsWith('he') || code.startsWith('iw') || code.startsWith('yi')) return 'he';
    return 'en';
  } catch {
    return 'he';
  }
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────
async function reloadTab() {
  if (tabId !== null) {
    await chrome.tabs.reload(tabId);
    window.close();
  }
}

async function copyAll() {
  const allUrls = blocks.flatMap(g => g.requests.map(r => r.url)).join('\n');
  if (allUrls) await copyText(allUrls);
}

// Build a NetFree-ticket-ready subject + body covering ALL blocks on the
// current page (across every blocked domain), grouped by block type.
// Excludes harmless blocks unless the "show harmless" toggle is on.
function buildTicketContent() {
  const t      = T[lang];
  const host   = pageHost();
  const groups = blocks
    .map(g => ({
      ...g,
      requests: showHarmless ? g.requests : g.requests.filter(r => !r.harmless),
    }))
    .filter(g => g.requests.length > 0);

  const subject = t.ticketSubject(host);

  const sections = groups.map(g => {
    const label = (BLOCK_META[g.blockType] ?? BLOCK_META.unknown).label(t);
    const urls  = g.requests.map(r => `  • ${r.url}`).join('\n');
    return `[${label}] ${g.domain}\n${urls}`;
  }).join('\n\n');

  const body = `${t.ticketIntro(host)}\n\n${sections}\n\n${t.ticketAsk}`;

  // The clipboard payload is laid out so the user can paste once, or
  // pick out subject vs. body if NetFree's form has separate fields.
  const isHe = lang === 'he';
  const subjLabel = isHe ? 'נושא' : 'Subject';
  const bodyLabel = isHe ? 'תוכן הבקשה' : 'Request content';
  const clipboard = `${subjLabel}: ${subject}\n\n${bodyLabel}:\n${body}`;

  return { subject, body, clipboard };
}

// Copy the ticket content (subject + body) to the clipboard so the user
// can paste it straight into the NetFree request form.
async function copyTicketContent() {
  const { clipboard } = buildTicketContent();
  await copyText(clipboard, T[lang].contentCopied);
}

// Stash the subject + body in chrome.storage.local so the netfree.link
// content script can pick them up and auto-fill the ticket form fields.
// .local (not .session) because session defaults to TRUSTED_CONTEXTS
// which excludes content scripts.
async function stashPendingTicket() {
  const { subject, body } = buildTicketContent();
  try {
    await chrome.storage.local.set({
      pendingTicket: { subject, body, ts: Date.now() },
    });
  } catch {
    // storage.local unavailable; the clipboard fallback still gives
    // the user something to paste.
  }
}

// Copy a human-readable, shareable report (WhatsApp/email friendly).
// Excludes harmless blocks unless the "show harmless" toggle is on.
async function copyReport() {
  const t      = T[lang];
  const isHe   = lang === 'he';
  const groups = blocks
    .map(g => ({
      ...g,
      requests: showHarmless ? g.requests : g.requests.filter(r => !r.harmless),
    }))
    .filter(g => g.requests.length > 0);

  const header = isHe
    ? `דוח חסימות NetFree — ${new URL(tabUrl || 'about:blank').hostname || tabUrl}\nתאריך: ${new Date().toLocaleString('he-IL')}\n`
    : `NetFree block report — ${new URL(tabUrl || 'about:blank').hostname || tabUrl}\nDate: ${new Date().toLocaleString()}\n`;

  if (groups.length === 0) {
    const empty = isHe ? 'לא נמצאו חסימות משמעותיות בדף זה.' : 'No meaningful blocks detected on this page.';
    await copyText(`${header}\n${empty}`);
    return;
  }

  const body = groups.map(g => {
    const label = (BLOCK_META[g.blockType] ?? BLOCK_META.unknown).label(t);
    const urls  = g.requests.map(r => `  • ${r.url}`).join('\n');
    return `[${label}] ${g.domain}\n${urls}`;
  }).join('\n\n');

  const total  = groups.reduce((s, g) => s + g.requests.length, 0);
  const footer = isHe
    ? `\n\nסה"כ ${total} חסימות · נוצר ע"י NetFree Inspector`
    : `\n\nTotal ${total} blocks · generated by NetFree Inspector`;

  await copyText(`${header}\n${body}${footer}`);
}

async function copyText(text, toastMsg) {
  const t = T[lang];
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for restricted contexts
    const ta = Object.assign(document.createElement('textarea'), {
      value: text, style: 'position:fixed;opacity:0'
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast(toastMsg ?? t.copied);
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 1800);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function makeTicketUrl(blockedUrl, referrer) {
  const u = encodeURIComponent(blockedUrl);
  const r = encodeURIComponent(referrer);
  return `https://netfree.link/app/#/tickets/new?u=${u}&r=${r}&t=site&bi=`;
}

function pageHost() {
  try {
    return new URL(tabUrl).hostname;
  } catch {
    return tabUrl || '—';
  }
}

function shortenUrl(url) {
  try {
    const { pathname, search } = new URL(url);
    const p = pathname + search;
    return p.length > 50 ? p.slice(0, 48) + '…' : p;
  } catch {
    return url.slice(0, 50);
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
