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
    fileType:         '📄 קובץ חסום — דרושה בדיקה ידנית',
    fileTypeSub:      'הסינון האוטומטי של נט פרי לא הצליח לסווג את הקובץ. הקלטת התעבורה שמצורפת לבקשה מאפשרת לנציג נט פרי לבדוק אותו ידנית.',
    fileDownload:     '⚠️ בעיה בהורדת קובץ',
    fileDownloadProblem: 'הורדה אוטומטית של קובץ נחסמה ע"י "התראת שיבוש קבצים" של נט פרי. הקובץ שירדת ריק או פגום.',
    fileDownloadOptions: 'יש שתי דרכים לפתור:',
    fileDownloadOpt1Label: 'אפשרות 1 — פתח את הקובץ בלשונית חדשה. נט פרי תציג את דף ההתראה, לחץ "המשך לקובץ" וקבל את הקובץ האמיתי:',
    fileDownloadOpt2Label: 'אפשרות 2 — בטל לצמיתות את התראת שיבוש הקבצים בהגדרות נט פרי:',
    unknown:          '❓ חסום — צד שלישי',
    copyUrl:          'העתק',
    copyAll:          'העתק הכל',
    openTicket:       'פתח בקשה ב-NetFree ↗',
    sendForReview:    'שלח לבדיקה ↗',
    sendVideoForReview: 'שלח סרטון לבדיקה ↗',
    openFileDirect:   'פתח קובץ ישירות ↗',
    disableWarnGate:  'בטל את ההתראה ב-NetFree ↗',
    suggestHarmless:  'הצע להוסיף לרשימת פרסומות/מעקב',
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
    ticketIntro:      (host) => `שלום,\nאני מנסה להשתמש באתר ${host} ומשהו בדף אינו נטען כראוי.`,
    ticketIntroList:  'בבדיקה ב-console של הדפדפן נמצא שהבקשות הבאות נחסמות על ידי נט פרי:',
    ticketAsk:        'אבקש לבדוק ולאשר את החסימות הרלוונטיות כדי שהאתר יוכל לפעול תקין. תודה רבה.',
    ticketVideoSubject:    (host) => `בקשת בדיקת וידאו - ${host}`,
    ticketVideoIntro:      'שלום,\nאני רוצה לצפות בסרטון הבא. אבקש לבדוק ולאשר אותו. תודה רבה.',
    ticketVideoLinkLabel:  'קישור ישיר לסרטון',
    ticketVideoLinksLabel: 'קישורים ישירים',
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
    fileType:         '📄 File blocked — manual review required',
    fileTypeSub:      'NetFree\'s automatic filter couldn\'t classify this file. The traffic recording attached to your request lets a NetFree agent review it manually.',
    fileDownload:     '⚠️ Download problem',
    fileDownloadProblem: 'An automatic file download was blocked by NetFree\'s file-distortion warning. The file you got is empty or broken.',
    fileDownloadOptions: 'Two ways to fix this:',
    fileDownloadOpt1Label: 'Option 1 — Open the file in a new tab. NetFree will show its confirmation page; click "Proceed to the file" to get the real file:',
    fileDownloadOpt2Label: 'Option 2 — Or permanently disable the file-distortion warning in NetFree settings:',
    unknown:          '❓ Blocked — 3rd party resource',
    copyUrl:          'Copy',
    copyAll:          'Copy All',
    openTicket:       'Open NetFree Request ↗',
    sendForReview:    'Send for review ↗',
    sendVideoForReview: 'Send video for review ↗',
    openFileDirect:   'Open file directly ↗',
    disableWarnGate:  'Disable warning in NetFree ↗',
    suggestHarmless:  'Suggest as ad / tracker (harmless)',
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
    ticketIntro:      (host) => `Hello,\nI'm trying to use the website ${host} and something on the page isn't loading correctly.`,
    ticketIntroList:  'When checking the browser console I found that the following requests are being blocked by NetFree:',
    ticketAsk:        'Please review and whitelist the relevant requests so the site can work correctly. Thank you.',
    ticketVideoSubject:    (host) => `Video review request — ${host}`,
    ticketVideoIntro:      'Hello,\nI would like to watch the following video. Please review and approve it. Thank you.',
    ticketVideoLinkLabel:  'Direct link',
    ticketVideoLinksLabel: 'Direct links',
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
  file_download: {
    badgeClass: 'badge-file-type',
    stripClass: 'strip-file-type',
    label: (t) => t.fileDownload,
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

  // Reset summary visibility on each render — the file_download-only
  // branch hides it, so we need to start each call from a clean slate.
  sum.style.display = '';

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

  // ── No blocks at all — compact green "all clear" panel ─────
  // Hide the summary banner entirely and render a single small
  // green confirmation. The page-bar above still shows the domain,
  // and the reload button stays in the footer; the popup ends up
  // ~half the height it was before.
  if (totalAll === 0) {
    sum.style.display = 'none';
    list.innerHTML = `
      <div style="margin:14px 12px;padding:14px 14px 16px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;text-align:center;">
        <div style="font-size:26px;line-height:1;">✅</div>
        <div style="margin-top:6px;font-size:14px;font-weight:700;color:#065F46;">${esc(t.noBlocks)}</div>
        <div style="margin-top:4px;font-size:11px;line-height:1.4;color:#047857;">${esc(t.noBlocksSub)}</div>
      </div>
    `;
    return;
  }

  // Only harmless blocks found — same compact green panel.
  if (meaningful === 0 && !showHarmless) {
    sum.style.display = 'none';
    list.innerHTML = `
      <div style="margin:14px 12px;padding:14px 14px 16px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;text-align:center;">
        <div style="font-size:26px;line-height:1;">✅</div>
        <div style="margin-top:6px;font-size:14px;font-weight:700;color:#065F46;">${esc(t.noMeaningful)}</div>
        <div style="margin-top:4px;font-size:11px;line-height:1.4;color:#047857;">${esc(t.noMeaningfulSub)}</div>
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
  const onlyFileDownload = visibleBlocks.every(g => g.blockType === 'file_download');

  // When every block is a file-download issue, the generic summary
  // ("1 block found on this page — click Open Request to report") is
  // both wrong and noisy. The card itself reads as the header. Hide
  // the banner entirely in that case.
  if (onlyFileDownload) {
    sum.style.display = 'none';
  } else {
    sum.style.display = '';
    sum.className     = 'summary state-blocks';
    sumIc.textContent = '🔴';
    sumTl.textContent = t.blocksFound(shownTotal);
    sumSb.textContent = t.blocksSubFound;
  }

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
  const isFileDl = blockType === 'file_download';

  // file_download has its own layout — the generic card buries the
  // two key actions in a small icon and a button row, which doesn't
  // communicate "this is a different kind of problem with a specific
  // fix." This branch presents Option 1 and Option 2 as clearly
  // numbered, full-width actions.
  if (isFileDl) return buildFileDownloadCard(group, t);

  // Ticket URL — describe the *parent page* the user is trying to use,
  // not the individual blocked sub-resource. The body lists all blocked
  // requests on the page so NetFree can review them together.
  // The category (site vs video) depends on what's blocked: video URLs
  // go through NetFree's t=video review flow, others stay generic.
  const kind         = ticketKindFor(group);
  const ticketUrl    = makeTicketUrl(tabUrl, tabUrl, kind.type);
  const ticketLabel  = t[kind.labelKey] || t.openTicket;

  // Show up to 4 requests; collapse the rest
  const MAX_SHOW    = 4;
  const shown       = requests.slice(0, MAX_SHOW);
  const hiddenCount = requests.length - shown.length;

  // The actions row differs for file_download blocks: instead of
  // "Open NetFree Request" we offer "Open file directly" (gets the
  // user past the gate via a real tab) and "Disable warning gate"
  // (opens NetFree's wiki page explaining how to turn it off). Per-row
  // copy/open buttons handled in reqRowHtml.
  const actionsHtml = isFileDl
    ? `
      <button class="card-action-btn disable-gate-btn" data-url="${esc(NETFREE_DISABLE_GATE_WIKI)}" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        ${esc(t.disableWarnGate)}
      </button>
      <button class="card-action-btn copy-group-btn icon-only" title="${esc(t.copyUrl)}" aria-label="${esc(t.copyUrl)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    `
    : `
      <button class="card-action-btn ticket-btn" data-ticket-url="${esc(ticketUrl)}" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${esc(ticketLabel)}
      </button>
      <button class="card-action-btn copy-group-btn icon-only" title="${esc(t.copyUrl)}" aria-label="${esc(t.copyUrl)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="card-action-btn suggest-btn icon-only" data-domain="${esc(domain)}" title="${esc(t.suggestHarmless)}" aria-label="${esc(t.suggestHarmless)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v8"/><path d="M8 12h8"/><circle cx="12" cy="12" r="10"/></svg>
      </button>
    `;

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

    ${blockType === 'file_type' ? `<div style="margin:0 12px 8px;padding:8px 10px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;font-size:11px;line-height:1.45;color:#1E3A8A;">${esc(t.fileTypeSub)}</div>` : ''}

    <div class="block-requests" id="reqs-${esc(domain)}">
      ${shown.map(req => reqRowHtml(req, { isFileDl })).join('')}
      ${hiddenCount > 0 ? `<div class="more-rows">${esc(t.moreRequests(hiddenCount))}</div>` : ''}
    </div>

    <div class="block-card-actions">
      ${actionsHtml}
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
      // Pass the clicked group so video-focused cards get the short
      // "I want to watch this video, please review it" body instead
      // of the generic "checking the console, found these blocks..."
      // boilerplate.
      await stashPendingTicket(group);
      openTicketWindow(ticketBtn.dataset.ticketUrl);
    });
  }

  // Suggest-as-harmless button — opens a pre-filled GitHub issue
  const suggestBtn = card.querySelector('.suggest-btn');
  if (suggestBtn) {
    suggestBtn.addEventListener('click', () => {
      openHarmlessSuggestion(suggestBtn.dataset.domain);
    });
  }

  // file_download: per-row "Open file directly" — opens the URL in a
  // real browser tab so NetFree can render its confirmation gate and
  // the user can click "Proceed" to actually get the file.
  card.querySelectorAll('.req-open-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (url && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      }
    });
  });

  // file_download: card-level "Disable warning gate" — opens NetFree's
  // wiki page explaining how to turn off the file-distortion warning.
  const disableBtn = card.querySelector('.disable-gate-btn');
  if (disableBtn) {
    disableBtn.addEventListener('click', () => {
      const url = disableBtn.dataset.url;
      if (url && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      }
    });
  }

  return card;
}

