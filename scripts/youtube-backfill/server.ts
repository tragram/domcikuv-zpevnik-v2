/**
 * Step 2 — a small local website to review video/key/capo per song.
 *
 * Each field (YouTube / Key / Capo) is saved independently; unsaved fields keep
 * tracking the DB and are refreshed by the next `yt:fetch`. Reads/writes
 * youtube-links.json directly, so every Save is persisted immediately.
 *
 *   pnpm run yt:review
 */
import http from "node:http";
import { loadData, parseYoutubeId, saveData } from "./common";

const PORT = 4321;

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Song metadata review</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #0f0f12; color: #eee; }
  header { position: sticky; top: 0; background: #18181d; border-bottom: 1px solid #2a2a31; padding: 12px 16px; z-index: 10; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  .bar { height: 6px; background: #2a2a31; border-radius: 99px; overflow: hidden; margin-bottom: 10px; }
  .bar > div { height: 100%; background: #22c55e; transition: width .2s; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; }
  .filters button { background: #23232b; color: #ccc; border: 1px solid #33333d; border-radius: 99px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
  .filters button.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
  main { max-width: 900px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .card { display: flex; gap: 14px; background: #18181d; border: 1px solid #2a2a31; border-radius: 12px; padding: 12px; }
  .card.done { border-color: #225c39; }
  .thumb { width: 480px; flex-shrink: 0; }
  .thumb .ph, .thumb img, .thumb iframe, .thumb .wrap { width: 480px; height: 270px; border-radius: 8px; border: 0; display: block; background: #000; object-fit: cover; }
  .thumb .ph { display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px; background: #222; cursor: default; }
  .thumb .wrap { position: relative; cursor: pointer; }
  .thumb .wrap img { transition: filter .15s; }
  .thumb .wrap:hover img { filter: brightness(.7); }
  .thumb .play { position: absolute; inset: 0; margin: auto; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border-radius: 99px; background: rgba(0,0,0,.55); color: #fff; font-size: 18px; pointer-events: none; }
  .body { flex: 1; min-width: 0; }
  .title { font-weight: 600; }
  .artist { color: #999; font-size: 13px; margin-bottom: 6px; }
  .cand { font-size: 12px; color: #8ab4f8; margin-bottom: 6px; word-break: break-word; }
  .links { font-size: 12px; margin-bottom: 8px; }
  .links a { color: #8ab4f8; margin-right: 12px; }
  .field { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .field > label { font-size: 12px; color: #999; width: 34px; }
  input.id { flex: 1; min-width: 0; padding: 6px 8px; border-radius: 6px; border: 1px solid #33333d; background: #0f0f12; color: #eee; font-family: monospace; font-size: 12px; }
  .meta-in { width: 70px; padding: 6px 7px; border-radius: 6px; border: 1px solid #33333d; background: #0f0f12; color: #eee; font-family: monospace; font-size: 12px; }
  .meta-in.changed { border-color: #b8860b; background: #2a230f; }
  button.sm { border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: 600; }
  .ok { background: #22c55e; color: #06210f; }
  .ghost { background: #2a2a31; color: #ccc; }
  .tag { font-size: 11px; color: #999; white-space: nowrap; }
  .tag.saved { color: #4ade80; }
  .empty { text-align: center; color: #777; padding: 40px; }
</style>
</head>
<body>
<header>
  <h1>Song metadata review — video · key · capo</h1>
  <div class="bar"><div id="progress"></div></div>
  <div class="filters" id="filters"></div>
</header>
<main id="list"></main>
<script>
const FILTERS = ["todo", "done", "all"];
let state = { items: [] };
let filter = "todo";

// Mirror of src/lib/youtube.ts parseYoutubeId (kept tiny by hand).
function parseId(input) {
  if (!input) return null;
  const t = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    const h = u.hostname.replace(/^www\\./, "");
    if (h === "youtu.be") { const id = u.pathname.slice(1).split("/")[0]; return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null; }
    if (h.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/^\\/(?:embed|shorts|live|v)\\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return null;
}

async function load() { state = await (await fetch("/api/data")).json(); render(); }

async function post(body) {
  const res = await fetch("/api/item", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const { item } = await res.json();
  const i = state.items.findIndex((x) => x.songId === body.songId);
  if (i >= 0) state.items[i] = item;
  render();
}

function saveField(songId, field) {
  const el = document.getElementById(field + "-" + songId);
  const raw = el.value.trim();
  if (field === "youtube" && raw && !parseId(raw)) {
    alert("That doesn't look like a valid YouTube link or video id.");
    return;
  }
  post({ songId, field, saved: true, value: raw === "" ? null : raw });
}
function clearField(songId, field) { post({ songId, field, saved: false }); }

function counts() {
  const c = { todo: 0, done: 0, all: state.items.length };
  for (const it of state.items) it.youtubeSaved ? c.done++ : c.todo++;
  return c;
}

function ytView(it) {
  return it.youtubeSaved ? (it.youtubeId || "") : (it.candidate && it.candidate.id) || it.dbYoutubeId || "";
}
function ytTag(it) {
  if (it.youtubeSaved) return it.youtubeId ? '<span class="tag saved">✓ saved</span>' : '<span class="tag saved">✓ no video</span>';
  if (it.dbYoutubeId) return '<span class="tag">in DB</span>';
  return '<span class="tag">unsaved</span>';
}

function render() {
  const c = counts();
  document.getElementById("progress").style.width = (c.all ? (c.done / c.all) * 100 : 0) + "%";
  document.getElementById("filters").innerHTML = FILTERS.map((f) =>
    \`<button class="\${f === filter ? "active" : ""}" onclick="setFilter('\${f}')">\${f} (\${c[f]})</button>\`
  ).join("");

  const items = state.items.filter((it) => filter === "all" || (filter === "done" ? it.youtubeSaved : !it.youtubeSaved));
  const list = document.getElementById("list");
  if (!items.length) { list.innerHTML = '<div class="empty">Nothing here 🎉</div>'; return; }

  list.innerHTML = items.map((it) => {
    const vid = ytView(it);
    const q = encodeURIComponent(it.artist + " " + it.title);
    const thumb = vid
      ? \`<div class="wrap" onclick="play(this,'\${vid}')" title="Click to play here"><img loading="lazy" src="https://i.ytimg.com/vi/\${vid}/hqdefault.jpg" /><span class="play">▶</span></div>\`
      : '<div class="ph">no video</div>';
    const cand = it.candidate
      ? \`<div class="cand">Auto: \${esc(it.candidate.title)} — \${esc(it.candidate.channelTitle)}</div>\`
      : (it.searched ? '<div class="cand">Auto-search found nothing.</div>' : '');

    const keyView = it.keySaved ? (it.key || "") : (it.dbKey || "");
    const capoView = it.capoSaved ? (it.capo ?? "") : (it.dbCapo ?? "");
    const keyChanged = it.keySaved && it.key !== it.dbKey;
    const capoChanged = it.capoSaved && it.capo !== it.dbCapo;

    return \`
    <div class="card \${it.youtubeSaved ? "done" : ""}">
      <div class="thumb">\${thumb}</div>
      <div class="body">
        <div class="title">\${esc(it.title)}</div>
        <div class="artist">\${esc(it.artist)}</div>
        \${cand}
        <div class="links">
          \${vid ? \`<a href="https://www.youtube.com/watch?v=\${vid}" target="_blank" rel="noopener">▶ open</a>\` : ''}
          <a href="https://www.youtube.com/results?search_query=\${q}" target="_blank" rel="noopener">🔎 search YouTube</a>
        </div>
        <div class="field">
          <input class="id" id="youtube-\${it.songId}" value="\${esc(vid)}" placeholder="Paste a YouTube link or id (empty = no video)" />
          <button class="sm ok" onclick="saveField('\${it.songId}','youtube')">Save</button>
          \${it.youtubeSaved ? \`<button class="sm ghost" onclick="clearField('\${it.songId}','youtube')" title="Revert to DB">↺</button>\` : ''}
          \${ytTag(it)}
        </div>
        <div class="field">
          <label>Key</label>
          <input class="meta-in \${keyChanged ? 'changed' : ''}" id="key-\${it.songId}" value="\${esc(String(keyView))}" placeholder="—" />
          <button class="sm ok" onclick="saveField('\${it.songId}','key')">Save</button>
          \${it.keySaved ? \`<button class="sm ghost" onclick="clearField('\${it.songId}','key')" title="Revert to DB">↺</button>\` : ''}
          <span class="tag \${it.keySaved ? 'saved' : ''}">\${it.keySaved ? '✓ saved' : 'DB: ' + (it.dbKey || '∅')}</span>
        </div>
        <div class="field">
          <label>Capo</label>
          <input type="number" class="meta-in \${capoChanged ? 'changed' : ''}" id="capo-\${it.songId}" value="\${capoView}" placeholder="—" />
          <button class="sm ok" onclick="saveField('\${it.songId}','capo')">Save</button>
          \${it.capoSaved ? \`<button class="sm ghost" onclick="clearField('\${it.songId}','capo')" title="Revert to DB">↺</button>\` : ''}
          <span class="tag \${it.capoSaved ? 'saved' : ''}">\${it.capoSaved ? '✓ saved' : 'DB: ' + (it.dbCapo ?? '∅')}</span>
        </div>
      </div>
    </div>\`;
  }).join("");
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function setFilter(f) { filter = f; render(); }
function play(el, id) {
  const f = document.createElement("iframe");
  f.src = "https://www.youtube.com/embed/" + id + "?autoplay=1";
  f.allow = "autoplay; encrypted-media";
  f.allowFullscreen = true;
  el.replaceWith(f);
}

load();
</script>
</body>
</html>`;

function sendJSON(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }

  if (req.method === "GET" && req.url === "/api/data") {
    const data = loadData();
    if (!data) return sendJSON(res, 404, { error: "youtube-links.json not found — run `pnpm run yt:fetch` first." });
    return sendJSON(res, 200, data);
  }

  if (req.method === "POST" && req.url === "/api/item") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        const { songId, field, saved, value } = JSON.parse(raw) as {
          songId: string;
          field: "youtube" | "key" | "capo";
          saved: boolean;
          value?: string | null;
        };
        const data = loadData();
        if (!data) return sendJSON(res, 404, { error: "data file missing" });
        const item = data.items.find((i) => i.songId === songId);
        if (!item) return sendJSON(res, 404, { error: "song not found" });

        // A saved field takes the given value (normalized); clearing reverts it
        // to the DB baseline so the next fetch keeps it in sync.
        if (field === "youtube") {
          item.youtubeSaved = saved;
          item.youtubeId = saved ? (value ? parseYoutubeId(value) ?? value : null) : item.dbYoutubeId;
        } else if (field === "key") {
          item.keySaved = saved;
          item.key = saved ? (value && value.trim() ? value.trim() : null) : item.dbKey;
        } else if (field === "capo") {
          item.capoSaved = saved;
          if (!saved) item.capo = item.dbCapo;
          else {
            const n = value === null || value === undefined || value === "" ? null : Number(value);
            item.capo = n === null || Number.isNaN(n) ? null : n;
          }
        }
        saveData(data);
        return sendJSON(res, 200, { item });
      } catch (e) {
        return sendJSON(res, 400, { error: String(e) });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

if (!loadData()) {
  console.error("No youtube-links.json found. Run `pnpm run yt:fetch` first.");
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`\n🎬 Song metadata review running at http://localhost:${PORT}`);
  console.log("   Video / Key / Capo each save independently to youtube-links.json.");
  console.log("   When you're done, run `pnpm run yt:push` to write to the remote DB.\n");
});
