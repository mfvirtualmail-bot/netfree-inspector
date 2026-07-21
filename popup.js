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
    blacklisted:      '🚫 חסום',
    notWhitelisted:   '⏳ לא נבדק עדיין',
    userSettings:     '⚙️ הגדרות אישיות',
    fileType:         '📄 קובץ — בדיקה',
    videoReview:      '🎬 וידאו — בדיקה',
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
    sendFileForReview: 'שלח קובץ לבדיקה ↗',
    videoCostNote:    'בדיקת סרטון עולה נקודה אחת',
    notRequestable:   'לא ניתן לפתוח בקשה על חסימה זו',
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
    newSiteSubject:   (host) => `בקשה לאתר חדש - ${host}`,
    newSiteBody:      (url) => `שלום,\nאבקש לבדוק ולאשר את האתר החדש הבא:\n${url}\n\nתודה רבה.`,
    newSiteTitle:     'האתר עדיין לא פתוח',
    newSiteSub:       'לחץ למטה לפתיחת בקשה — נט פרי תבדוק ותפתח אותו',
    ticketVideoSubject:    (host) => `בקשת בדיקת וידאו - ${host}`,
    ticketVideoIntro:      'שלום,\nאני מנסה לצפות בסרטון באתר הזה, אך הוא אינו נפתח מכיוון שנט פרי חוסמת אותו. האתר עצמו כבר פתוח; רק הסרטון חסום. אבקש לבדוק ולאשר אותו כדי שאוכל לצפות בו. תודה רבה.',
    ticketVideoLinkLabel:  'קישור ישיר לסרטון',
    ticketVideoLinksLabel: 'קישורים ישירים',
    ticketFileSubject:     (host) => `בקשת בדיקת קובץ - ${host}`,
    ticketFileIntro:       'שלום,\nאני מנסה להשתמש באתר הזה, אך קובץ שהדף זקוק לו אינו נטען — נט פרי חוסמת אותו בהודעה "סוג הקובץ אינו נתמך בסינון האוטומטי". האתר עצמו כבר פתוח; רק הקובץ הזה חסום. אבקש לבדוק ולאשר אותו כדי שהדף יעבוד. תודה רבה.',
    ticketFileLinkLabel:   'קישור ישיר לקובץ',
    ticketFileLinksLabel:  'קישורים ישירים',
    ticketFromLabel:       'הגעתי מהאתר',
    recordScreen:      'הקלט מסך',
    recordingScreen:   'מקליט מסך…',
    choosingSource:    'בחר מה להקליט…',
    uploadingRec:      'מעלה הקלטה…',
    stopAndSend:       'עצור ושלח',
    recUploaded:       '✓ ההקלטה הועלתה — טופס הבקשה נפתח',
    recFailed:         'העלאת ההקלטה נכשלה, נסה שוב',
    recPartial:        'טופס הבקשה נפתח — אך העלאת הווידאו נכשלה',
    recNotLoggedIn:    'יש להתחבר ל-NetFree כדי להעלות הקלטה',
    videoFailedNote:   'הערה: העלאת סרטון הקלטת המסך נכשלה.',
    trafficFailedNote: 'הערה: העלאת הקלטת התעבורה נכשלה.',
    recBusy:           'הקלטה כבר פעילה',
    screenTicketSubject: (host) => `בקשה עם הקלטת מסך - ${host}`,
    screenTicketIntro:   (host) => `שלום,\nמצורפת הקלטת מסך שמדגימה את הבעיה שאני נתקל בה${host ? ` באתר ${host}` : ''}. אבקש לבדוק ולאשר. תודה רבה.`,
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
    blacklisted:      '🚫 Blocked',
    notWhitelisted:   '⏳ Not reviewed',
    userSettings:     '⚙️ Your settings',
    fileType:         '📄 File — review',
    videoReview:      '🎬 Video — review',
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
    sendFileForReview: 'Send file for review ↗',
    videoCostNote:    'A video review costs 1 point',
    notRequestable:   'This block can\'t be requested',
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
    newSiteSubject:   (host) => `New website request — ${host}`,
    newSiteBody:      (url) => `Hello,\nPlease review and approve the following new website:\n${url}\n\nThank you.`,
    newSiteTitle:     'This website is still not open',
    newSiteSub:       'Click below to open a request — NetFree will review and open it',
    ticketVideoSubject:    (host) => `Video review request — ${host}`,
    ticketVideoIntro:      `Hello,\nI'm trying to watch a video on this website, but it won't play because NetFree is blocking it. The website itself is already open; only the video is blocked. Please review and approve it so I can watch it. Thank you.`,
    ticketVideoLinkLabel:  'Direct link to the video',
    ticketVideoLinksLabel: 'Direct links',
    ticketFileSubject:     (host) => `File review request — ${host}`,
    ticketFileIntro:       `Hello,\nI'm trying to use this website, but a file the page needs won't load — NetFree blocks it with "this type of file is not supported by automatic filtering". The website itself is already open; only this file is blocked. Please review and approve it so the page works. Thank you.`,
    ticketFileLinkLabel:   'Direct link to the file',
    ticketFileLinksLabel:  'Direct links',
    ticketFromLabel:       'Coming from',
    recordScreen:      'Record screen',
    recordingScreen:   'Recording screen…',
    choosingSource:    'Choose what to record…',
    uploadingRec:      'Uploading recording…',
    stopAndSend:       'Stop & send',
    recUploaded:       '✓ Recording uploaded — request form opened',
    recFailed:         'Recording upload failed, please try again',
    recPartial:        'Request form opened — but the video upload failed',
    recNotLoggedIn:    'Log in to NetFree to upload a recording',
    videoFailedNote:   'Note: the screen-recording video failed to upload.',
    trafficFailedNote: 'Note: the traffic recording failed to upload.',
    recBusy:           'A recording is already in progress',
    screenTicketSubject: (host) => `Screen recording request — ${host}`,
    screenTicketIntro:   (host) => `Hello,\nAttached is a screen recording showing the problem I'm experiencing${host ? ` on ${host}` : ''}. Please review and approve. Thank you.`,
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
  video_review: {
    badgeClass: 'badge-video-review',
    stripClass: 'strip-file-type',
    label: (t) => t.videoReview,
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

  // Single page-level "Open NetFree Request". For a brand-new, not-yet-
  // reviewed site we file a plain review request with no recording;
  // otherwise one ticket covering every block on the page.
  document.getElementById('pageTicketBtn').addEventListener('click', async () => {
    if (isNewSiteRequest()) {
      await stashNewSiteTicket();
      openTicketWindow(makeTicketUrl(tabUrl, tabUrl, 'site'));
      return;
    }
    // The blue page button is the GENERAL request: it describes the page and
    // attaches a full traffic recording of everything blocked on it. The
    // file-specific review (t=file, pointing at the blocked file) is ONLY the
    // green "Send file for review" button on the card — never this one.
    await stashPendingTicket();
    openTicketWindow(makeTicketUrl(tabUrl, tabUrl, 'site'));
  });
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

  // Screen recording — page-independent capture. The trigger + live banner
  // live in their own zone above the footer; state is mirrored in
  // storage.local by the background worker so the popup stays in sync even
  // after it was closed for the whole recording.
  const srEls = screenRecEls();
  if (srEls.btn)  srEls.btn.addEventListener('click', startScreenRec);
  if (srEls.stop) srEls.stop.addEventListener('click', stopScreenRec);
  if (srEls.cancel) srEls.cancel.addEventListener('click', cancelScreenRec);
  await refreshScreenRecUI();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.screenRec || changes.screenRecResult) refreshScreenRecUI();
  });
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
  const pageBtn = document.getElementById('pageTicketBtn');

  // The single page-level "Open NetFree Request" button is shown only in
  // the blocks state below; hide it for every other state (loading, clean,
  // harmless-only, file-download-only).
  if (pageBtn) pageBtn.style.display = 'none';
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
  // The page itself is simply "not yet reviewed" (a brand-new site).
  const newSite = isNewSiteRequest();

  const showPageBtn = () => {
    if (!pageBtn) return;
    const lbl = document.getElementById('pageTicketLabel');
    if (lbl) lbl.textContent = t.openTicket;
    pageBtn.style.display = '';
  };

  if (onlyFileDownload) {
    // File-download issues read as their own card; the generic banner
    // ("1 block found — click Open Request") is wrong and noisy here.
    sum.style.display = 'none';
  } else if (newSite) {
    // Don't frame a brand-new site as "1 block found" with a redundant
    // main_frame card. Just say it isn't open yet and point at the button.
    sum.style.display = '';
    sum.className     = 'summary state-blocks';
    sumIc.textContent = '⏳';
    sumTl.textContent = t.newSiteTitle;
    sumSb.textContent = t.newSiteSub;
    showPageBtn();
  } else {
    sum.style.display = '';
    sum.className     = 'summary state-blocks';
    sumIc.textContent = '🔴';
    sumTl.textContent = t.blocksFound(shownTotal);
    sumSb.textContent = t.blocksSubFound;
    showPageBtn();
  }

  // ── Block cards ─────────────────────────────────────────
  // New-site case: the banner + button say everything; the lone main_frame
  // card below is just noise, so skip it.
  list.innerHTML = '';
  if (!newSite) {
    for (const group of displayGroups(visibleBlocks)) {
      list.appendChild(buildCard(group, t));
    }
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
  // File/video reviews must reference the BLOCKED resource; a site request
  // still describes the parent page the user is trying to use.
  const ticketTarget = (!kind.type || kind.type === 'site') ? tabUrl : representativeUrl(group, kind.type);
  const ticketUrl    = makeTicketUrl(ticketTarget, tabUrl, kind.type || 'site');
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
  // Only video cards keep a per-card action row ("Send video for review").
  // Generic blocks rely on the single page-level request button, so they
  // get no action row at all — that keeps a long list (many ad/tracker
  // blocks) compact.
  // Video AND file reviews get their own action button: both are requests
  // about a specific blocked resource, which the page-level button can't
  // express. Generic/no-request blocks keep the compact, button-less card.
  const showActions = kind.type === 'video' || kind.type === 'file';
  // Distinct look per action so the card's "Send file for review" (green, file
  // icon) is never mistaken for the page-level blue "Open NetFree Request".
  // Video reviews (which cost a point) get their own violet + play icon.
  const btnVariant = kind.type === 'file' ? ' file-btn' : kind.type === 'video' ? ' video-btn' : '';
  const fileIcon  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  const videoIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  const ticketIcon = kind.type === 'file' ? fileIcon : kind.type === 'video' ? videoIcon : fileIcon;
  const actionsHtml = showActions ? `
      <button class="card-action-btn ticket-btn${btnVariant}" data-ticket-url="${esc(ticketUrl)}" type="button">
        ${ticketIcon}
        ${esc(ticketLabel)}
      </button>
      <button class="card-action-btn copy-group-btn icon-only" title="${esc(t.copyUrl)}" aria-label="${esc(t.copyUrl)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    ` : '';

  const card = document.createElement('div');
  // A requestable file/video block gets a highlighted card so it's obvious it
  // needs an action, distinct from the ad/tracker blocks around it.
  card.className = 'block-card'
    + (kind.type === 'file'  ? ' review-card review-file'  : '')
    + (kind.type === 'video' ? ' review-card review-video' : '');

  // Each card starts COLLAPSED — just badge + host + count + a chevron — so a
  // page with hundreds of blocks stays a short list. Clicking the head reveals
  // the file-type note and the individual blocked URLs. The action button and
  // any point-cost / not-requestable warning stay OUTSIDE the collapse, always
  // visible, so the user can act (and see a cost warning) without expanding.
  card.innerHTML = `
    <div class="block-card-head" role="button" tabindex="0" aria-expanded="false">
      <span class="block-badge ${meta.badgeClass}">${esc(meta.label(t))}</span>
      <span class="block-domain">${esc(domain)}</span>
      <span class="block-count-pill">${esc(t.requests(requests.length))}</span>
      <svg class="card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>

    ${kind.type === 'file' ? `<div style="margin:0 11px 6px;padding:6px 9px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;font-size:10.5px;line-height:1.35;color:#1E3A8A;">${esc(t.fileTypeSub)}</div>` : ''}
    ${kind.costsPoint ? `<div style="margin:0 12px 6px;padding:6px 9px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:6px;font-size:11px;line-height:1.4;color:#92400E;">${esc(t.videoCostNote)}</div>` : ''}
    ${kind.type === null ? `<div style="margin:0 12px 6px;padding:6px 9px;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:6px;font-size:11px;line-height:1.4;color:#4B5563;">${esc(t.notRequestable)}</div>` : ''}

    <div class="card-collapse" hidden>
      <div class="block-requests" id="reqs-${esc(domain)}">
        ${shown.map(req => reqRowHtml(req, { isFileDl })).join('')}
        ${hiddenCount > 0 ? `<div class="more-rows">${esc(t.moreRequests(hiddenCount))}</div>` : ''}
      </div>
    </div>

    ${showActions ? `<div class="block-card-actions">${actionsHtml}</div>` : ''}
  `;

  // Expand / collapse the blocked-URL list on head click (or keyboard).
  const head     = card.querySelector('.block-card-head');
  const collapse = card.querySelector('.card-collapse');
  if (head && collapse) {
    const toggle = () => {
      const open = collapse.hasAttribute('hidden');
      if (open) collapse.removeAttribute('hidden'); else collapse.setAttribute('hidden', '');
      card.classList.toggle('expanded', open);
      head.setAttribute('aria-expanded', String(open));
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  // Per-row copy buttons
  card.querySelectorAll('.req-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyText(btn.dataset.url);
    });
  });

  // Group copy button (only present on video cards now)
  card.querySelector('.copy-group-btn')?.addEventListener('click', () => {
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

  // The screen-rec banner's title is dynamic (recording/uploading), so the
  // data-he/data-en pass above doesn't cover it — refresh from current state.
  if (typeof refreshScreenRecUI === 'function') refreshScreenRecUI();

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

// ─────────────────────────────────────────────
// Screen recording (video → NetFree upload → ticket)
// ─────────────────────────────────────────────
// The heavy lifting (picker, MediaRecorder, upload) is in the recorder
// window; the ticket is assembled by the background. The popup only kicks it
// off, shows the live banner, and surfaces the outcome — it does NOT hold the
// recording, so closing the popup never interrupts it.
let srTimer = null;

function screenRecEls() {
  return {
    zone:   document.getElementById('screenRecZone'),
    btn:    document.getElementById('screenRecBtn'),
    label:  document.getElementById('screenRecLabel'),
    active: document.getElementById('screenRecActive'),
    title:  document.getElementById('screenRecTitle'),
    time:   document.getElementById('screenRecTime'),
    stop:   document.getElementById('screenRecStopBtn'),
    cancel: document.getElementById('screenRecCancelBtn'),
  };
}

async function startScreenRec() {
  const t    = T[lang];
  const host = pageHost();
  // Pass the localized ticket text now (we know the language + page here);
  // the background appends the [video-embedded#] line once upload returns a
  // filekey. `url` seeds the new-ticket form's page reference.
  // A screen recording is a GENERAL problem demonstration (video + traffic
  // recording), so it files a general request — not a file review. Only the
  // green "Send file for review" button files a file review.
  const ticket = {
    subject:      t.screenTicketSubject(host),
    bodyIntro:    t.screenTicketIntro(host === '—' ? '' : host),
    url:          tabUrl,
    type:         'site',
    targetUrl:    tabUrl,
    // The background appends "<label>: <view-url>" for the traffic
    // recording captured alongside the video — localized here, used there.
    trafficLabel:      lang === 'he' ? 'הקלטת תעבורה' : 'Traffic recording',
    videoFailedNote:   t.videoFailedNote,
    trafficFailedNote: t.trafficFailedNote,
  };
  try {
    chrome.runtime.sendMessage({ type: 'SCREEN_RECORD_START', tabId, host, ticket },
      () => void chrome.runtime.lastError);
  } catch { /* SW asleep / closing — the picker still opens from the worker */ }
  // Close NOW: Chrome parents the source picker to the focused window, and
  // if that's this (already-closing) popup the picker dismisses itself
  // instantly — the user sees a flash and no picker. The background waits
  // for the popup to be gone before showing it.
  window.close();
}

async function stopScreenRec() {
  const t   = T[lang];
  const els = screenRecEls();
  if (els.stop)  els.stop.disabled = true;   // optimistic: block double-clicks
  if (els.title) els.title.textContent = t.uploadingRec;
  if (els.time)  els.time.textContent = '';
  stopSrTimer();
  try { await chrome.runtime.sendMessage({ type: 'SCREEN_RECORD_STOP' }); } catch { /* ok */ }
}

// Cancel & discard — no upload, no ticket. Force-clears state and closes any
// recorder window (handles a recording the user didn't mean to start, or one
// orphaned by an earlier interrupted session).
async function cancelScreenRec() {
  const els = screenRecEls();
  if (els.cancel) els.cancel.disabled = true;
  stopSrTimer();
  // Clear the flags DIRECTLY from the popup so the UI goes idle no matter what
  // state the service worker is in (even if it's running older code). Then ask
  // the background to close any real recorder window that's still capturing.
  try { await chrome.storage.local.remove(['screenRec', 'screenRecResult', 'screenRecUpload']); } catch { /* ok */ }
  try { await chrome.runtime.sendMessage({ type: 'SCREEN_RECORD_CANCEL' }); } catch { /* ok */ }
  // Force the idle view immediately (don't wait on storage round-trips).
  applyScreenRecState(null, null);
}

function fmtElapsed(ms) {
  const s  = Math.max(0, Math.floor(ms / 1000));
  const m  = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

function startSrTimer(startedAt) {
  stopSrTimer();
  const els  = screenRecEls();
  const tick = () => { if (els.time && startedAt) els.time.textContent = fmtElapsed(Date.now() - startedAt); };
  tick();
  srTimer = setInterval(tick, 1000);
}
function stopSrTimer() { if (srTimer) { clearInterval(srTimer); srTimer = null; } }

// Reflect the live recording state (from storage.local) into the zone, and
// toast a freshly-finished recording's outcome exactly once.
function applyScreenRecState(state, result) {
  const t   = T[lang];
  const els = screenRecEls();
  if (!els.zone) return;

  const status    = state && state.status;
  const recording = status === 'recording';
  const busy      = status === 'picking' || status === 'uploading';

  if (recording || busy) {
    els.btn.style.display = 'none';
    els.active.hidden     = false;
    els.stop.disabled     = busy;
    if (recording) {
      els.title.textContent = t.recordingScreen;
      startSrTimer(state.startedAt);
    } else {
      els.title.textContent = status === 'picking' ? t.choosingSource : t.uploadingRec;
      els.time.textContent  = '';
      stopSrTimer();
    }
    return;
  }

  // Idle.
  els.active.hidden      = true;
  els.btn.style.display  = '';
  els.stop.disabled      = false;
  if (els.cancel) els.cancel.disabled = false;
  stopSrTimer();

  // A user-initiated cancel is not an outcome worth toasting — mark it seen.
  if (result && result.error === 'cancelled' && !result._seen) {
    chrome.storage.local.set({ screenRecResult: { ...result, _seen: true } }).catch(() => {});
    return;
  }

  // Announce a recent outcome once, then mark it seen so reopening the popup
  // doesn't re-toast it.
  if (result && !result._seen) {
    const fresh = !result.ts || (Date.now() - result.ts) < 120000;
    if (fresh) {
      const code = result.error && result.error !== 'error' ? ` [${result.error}]` : '';
      if (result.ok) showToast(t.recUploaded);
      // A request form DID open (traffic/intro), only the video is missing.
      else if (result.partial) showToast(t.recPartial + code);
      else if (result.error === 'not-authenticated') showToast(t.recNotLoggedIn);
      // Show the raw reason (http-413, upload-timeout, …) — "failed, try
      // again" alone makes remote diagnosis impossible.
      else showToast(t.recFailed + code);
    }
    chrome.storage.local.set({ screenRecResult: { ...result, _seen: true } });
  }
}

async function refreshScreenRecUI() {
  try {
    const r = await chrome.storage.local.get(['screenRec', 'screenRecResult']);
    let state = r.screenRec || null;
    // Don't trust a stale "recording" flag: verify a real recorder window is
    // behind it. A ghost from an interrupted session is cleared by the
    // background, and we show idle instead of a recording the user never began.
    if (state && ['picking', 'recording', 'uploading'].includes(state.status)) {
      try {
        const v = await chrome.runtime.sendMessage({ type: 'VERIFY_SCREEN_REC' });
        if (v && !v.live) state = null;
      } catch { /* background unreachable — fall back to the stored state */ }
    }
    applyScreenRecState(state, r.screenRecResult || null);
  } catch { /* storage unavailable — leave the idle button showing */ }
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
  if ((focusKind === 'video' || focusKind === 'file') && focusGroup) {
    const isFile  = focusKind === 'file';
    const subject = isFile ? t.ticketFileSubject(host) : t.ticketVideoSubject(host);
    // One line per LOGICAL file, restricted to the requestable kind (a merged
    // host may also carry non-requestable trackers): a streaming video is
    // hundreds of segments of the same media, and pasting near-identical URLs —
    // or unrelated tracker URLs — helps nobody.
    const urls    = filesForKind(focusGroup, focusKind).map(r => r.url);
    const linkLabel = urls.length > 1
      ? (isFile ? t.ticketFileLinksLabel : t.ticketVideoLinksLabel)
      : (isFile ? t.ticketFileLinkLabel  : t.ticketVideoLinkLabel);
    const urlBlock = urls.length === 1
      ? `${linkLabel}: ${urls[0]}`
      : `${linkLabel}:\n${urls.map(u => `  • ${u}`).join('\n')}`;
    const intro = isFile ? t.ticketFileIntro : t.ticketVideoIntro;
    // Name the page the user is actually on. The blocked resource is a bare
    // CDN URL (jwpsrv.com/…​/manifest.ism) that gives the reviewer zero context
    // about where it's needed — so state "Coming from: <page>" before the
    // direct link. Skip if we somehow have no page URL.
    const fromBlock = tabUrl ? `${t.ticketFromLabel}: ${tabUrl}\n` : '';
    const body  = `${intro}\n\n${fromBlock}${urlBlock}`;
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
      // Collapse streaming segments to one logical file per line (a video is
      // hundreds of near-identical segment URLs); note how many when folded.
      const files = uniqueFiles(g.requests);
      const urls  = files.map(r => `  • ${r.url}`).join('\n');
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
  const focusType    = focusGroup ? ticketKindFor(focusGroup).type : null;
  const isVideoFocus = focusType === 'video' || focusType === 'file';
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

// Stash a plain "new website" review request — no traffic recording. Used
// when the main page itself is merely "not yet reviewed" (NetFree's own
// flow for an unknown site is a simple site request; a recording of a site
// that never loaded is pointless). t=site, matching NetFree's block page.
async function stashNewSiteTicket() {
  const t       = T[lang];
  const subject = t.newSiteSubject(pageHost());
  const body    = t.newSiteBody(tabUrl);
  const { clipboard } = buildClipboard(subject, body);
  try {
    await chrome.storage.local.set({ pendingTicket: { subject, body, ts: Date.now() } });
  } catch { /* clipboard copy below is the fallback */ }
  await copyText(clipboard, t.contentCopied);
}

// Ask the service worker for NetFree's real block code for each URL. The
// popup itself can't fetch these domains (CSP connect-src is netfree.link
// only), so the SW — which has <all_urls> permission — reads each 418
// body. Returns { url: code|null }. Done at recording-build time so every
// blocked row gets NetFree's exact reason regardless of what the always-on
// tracker happened to cache.
async function fetchBlockCodes(urls) {
  const uniq = [...new Set(urls)].filter(Boolean);
  if (!uniq.length) return {};
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_BLOCK_CODES', urls: uniq });
    return (res && res.codes) || {};
  } catch {
    return {};
  }
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
    const blockCodeByUrl  = {};
    const blockCodeByHost = {};
    for (const g of blocks) {
      for (const r of g.requests) {
        blockTypeByUrl[r.url] = g.blockType;
        if (r.blockCode) blockCodeByUrl[r.url] = r.blockCode;
        try {
          const h = new URL(r.url).hostname;
          blockTypeByHost[h] = g.blockType;
          if (r.blockCode) blockCodeByHost[h] = r.blockCode;
        } catch { /* skip */ }
      }
    }
    // Authoritative: read each blocked row's real code straight from its
    // 418 body now (via the SW), so the recording matches NetFree exactly —
    // not whatever the always-on tracker raced to cache. Cached stored
    // codes are only a fallback if the live read fails.
    const liveCodes = await fetchBlockCodes(rec.requests.filter(r => r.blocked).map(r => r.url));
    const reqs = rec.requests.map(r => ({
      ...r,
      blockType: r.blocked
        ? (blockTypeByUrl[r.url] || blockTypeByHost[r.host] || 'unknown')
        : undefined,
      // NetFree's own code (deny/unknown/risk-type/…) emitted verbatim so
      // the viewer's Block-reason matches.
      blockCode: r.blocked
        ? (liveCodes[r.url] || blockCodeByUrl[r.url] || blockCodeByHost[r.host] || null)
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
    // Read each blocked URL's real code now so the recording is faithful.
    const liveCodes = await fetchBlockCodes(groups.flatMap(g => g.requests.map(r => r.url)));
    const groupsWithCodes = groups.map(g => ({
      ...g,
      requests: g.requests.map(r => ({
        ...r,
        blockCode: liveCodes[r.url] || r.blockCode || null,
      })),
    }));
    arr = self.NF.buildTrafficRecording(groupsWithCodes);
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

// NetFree's block code → the request category its OWN block page would open
// (that page computes `t = currentBlock.typeRequest || "site"`). Mirroring
// this table is what keeps our form in the same queue as NetFree's.
//
// Verified live on videos-cloudfront-usp.jwpsrv.com (a JW Player HLS stream):
// the .ts segments answer 418 with block code "risk-type" — "This type of
// file is not supported by automatic filtering" — while the .m3u8 manifest
// returns 200. So a blocked streaming video is a FILE review, not a video
// one: NetFree never classified it as video. Sending t=video there would be
// both the wrong queue AND would spend one of the user's points.
//
// null = NetFree offers no request form for that code (noRequest), so we
// must not open a futile one.
const REQUEST_TYPE_BY_CODE = {
  'risk-type':     'file',
  'share-file':    'file',
  'unknown-file':  'file',
  'unknown-video': 'video',   // the only code that costs the user a point
  'unknown':       'site',
  'error':         'error',
  'deny':           null,
  'black-list':     null,
  'default-block':  null,
  'myset':          null,
  'time':           null,
  'tags':           null,
};

// undefined = we have no code (or an unrecognised one) → caller falls back.
function requestTypeForCode(code) {
  if (!code) return undefined;
  return Object.prototype.hasOwnProperty.call(REQUEST_TYPE_BY_CODE, code)
    ? REQUEST_TYPE_BY_CODE[code]
    : undefined;
}

function kindFromType(type) {
  if (type === 'video') return { type: 'video', labelKey: 'sendVideoForReview', costsPoint: true };
  if (type === 'file')  return { type: 'file',  labelKey: 'sendFileForReview' };
  if (type === 'error') return { type: 'error', labelKey: 'openTicket' };
  return { type: 'site', labelKey: 'openTicket' };
}

// Streaming media fetches hundreds of numbered segments off ONE manifest —
// verified live: 152 blocked requests that were all one video under a single
// .../manifest.ism. Collapse them to the logical file so the user files one
// review instead of 152 (and so counts shown in the UI mean something).
// KEEP IN SYNC with background.js mediaManifestKey (same SEGMENT_EXT_RE + folds).
const SEGMENT_EXT_RE = /\.(?:ts|m4s|m4v|cmfv|cmfa|fmp4|aac|vtt)$/i;
function logicalFileKey(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^(.*\.(?:ism|m3u8|mpd))(?:\/|$)/i);
    if (m) return u.origin + m[1];
    // Fold a numbered streaming SEGMENT (…/chunk-12.ts → …/chunk-N.ts) ONLY for
    // known segment extensions, so report1.pdf / image02.jpg stay distinct files.
    if (SEGMENT_EXT_RE.test(u.pathname)) {
      return u.origin + u.pathname.replace(/\d+(?=\.[a-z0-9]+$)/i, 'N');
    }
    return u.origin + u.pathname;   // exact path → one key per distinct file
  } catch { return url; }
}

// One entry per logical file, ordered by how many blocked segments each file
// produced (most first). A page can host SEVERAL videos (e.g. a conference
// page with one player per session, each with its own manifest hash); they
// must stay separate review lines — only the segments WITHIN a video
// collapse. The dominant file — the video the user was actually watching —
// leads, so it becomes the form's target URL and the first link in the body.
function uniqueFiles(requests) {
  const seen = new Map();               // key → { r, n }
  for (const r of requests) {
    const k = logicalFileKey(r.url);
    const e = seen.get(k);
    if (e) e.n++;
    else seen.set(k, { r, n: 1 });
  }
  return [...seen.values()].sort((a, b) => b.n - a.n).map(e => e.r);
}

// Decide which ticket category + button label fit this group of blocked
// requests. The authoritative signal is NetFree's own block code, which the
// background already fetches per request; URL shape is only a fallback for
// when that fetch failed (a CDN hash URL like the JW Player one has neither a
// known video host nor a video extension, which is exactly how this used to
// mis-file a video/file block as a "Website Review").
function ticketKindFor(group) {
  const RANK = { site: 1, error: 1, file: 2, video: 3 };
  let bestType = null, sawCode = false, sawRequestable = false;
  for (const r of group.requests) {
    const type = requestTypeForCode(r.blockCode);
    if (type === undefined) continue;                 // no/unknown code
    sawCode = true;
    if (type === null) continue;                      // this code isn't requestable
    sawRequestable = true;
    if (!bestType || RANK[type] > RANK[bestType]) bestType = type;
  }
  if (sawRequestable) return kindFromType(bestType);
  if (sawCode) return { type: null, labelKey: null };  // every code was noRequest
  // No usable codes at all → fall back to explicit video host/extension.
  if (group.requests.some(r => isVideoUrl(r.url))) return kindFromType('video');
  return kindFromType('site');
}

// The single request the page-level button should open. Filing a "Website
// Review" for a site that is already open — because only its video segments
// are blocked — puts the ticket in the wrong queue; that was the bug.
function pageTicketKind() {
  // The page document itself is blocked → it genuinely is a site request.
  if (mainFrameBlock()) return { type: 'site', group: null, targetUrl: tabUrl };

  // Otherwise the sub-resource blocks decide. Skip harmless ad/tracker noise
  // (never spend a review request on analytics) and file_download, which has
  // its own dedicated UX.
  const groups = blocks
    .map(g => ({ ...g, requests: g.requests.filter(r => showHarmless || !r.harmless) }))
    .filter(g => g.requests.length && g.blockType !== 'file_download');

  const RANK = { site: 1, error: 1, file: 2, video: 3 };
  let best = null;
  for (const g of groups) {
    const kind = ticketKindFor(g);
    if (!kind.type) continue;                          // not requestable
    if (!best || RANK[kind.type] > RANK[best.kind.type]) best = { g, kind };
  }
  if (!best) return { type: 'site', group: null, targetUrl: tabUrl };
  return {
    type: best.kind.type,
    group: best.g,
    // For a file/video review NetFree needs the BLOCKED resource, not the
    // page — the page loaded fine (its manifest returned 200; only the
    // segments 418), so sending the page URL asks about the wrong thing.
    targetUrl: best.kind.type === 'site' ? tabUrl : representativeUrl(best.g),
  };
}

// The logical files to review for a group, restricted to the REQUESTABLE kind
// so a mixed host (one blocked file among many non-requestable trackers on the
// same host, merged into one card) targets the file — not the noisier tracker.
// Falls back to all files when none carry that kind's code (e.g. code missing).
function filesForKind(group, wantType) {
  let reqs = group.requests;
  if (wantType) {
    const f = reqs.filter(r => requestTypeForCode(r.blockCode) === wantType);
    if (f.length) reqs = f;
  }
  return uniqueFiles(reqs);
}

function representativeUrl(group, wantType) {
  const files = filesForKind(group, wantType);
  return (files[0] && files[0].url) || tabUrl;
}

// Order + consolidate the cards for display:
//   • ONE card per host — a page hammering the same place (e.g.
//     analytics.ivdu.org firing many requests) should read as a single
//     entry, not a card per request or per momentary classification.
//   • Actionable FILE/VIDEO reviews float to the TOP — that's the block the
//     user can actually do something about; ad/tracker noise sinks below.
//   • file_download keeps its own dedicated card (distinct fix flow) and
//     sits last.
const _SEVERITY = { blacklisted: 4, user_settings: 3, file_type: 2, not_whitelisted: 1, unknown: 0 };
function mostSevereType(types) {
  let best = 'unknown', rank = -1;
  for (const bt of types) { const r = _SEVERITY[bt] ?? 0; if (r > rank) { rank = r; best = bt; } }
  return best;
}

function displayGroups(groups) {
  const fileDl = groups.filter(g => g.blockType === 'file_download');
  const rest   = groups.filter(g => g.blockType !== 'file_download');

  // Merge every non-file_download group of the same host into one.
  const byHost = new Map();
  for (const g of rest) {
    const e = byHost.get(g.domain);
    if (e) { e.requests.push(...g.requests); e.types.push(g.blockType); }
    else byHost.set(g.domain, { domain: g.domain, requests: [...g.requests], types: [g.blockType] });
  }

  const merged = [...byHost.values()].map(e => {
    const group = { domain: e.domain, requests: e.requests, blockType: 'unknown' };
    const kind  = ticketKindFor(group).type;
    const reviewable = kind === 'file' || kind === 'video';
    // Badge follows the actionable kind when there is one, else the most
    // severe of the merged classifications.
    // Distinct badge type per kind so a video review isn't labelled "File".
    group.blockType  = kind === 'video' ? 'video_review'
                     : kind === 'file'  ? 'file_type'
                     : mostSevereType(e.types);
    group._reviewable = reviewable;
    return group;
  });

  // File/video reviews first; within each band, biggest offenders first.
  merged.sort((a, b) =>
    (a._reviewable === b._reviewable ? 0 : a._reviewable ? -1 : 1)
    || b.requests.length - a.requests.length);

  return merged.concat(fileDl);
}

// The block group representing the main page itself (a main_frame request).
function mainFrameBlock() {
  return blocks.find(g => g.requests.some(r => r.resourceType === 'main_frame')) || null;
}

// True when the page the user is trying to reach is itself blocked only as
// "not yet reviewed" (NetFree code 'unknown'). That's a brand-new site → a
// plain review request, no recording. Deliberately NOT for 'deny' (a real
// block) or any other category — only the unknown/unreviewed main page.
function isNewSiteRequest() {
  const g = mainFrameBlock();
  if (!g) return false;
  const mf   = g.requests.find(r => r.resourceType === 'main_frame');
  const code = mf && mf.blockCode;
  if (code) return code === 'unknown';
  // Fallback when the block-code fetch failed: our coarse classification.
  return g.blockType === 'not_whitelisted';
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