const NETFREE_DISABLE_GATE_WIKI =
  'https://netfree.link/wiki/%D7%91%D7%99%D7%98%D7%95%D7%9C_%D7%94%D7%AA%D7%A8%D7%A2%D7%94_%D7%A2%D7%9C_%D7%A9%D7%99%D7%91%D7%95%D7%A9_%D7%A7%D7%91%D7%A6%D7%99%D7%9D';

// Dedicated layout for file_download blocks. The card itself reads
// as the page header — there's no top "blocks found" banner when only
// file_download blocks are present (suppressed in render()). Layout:
//   1. Big "Download problem" heading + tiny domain underneath
//   2. Red problem-explanation banner
//   3. Two equal-weight side-by-side option columns
function buildFileDownloadCard(group, t) {
  const { domain, requests } = group;
  const MAX_SHOW = 3;
  const shown = requests.slice(0, MAX_SHOW);
  const hiddenCount = requests.length - shown.length;
  const isHe = lang === 'he';
  const align = isHe ? 'right' : 'left';

  // Inline styles keep this self-contained without expanding popup.css.
  // box-sizing + min-width:0 on grid items prevents overflow when the
  // button content is wider than the column.
  const S = {
    header:     `padding:10px 12px 2px;text-align:${align};`,
    title:      'font-size:14px;font-weight:700;color:#92400E;display:flex;align-items:center;gap:6px;',
    domain:     `font-size:10px;color:#6B7280;margin-top:2px;direction:ltr;text-align:${align};`,
    problem:    'margin:8px 12px;padding:8px 10px;background:#FEF3F2;border:1px solid #FECACA;border-radius:6px;font-size:11.5px;line-height:1.45;color:#991B1B;font-weight:500;',
    optsTitle:  `margin:6px 12px 6px;font-size:11px;font-weight:600;color:#444;text-align:${align};`,
    grid:       'display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 10px 10px;',
    col:        `box-sizing:border-box;min-width:0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:8px 6px;display:flex;flex-direction:column;gap:6px;text-align:${align};`,
    num:        'font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;',
    text:       'font-size:10.5px;line-height:1.35;color:#4B5563;flex:1;',
    btnBase:    'box-sizing:border-box;display:block;width:100%;padding:8px 4px;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;',
    btnOpen:    'background:#2563EB;border:1px solid #1D4ED8;color:#FFFFFF;',
    btnDisable: 'background:#F59E0B;border:1px solid #D97706;color:#FFFFFF;',
    btnHint:    `font-size:9.5px;color:#6B7280;text-align:${align};direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;`,
    moreRows:   'margin-top:4px;font-size:10px;color:#888;text-align:center;',
  };

  const fileButtons = shown.map((r, i) => {
    const label = requests.length > 1
      ? (isHe ? `↗ פתח קובץ ${i + 1}` : `↗ Open file ${i + 1}`)
      : (isHe ? '↗ פתח קובץ' : '↗ Open file');
    const short = shortenUrl(r.url);
    return `
      <div style="min-width:0;">
        <button class="filedl-open-btn" data-url="${esc(r.url)}" style="${S.btnBase}${S.btnOpen}" title="${esc(r.url)}" type="button">${esc(label)}</button>
        <div style="${S.btnHint}" title="${esc(r.url)}">${esc(short)}</div>
      </div>
    `;
  }).join('');

  const card = document.createElement('div');
  card.className = 'block-card';
  card.innerHTML = `
    <div style="${S.header}">
      <div style="${S.title}">⚠️ ${esc(isHe ? 'בעיה בהורדת קובץ' : 'Download problem')}</div>
      <div style="${S.domain}">${esc(domain)}</div>
    </div>

    <div style="${S.problem}">${esc(t.fileDownloadProblem)}</div>

    <div style="${S.optsTitle}">${esc(t.fileDownloadOptions)}</div>

    <div style="${S.grid}">
      <div style="${S.col}">
        <div style="${S.num}">${isHe ? 'אפשרות 1' : 'Option 1'}</div>
        <div style="${S.text}">${esc(t.fileDownloadOpt1Label)}</div>
        ${fileButtons}
        ${hiddenCount > 0 ? `<div style="${S.moreRows}">${esc(t.moreRequests(hiddenCount))}</div>` : ''}
      </div>
      <div style="${S.col}">
        <div style="${S.num}">${isHe ? 'אפשרות 2' : 'Option 2'}</div>
        <div style="${S.text}">${esc(t.fileDownloadOpt2Label)}</div>
        <button class="filedl-disable-btn" data-url="${esc(NETFREE_DISABLE_GATE_WIKI)}" style="${S.btnBase}${S.btnDisable}" type="button">
          ⊘ ${esc(isHe ? 'בטל התראה' : 'Disable')}
        </button>
      </div>
    </div>
  `;

  card.querySelectorAll('.filedl-open-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (url && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
    });
  });
  card.querySelector('.filedl-disable-btn')?.addEventListener('click', () => {
    const url = card.querySelector('.filedl-disable-btn').dataset.url;
    if (url && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
  });

  return card;
}

