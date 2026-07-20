// NetFree Inspector — SSE (real-filter) recording builder.
//
// v1.8 direction: instead of RECONSTRUCTING a traffic recording from
// chrome.webRequest metadata (traffic-recording.js), read NetFree's OWN
// live event stream and upload it verbatim. The stream is the exact data
// NetFree's native recorder captures — real identity rows, socket/TLS rows,
// the filter's true Hebrew categories, and real block reasons/phases
// (including the "file too large" style errors support asks for).
//
// Stream endpoint (only reachable from a device behind the filter):
//   GET https://eeapi.internal.netfree.link/traffic/sse
//   - HTTPS, cert issued by the on-device NetFree CA (trusted behind filter)
//   - Server GATES on the request header: Origin MUST equal
//     "https://netfree.link/" exactly. Any other value / absent → it answers
//     {"error":"some-error"} instead of streaming. fetch() cannot set Origin,
//     so the extension installs a declarativeNetRequest rule to set it.
//   - No credentials needed: the filter identifies the user by network
//     position (the stream already carries user::<id> rows).
//
// Wire format is Server-Sent Events: newline-delimited "data: <json>" lines,
// blank line between events. The first event is a control frame
// {"timeStart": <ns>} with no id. Every real event is
//   { action, id, time, ...optional(url, ip, port, protocol, block, end, ...) }
// where `id` groups all events of one request/socket — exactly how a real
// recording's inner arrays are formed. So building the upload payload is just
// "group the events by id, in first-seen order" — no synthesis at all.

// Parse an SSE text blob (or incremental chunk join) into a flat event list.
// Tolerant: ignores control frames, comments, and any non-JSON data line.
function parseSSE(text) {
  const events = [];
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data:')) continue;      // skip blank lines, comments, event:/id: fields
    const payload = line.slice(5).trim();
    if (!payload) continue;
    let ev;
    try { ev = JSON.parse(payload); } catch { continue; }
    if (!ev || typeof ev !== 'object') continue;
    if (ev.timeStart !== undefined && ev.id === undefined) continue;  // control frame
    events.push(ev);
  }
  return events;
}

// Group a flat event list into the 2-D recording array NetFree expects:
// one inner array per request/socket id, ordered by first appearance, each
// inner array holding that id's events in stream order. Events without a
// numeric id (control frames) are dropped.
function buildRecordingFromEvents(events) {
  const byId = new Map();               // id → events[] (insertion-ordered)
  for (const ev of events) {
    if (ev == null || typeof ev !== 'object') continue;
    const id = ev.id;
    if (typeof id !== 'number' && typeof id !== 'string') continue;
    let bucket = byId.get(id);
    if (!bucket) { bucket = []; byId.set(id, bucket); }
    bucket.push(ev);
  }
  return [...byId.values()];
}

// Convenience: raw SSE text → upload-ready 2-D array.
function buildRecordingFromSSE(text) {
  return buildRecordingFromEvents(parseSSE(text));
}

// A stateful line-oriented parser for consuming a fetch() ReadableStream
// incrementally in the browser: feed decoded chunks, get back complete
// events as they arrive, keeping any partial trailing line buffered.
function createSSEStreamParser(onEvent) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const evs = parseSSE(line);
        for (const ev of evs) onEvent(ev);
      }
    },
    flush() { if (buf) { for (const ev of parseSSE(buf)) onEvent(ev); buf = ''; } },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseSSE, buildRecordingFromEvents, buildRecordingFromSSE, createSSEStreamParser };
}
if (typeof self !== 'undefined') {
  self.NF = self.NF || {};
  self.NF.parseSSE = parseSSE;
  self.NF.buildRecordingFromEvents = buildRecordingFromEvents;
  self.NF.buildRecordingFromSSE = buildRecordingFromSSE;
  self.NF.createSSEStreamParser = createSSEStreamParser;
}
