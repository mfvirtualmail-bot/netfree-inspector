// NetFree Inspector — traffic-recording builder + uploader.
//
// Hybrid mode: real chrome.webRequest data + a single synthetic marker
// event so reviewers can see these rows came from the extension, not
// from NetFree's on-device filter pipeline.
//
// Wire format (PUT body, content-type text/plain, JSON.stringify of a
// bare 2-D array):
//   [
//     [ {action,id,time,...}, ... ],   // one inner array per request
//     [ {action,id,time,...}, ... ],
//   ]
// Server returns { key: "<hash>" } → view URL is
//   https://netfree.link/app/#/tools/traffic/view/<key>

const NF_SAVE_URL    = 'https://netfree.link/api/user/save-traffic-record';
const NF_VIEW_PREFIX = 'https://netfree.link/app/#/tools/traffic/view/';
const NF_MARKER_VER  = '1.4.9';

// Mirrors the real NetFree filter's "denied" sequence so the viewer
// flags the row with the orange "Blocked" tag and populates the Block-
// reason column. The two load-bearing pieces are:
//   1. map:filter:<reason>  → populates Block-reason column
//   2. {action:"block:deny", block:"deny"} → drives the Blocked tag
//      (the separate top-level `block` field is what the viewer reads,
//      not the action string)
// Plus a single synthetic marker (captured-by-extension::…) so anyone
// reading the recording can see these rows came from us, not the filter.
function buildRequestEvents(req, blockType, domain, id) {
  const baseTime = (typeof req.timestamp === 'number') ? req.timestamp : Date.now();
  const method   = (req.method || 'GET').toUpperCase();
  let host;
  try { host = new URL(req.url).hostname; } catch { host = domain || req.url; }

  // Monotonic sub-ms offsets so the viewer sorts events stably within one id.
  let t = baseTime;
  const step = () => { t += 0.001; return t; };

  return [
    { action: `start:${id}, parent:0`,                                          id, time: step() },
    { action: `captured-by-extension::NetFree-Inspector::v${NF_MARKER_VER}`,    id, time: step() },
    { action: `request.method(${method}).bodyType(0)`,                          id, time: step() },
    ...(req.ip ? [{ action: `tproxy::${req.ip}:`,                               id, time: step() }] : []),
    { action: `headers.host::${host}`,                                          id, time: step(), url: req.url },
    { action: `request`,                                                        id, time: step() },
    { action: `inspector-detected-block::${blockType || 'unknown'}::${domain}`, id, time: step() },
    { action: `map:filter:חסום`,                            id, time: step() },
    { action: `Request:filter:deny`,                                            id, time: step() },
    { action: `block:deny`, block: 'deny',                                      id, time: step() },
    { action: `send-response-to-client`,                                        id, time: step() },
    { action: `finish`, end: true,                                              id, time: step() },
  ];
}

function buildTrafficRecording(groups) {
  const out = [];
  let counter = (Date.now() % 100000000) + Math.floor(Math.random() * 1000);
  for (const g of groups || []) {
    for (const r of (g.requests || [])) {
      out.push(buildRequestEvents(r, g.blockType, g.domain, counter++));
    }
  }
  return out;
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

self.NF = self.NF || {};
self.NF.buildTrafficRecording  = buildTrafficRecording;
self.NF.uploadTrafficRecording = uploadTrafficRecording;