// Open a pre-filled GitHub issue suggesting the domain be added to the
// shared harmless-domains list. The maintainer reviews, then edits
// docs/harmless-domains.json — change reaches every installed extension
// within ~24 hours of the next daily refresh.
function openHarmlessSuggestion(domain) {
  const title = `[harmless] add ${domain}`;
  const body =
`**Domain:** \`${domain}\`

**Where I saw it blocked:** ${tabUrl || '(not captured)'}

**Why it should be on the harmless list:**
<!-- Briefly explain why this domain is an ad / tracker / analytics
     domain that's safe to ignore (it doesn't break the page). -->

---
_Submitted from NetFree Inspector popup._`;
  const url = `https://github.com/mfvirtualmail-bot/netfree-inspector/issues/new`
    + `?title=${encodeURIComponent(title)}`
    + `&body=${encodeURIComponent(body)}`
    + `&labels=${encodeURIComponent('harmless-suggestion')}`;
  if (chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
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

function reqRowHtml(req, opts = {}) {
  const short = shortenUrl(req.url);
  const openBtn = opts.isFileDl
    ? `<button class="req-open-btn" data-url="${esc(req.url)}" title="${esc(T[lang].openFileDirect)}" aria-label="${esc(T[lang].openFileDirect)}">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
       </button>`
    : '';
  return `
    <div class="req-row">
      <span class="req-type">${esc(req.resourceType)}</span>
      <span class="req-url" title="${esc(req.url)}" dir="ltr">${esc(short)}</span>
      ${openBtn}
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
    // Start a full-traffic recording session *before* reloading so the
    // reload's very first request is captured — that's what makes the
    // recording a complete page load, not just the blocks we happened to
    // see after the fact. The host scopes the session: navigating the tab
    // to a different site ends it (see background.js).
    try {
      await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId, host: pageHost() });
    } catch { /* background asleep; recording just won't be full this time */ }
    await chrome.tabs.reload(tabId);
    window.close();
  }
}

async function copyAll() {
  const allUrls = blocks.flatMap(g => g.requests.map(r => r.url)).join('\n');
  if (allUrls) await copyText(allUrls);
}

// Build a NetFree-ticket-ready subject + body. When `withUrlList` is true,
// the body includes a grouped URL list of every blocked request — used as
// a fallback when the traffic-recording upload fails. When false (the
// default), the body is just intro + ask, because the recording link
// carries the request data in a richer form.
function buildTicketContent(withUrlList = false, focusGroup = null) {
  const t    = T[lang];
  const host = pageHost();

  // Video-review focused ticket — used when the user clicks the
  // ticket button on a video / file_type card. Short, direct body
  // with the file URL(s) inline; the traffic recording link is
  // appended later by prepareTicketContent. No "I'm using this
  // site, here are console errors" boilerplate.
  const focusKind = focusGroup ? ticketKindFor(focusGroup).type : null;
  if (focusKind === 'video' && focusGroup) {
    const subject = t.ticketVideoSubject(host);
    const urls    = focusGroup.requests.map(r => r.url);
    const linkLabel = urls.length > 1 ? t.ticketVideoLinksLabel : t.ticketVideoLinkLabel;
    const urlBlock = urls.length === 1
      ? `${linkLabel}: ${urls[0]}`
      : `${linkLabel}:\n${urls.map(u => `  • ${u}`).join('\n')}`;
    const body = `${t.ticketVideoIntro}\n\n${urlBlock}`;
    return buildClipboard(subject, body);
  }

  // Generic site ticket — covers everything else.
  const subject = t.ticketSubject(host);
  let body;
  if (withUrlList) {
    const groups = blocks
      .map(g => ({
        ...g,
        requests: showHarmless ? g.requests : g.requests.filter(r => !r.harmless),
      }))
      .filter(g => g.requests.length > 0);
    const sections = groups.map(g => {
      const label = (BLOCK_META[g.blockType] ?? BLOCK_META.unknown).label(t);
      const urls  = g.requests.map(r => `  • ${r.url}`).join('\n');
      return `[${label}] ${g.domain}\n${urls}`;
    }).join('\n\n');
    body = `${t.ticketIntro(host)}\n${t.ticketIntroList}\n\n${sections}\n\n${t.ticketAsk}`;
  } else {
    body = `${t.ticketIntro(host)}\n\n${t.ticketAsk}`;
  }
  return buildClipboard(subject, body);
}

function buildClipboard(subject, body) {
  const isHe = lang === 'he';
  const subjLabel = isHe ? 'נושא' : 'Subject';
  const bodyLabel = isHe ? 'תוכן הבקשה' : 'Request content';
  const clipboard = `${subjLabel}: ${subject}\n\n${bodyLabel}:\n${body}`;
  return { subject, body, clipboard };
}

// Stash the subject + body in chrome.storage.local so the netfree.link
// content script can pick them up and auto-fill the ticket form fields,
// and copy the same content to the clipboard as a paste fallback.
// .local (not .session) because session defaults to TRUSTED_CONTEXTS
// which excludes content scripts.
// Build the final ticket subject + body for the current page, doing
// the traffic-recording upload along the way. On upload success, body
// is intro + recording link + ask; on failure, falls back to embedding
// the grouped URL list. Returns { subject, body, clipboard } so the
// caller can stash, copy, or both — all from one source of truth.
async function prepareTicketContent(focusGroup = null) {
  let url = null;
  try {
    url = await createTrafficRecordingUrl();
  } catch (e) {
    console.warn('[NetFree Inspector] traffic-recording upload failed:', e?.message || e);
  }

  // For video-focused tickets we always want the short body — the
  // URL list fallback only makes sense for generic site tickets
  // where the body lists every block on the page.
  const isVideoFocus = focusGroup && ticketKindFor(focusGroup).type === 'video';
  const { subject, body } = buildTicketContent(/* withUrlList */ !url && !isVideoFocus, focusGroup);

  let finalBody = body;
  if (url) {
    const label = lang === 'he' ? 'הקלטת תעבורה' : 'Traffic recording';
    finalBody = `${body}\n\n${label}: ${url}`;
  }

  return buildClipboard(subject, finalBody);
}

async function stashPendingTicket(focusGroup = null) {
  const { subject, body, clipboard } = await prepareTicketContent(focusGroup);
  try {
    await chrome.storage.local.set({
      pendingTicket: { subject, body, ts: Date.now() },
    });
  } catch {
    // storage.local unavailable; the clipboard copy below still
    // gives the user something to paste.
  }
  await copyText(clipboard, T[lang].contentCopied);
}

// Build & upload a NetFree-compatible traffic recording from the
// currently visible blocks. Returns the netfree.link view URL on
// success or null when there's nothing to upload.
async function createTrafficRecordingUrl() {
  if (!self.NF || typeof self.NF.buildTrafficRecording !== 'function') return null;

  // Prefer the full-traffic recording session captured by "Reload &
  // Record" — it has the whole page load (accepted + blocked), which is
  // what lets NetFree support navigate the recording themselves.
  let rec = null;
  try {
    rec = await chrome.runtime.sendMessage({ type: 'GET_RECORDING', tabId });
  } catch { /* fall through to the blocks-only fallback */ }

  let arr = null;
  let usedFullCapture = false;
  if (rec && rec.active && Array.isArray(rec.requests) && rec.requests.length) {
    usedFullCapture = true;
    // The recording layer only knows blocked-vs-not (from the 418). Pull
    // the richer block-type classification (which the always-on tracker
    // derived from NetFree's block page) across, so a blacklisted block
    // reads "Blocked/חסום" while everything else stays the honest
    // "Undefined". Exact URL match first; same-host match only as a
    // fallback (a host can mix block types, so URL wins). Accepted
    // requests carry no block type.
    const blockTypeByUrl  = {};
    const blockTypeByHost = {};
    for (const g of blocks) {
      for (const r of g.requests) {
        blockTypeByUrl[r.url] = g.blockType;
        try { blockTypeByHost[new URL(r.url).hostname] = g.blockType; } catch { /* skip */ }
      }
    }
    const reqs = rec.requests.map(r => ({
      ...r,
      blockType: r.blocked
        ? (blockTypeByUrl[r.url] || blockTypeByHost[r.host] || 'unknown')
        : undefined,
    }));
    arr = self.NF.buildTrafficRecording(reqs);
  } else {
    // Fallback: no recording session (user didn't reload-record). Build
    // from the blocked list we have — better than nothing.
    const groups = blocks
      .map(g => ({
        ...g,
        requests: showHarmless ? g.requests : g.requests.filter(r => !r.harmless),
      }))
      .filter(g => g.requests.length > 0);
    if (groups.length === 0) return null;
    arr = self.NF.buildTrafficRecording(groups);
  }

  if (!arr || !arr.length) return null;
  const url = await self.NF.uploadTrafficRecording(arr);

  // The session served its purpose — end it so the capture doesn't keep
  // accumulating (and get re-uploaded) after the ticket is filed. A new
  // "Reload & Record" starts a fresh one.
  if (usedFullCapture) {
    try { await chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId }); } catch { /* ok */ }
  }
  return url;
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
// NetFree's ticket URL has a `t=` parameter that varies by category:
//   t=site   — generic site/block request (default)
//   t=video  — submit a video for human review (NetFree's own
//              "Send the video for review" button uses this)
// Other categories likely exist (file/image) but aren't used yet.
function makeTicketUrl(blockedUrl, referrer, type = 'site') {
  const u = encodeURIComponent(blockedUrl);
  const r = encodeURIComponent(referrer);
  return `https://netfree.link/app/#/tickets/new?u=${u}&r=${r}&t=${encodeURIComponent(type)}&bi=`;
}

// Spot URLs that point at a video so we can offer NetFree's t=video
// "Send video for review" flow instead of a generic site request.
const VIDEO_HOST_RE = /(?:^|\.)(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv)$/i;
const VIDEO_EXT_RE  = /\.(mp4|m4v|mov|webm|avi|mkv|flv|wmv|ogv)(\?|$)/i;
function isVideoUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (VIDEO_HOST_RE.test(u.hostname)) return true;
  if (u.hostname === 'www.youtube.com' && u.pathname === '/watch') return true;
  if (VIDEO_EXT_RE.test(u.pathname)) return true;
  return false;
}

// Decide which ticket category + button label fit this group of
// blocked requests.
//   • Explicit video URLs (youtube/vimeo/.mp4 etc.) → NetFree's
//     t=video flow.
//   • file_type blocks (netfree_full_logo.svg with no .avif) are
//     almost always videos NetFree's auto-filter couldn't classify
//     — typically temp-CDN files from video editors. The human
//     review path is via the attached traffic recording, so we use
//     t=video and the "Send video for review" label too.
//   • Everything else stays the generic site-request flow.
function ticketKindFor(group) {
  // Only the real-evidence path counts as video now: an actual video host
  // or file extension. We no longer infer "video" from file_type /
  // sub_frame / media block classes — those default to a generic site
  // request ("something on this page isn't loading").
  if (group.requests.some(r => isVideoUrl(r.url))) {
    return { type: 'video', labelKey: 'sendVideoForReview' };
  }
  return { type: 'site', labelKey: 'openTicket' };
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
