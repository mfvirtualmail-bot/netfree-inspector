// NetFree Inspector — traffic-recording builder + uploader.
//
// Builds a NetFree-compatible traffic recording from traffic the
// extension captured via chrome.webRequest, then uploads it so the user
// gets a real netfree.link/app/#/tools/traffic/view/<hash> URL.
//
// IMPORTANT — what this is and isn't:
// A real NetFree recording is a passive capture of the on-device
// filter's own event stream (wss://eeapi.internal.netfree.link/traffic/
// ws-log), so it contains socket/TLS rows and the filter's true internal
// block categories. That stream is unreachable from a normal extension —
// which is exactly why this extension exists: it serves users filtered
// at the network level who can't run NetFree's own recorder. So this is
// a *reconstruction* from chrome.webRequest metadata, dressed in the same
// wire format. It reproduces the request rows (accepted + blocked) the
// viewer needs, but not the filter-internal socket/category events.
//
// Wire format (PUT body, content-type text/plain, JSON.stringify of a
// bare 2-D array). Each inner array is one request, all its events share
// one numeric id, exactly how NetFree groups its own ws-log stream:
//   [ [ {action,id,time,...}, ... ], [ ... ] ]
// Server returns { key: "<hash>" } → view URL is
//   https://netfree.link/app/#/tools/traffic/view/<key>

const NF_SAVE_URL    = 'https://netfree.link/api/user/save-traffic-record';
const NF_VIEW_PREFIX = 'https://netfree.link/app/#/tools/traffic/view/';

// How a blocked request is represented in the recording.
//   mapFilter  → drives the viewer's Block-reason column (Hebrew category)
//   blockField → the load-bearing top-level `block` field the viewer reads
//                to paint the Block-reason tag
//
// When we captured NetFree's own block code from the 418 body (blockCode —
// e.g. 'deny', 'unknown', 'risk-type'), we pass it through verbatim so the
// viewer renders the EXACT same reason NetFree itself would. Otherwise we
// fall back to the coarse blockType classification, asserting a deny/חסום
// reason only when we positively saw a blacklist signal and reporting an
// honest `block:unknown` for everything else.
const DENY_CODES = new Set(['deny', 'black-list', 'default-block', 'myset', 'time', 'tags']);
function blockRepresentation(blockType, blockCode) {
  if (blockCode) {
    const isDeny = DENY_CODES.has(blockCode);
    return {
      reqFilter:  isDeny ? 'deny'  : blockCode,
      mapFilter:  isDeny ? 'חסום'  : null,
      blockField: blockCode,
    };
  }
  switch (blockType) {
    case 'blacklisted':
      return { reqFilter: 'deny',    mapFilter: 'חסום', blockField: 'deny' };
    case 'user_settings':
      // Blocked by the user's own settings — still a hard deny.
      return { reqFilter: 'deny',    mapFilter: 'חסום', blockField: 'deny' };
    case 'not_whitelisted':
    case 'file_type':
    case 'file_download':
    case 'unknown':
    default:
      // No positive category signal → honest "unknown".
      return { reqFilter: 'unknown', mapFilter: null,   blockField: 'unknown' };
  }
}

function hostOf(url, fallback) {
  try { return new URL(url).hostname; } catch { return fallback || url; }
}

