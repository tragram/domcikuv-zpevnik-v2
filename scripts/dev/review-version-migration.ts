// Local review only. The SQLite snapshot is always opened read-only.
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { buildImportArchival, buildReviewPairs, decisionMatches, type ReviewVersion, type ReviewDecision } from "../shared/version-migration-review";

const source = resolve(process.argv[2] ?? ".wrangler/backups/remote-classifier-20261117.sqlite");
const decisionsPath = resolve(process.argv[3] ?? ".wrangler/backups/version-migration-decisions.json");
if (source === decisionsPath) throw new Error("Decisions must not overwrite the snapshot");
const port = Number(process.env.VERSION_REVIEW_PORT ?? 4322);
const db = new DatabaseSync(source, { readOnly: true });
const versions = db.prepare("SELECT * FROM song_version").all() as ReviewVersion[];
const byId = new Map(versions.map((v) => [v.id, v]));
const users = new Map(db.prepare("SELECT id,name,nickname FROM user").all().map((row) => [String(row.id), String(row.nickname || row.name || row.id)]));
const imports = new Map(db.prepare("SELECT id,source_id,url,title,artist,created_at FROM song_import").all().map((row) => [row.id, row]));
const pairs = buildReviewPairs(versions, new Map([...imports].map(([id, row]) => [String(id), String(row.source_id)])));
const songs = new Map(db.prepare("SELECT id,current_version_id FROM song").all().map((s) => [s.id, s.current_version_id]));
const archival = buildImportArchival(versions, new Map([...songs].map(([id, official]) => [String(id), official ? String(official) : null])));
const pins = new Map(db.prepare("SELECT pinned_version_id AS id,count(*) AS total FROM favorites WHERE pinned_version_id IS NOT NULL GROUP BY pinned_version_id").all().map((p) => [p.id, Number(p.total)]));
const pagePath = fileURLToPath(new URL("./version-migration-review.html", import.meta.url));
type DecisionsFile = { format: 1; decisions: ReviewDecision[] };
let saved: DecisionsFile = existsSync(decisionsPath) ? JSON.parse(readFileSync(decisionsPath, "utf8")) : { format: 1, decisions: [] };
if (saved.format !== 1 || !Array.isArray(saved.decisions)) throw new Error("Invalid decisions file");
function persist() {
  mkdirSync(dirname(decisionsPath), { recursive: true });
  writeFileSync(decisionsPath + ".tmp", JSON.stringify(saved, null, 2));
  renameSync(decisionsPath + ".tmp", decisionsPath);
}
// Existing calibration answers live in the decisions file, bound to their hashes.
// Never recreate them from IDs alone against a different snapshot.
if (!existsSync(decisionsPath)) persist();

function decision(pair: typeof pairs[number]) { return saved.decisions.find((d) => decisionMatches(d, pair)); }
const server = http.createServer(async (req, res) => {
  const json = (code: number, body: unknown) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  try {
    // Bind to loopback and reject foreign browser origins / DNS-rebinding hosts.
    if (!["127.0.0.1:" + port, "localhost:" + port].includes(req.headers.host ?? "")) return json(403, { error: "Local access only" });
    if (req.headers.origin && !["http://127.0.0.1:" + port, "http://localhost:" + port].includes(req.headers.origin)) return json(403, { error: "Foreign origin" });
    const url = new URL(req.url ?? "/", "http://127.0.0.1:" + port);
    if (req.method === "GET" && url.pathname === "/") { res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" }); return res.end(readFileSync(pagePath, "utf8")); }
    if (req.method === "GET" && url.pathname === "/api/pairs") return json(200, { source, decisionsPath, archival, pairs: pairs.map((p) => ({ ...p, decision: decision(p), staleDecision: !decision(p) && saved.decisions.some((d) => d.beforeId === p.beforeId && d.afterId === p.afterId) })) });
    const pair = pairs.find((p) => p.key === url.searchParams.get("key"));
    if (!pair) return json(404, { error: "Pair not found" });
    if (req.method === "GET" && url.pathname === "/api/pair") {
      const describe = (v: ReviewVersion | undefined) => {
        if (!v) return null;
        const direct = imports.get(String(v.import_id ?? ""));
        let ancestor: ReviewVersion | undefined = v;
        const seen = new Set<string>();
        while (ancestor && !ancestor.import_id && !seen.has(ancestor.id)) {
          seen.add(ancestor.id);
          ancestor = ancestor.parent_id ? byId.get(ancestor.parent_id) : undefined;
        }
        const provenance = ancestor ? imports.get(String(ancestor.import_id ?? "")) : undefined;
        return { ...v, submitted_by: users.get(String(v.user_id)) ?? String(v.user_id ?? "Unknown user"),
          reviewed_by: v.approved_by ? users.get(String(v.approved_by)) ?? String(v.approved_by) : null,
          official: songs.get(v.song_id) === v.id, pins: pins.get(v.id) ?? 0,
          import_source: direct?.source_id ?? null, import_url: direct?.url ?? null,
          import_title: direct?.title ?? null, import_artist: direct?.artist ?? null,
          imported_at: direct?.created_at ?? null,
          source_ancestry: provenance?.source_id ?? null };
      };
      return json(200, { ...pair, before: describe(byId.get(pair.beforeId)), after: describe(byId.get(pair.afterId)), importArchival: archival.find((plan) => plan.songId === pair.songId), decision: decision(pair) });
    }
    if (req.method === "POST" && url.pathname === "/api/decision") {
      if (req.headers["content-type"] !== "application/json") return json(415, { error: "JSON required" });
      let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 8192) return json(413, { error: "Too large" }); }
      const input = JSON.parse(body);
      if (!["revision", "separate", "unresolved"].includes(input.choice) || typeof input.note !== "string" || input.note.length > 2000) return json(400, { error: "Invalid decision" });
      if (input.beforeHash !== pair.beforeHash || input.afterHash !== pair.afterHash) return json(409, { error: "The compared content changed. Reload before reviewing." });
      if (input.choice === "revision" && (!byId.has(pair.beforeId) || byId.get(pair.beforeId)?.song_id !== pair.songId)) return json(400, { error: "Missing or cross-song parent requires manual repair" });
      const next: ReviewDecision = { beforeId: pair.beforeId, afterId: pair.afterId, beforeHash: pair.beforeHash, afterHash: pair.afterHash, choice: input.choice, note: input.note, updatedAt: new Date().toISOString() };
      const previous = saved;
      saved = { format: 1, decisions: [...saved.decisions.filter((d) => d.beforeId !== pair.beforeId || d.afterId !== pair.afterId), next] };
      try { persist(); } catch (error) { saved = previous; throw error; }
      return json(200, next);
    }
    return json(404, { error: "Not found" });
  } catch (error) { return json(500, { error: error instanceof Error ? error.message : String(error) }); }
});
server.listen(port, "127.0.0.1", () => console.log(`Review: http://127.0.0.1:${port}\nSnapshot read-only: ${source}\nDecisions: ${decisionsPath}\nPairs: ${pairs.length}; flagged: ${pairs.filter((p) => p.proposed === "review").length}`));