// Build the event array for one captured request. `index` becomes the
// per-row `count:N`. Times: request-phase events anchor at startTime,
// response-phase events at endTime, with sub-ms steps so the viewer sorts
// events stably within the row.
function buildRequestEvents(req, index) {
  const id      = Number(req.id) || index + 1;
  const host    = req.host || hostOf(req.url, '');
  const method  = (req.method || 'GET').toUpperCase();
  const start   = (typeof req.startTime === 'number') ? req.startTime : 0;
  const end     = (typeof req.endTime === 'number' && req.endTime >= start) ? req.endTime : start;

  let rt = start;
  const reqStep = () => { rt += 0.001; return rt; };
  // Response-phase times anchor at endTime but must never rewind behind
  // the request-phase steps (possible when end-start is under a few µs).
  let pt = end;
  const respStep = () => { pt = Math.max(pt, rt) + 0.001; return pt; };

  const ev = [];
  ev.push({ action: `start:${id}, parent:0`,                     id, time: reqStep() });
  ev.push({ action: `request.method(${method}).bodyType(1)`,    id, time: reqStep() });
  ev.push({ action: `count:${index}`,                           id, time: reqStep() });
  ev.push({ action: `headers.host::${host}`,                    id, time: reqStep(), url: req.url });
  ev.push({ action: `request`,                                  id, time: reqStep() });
  ev.push({ action: `Request:filter:defaults`,                  id, time: reqStep() });
  ev.push({ action: `Request:filter:user`,                      id, time: reqStep() });

  if (req.blocked) {
    const rep = blockRepresentation(req.blockType, req.blockCode);
    if (rep.mapFilter) {
      ev.push({ action: `map:filter:${rep.mapFilter}`,          id, time: reqStep() });
    }
    ev.push({ action: `Request:filter:${rep.reqFilter}`,        id, time: reqStep() });
    ev.push({ action: `block:${rep.blockField}`, block: rep.blockField, id, time: reqStep() });
    ev.push({ action: `send-response-to-client`,                id, time: reqStep() });
    ev.push({ action: `finish`, end: true,                      id, time: reqStep() });
    return ev;
  }

  // No observed response — the request was still in flight when the
  // recording was built, or it failed without an HTTP response (DNS
  // failure, connection reset, abort). We never saw a status, so we must
  // not invent one: real NetFree recordings contain rows that simply
  // stop mid-flight with no finish event, and that is the honest (and
  // format-compatible) rendering here too.
  if (typeof req.statusCode !== 'number') {
    return ev;
  }

  // Accepted request — we observed the real status/headers.
  const status = req.statusCode;
  const bytes  = (typeof req.contentLength === 'number') ? req.contentLength : 0;
  ev.push({ action: `return-next`,                              id, time: reqStep() });
  ev.push({ action: `source-request::socket-server::reuse`,     id, time: reqStep() });
  ev.push({ action: `sourceResponse.statusCode(${status}).bodyType(1)`, id, time: respStep() });
  const respEv = { action: `response`, id, time: respStep() };
  if (req.contentType) respEv['content-type'] = req.contentType;
  ev.push(respEv);
  ev.push({ action: `Response:filter:defaults`,                 id, time: respStep() });
  ev.push({ action: `Response:filter:user`,                     id, time: respStep() });
  ev.push({ action: `return-accept`,                            id, time: respStep() });
  ev.push({ action: `ResponseHeadersToClient.bodyType:1`,       id, time: respStep() });
  ev.push({ action: `response.write(${bytes})`,                 id, time: respStep() });
  ev.push({ action: `finish`, end: true,                        id, time: respStep() });
  return ev;
}

// Accepts the captured-traffic array (preferred) OR the legacy block-group
// shape, and returns the 2-D recording array.
//
//   captured request: { id, url, host, method, type, startTime, endTime,
//                       statusCode, ip, contentType, contentLength,
//                       blocked, blockType }
//   legacy group:     { domain, blockType, requests: [{url, method, ip,
//                       timestamp, ...}] }  → flattened to blocked requests
function buildTrafficRecording(input) {
  const list = normalizeInput(input);
  // Stable chronological order so the recording reads start-to-finish.
  list.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  return list.map((req, i) => buildRequestEvents(req, i));
}

function normalizeInput(input) {
  if (!Array.isArray(input)) return [];
  // Legacy: array of { domain, blockType, requests: [...] } groups.
  if (input.length && input[0] && Array.isArray(input[0].requests)) {
    const out = [];
    for (const g of input) {
      for (const r of (g.requests || [])) {
        out.push({
          id:         r.id,
          url:        r.url,
          host:       g.domain || hostOf(r.url, ''),
          method:     r.method,
          type:       r.resourceType,
          startTime:  r.timestamp || 0,
          endTime:    r.timestamp || 0,
          ip:         r.ip,
          blocked:    true,
          blockType:  g.blockType || 'unknown',
          blockCode:  r.blockCode || null,
        });
      }
    }
    return out;
  }
  // Preferred: already a flat capture list.
  return input.filter(Boolean);
}

async function uploadTrafficRecording(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Nothing to upload');
  }
  const res = await fetch(NF_SAVE_URL, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify(arr),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // If the user isn't logged in to netfree.link, Express bounces us to
  // /app/#/login which comes back as HTML, not JSON.
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('json')) {
    throw new Error('not-authenticated');
  }
  const json = await res.json();
  if (!json || !json.key) throw new Error('No key in response');
  return NF_VIEW_PREFIX + json.key;
}

// Exposed for Node unit-testing; harmless in the browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildTrafficRecording, blockRepresentation, normalizeInput };
}

if (typeof self !== 'undefined') {
  self.NF = self.NF || {};
  self.NF.buildTrafficRecording  = buildTrafficRecording;
  self.NF.uploadTrafficRecording = uploadTrafficRecording;
}
