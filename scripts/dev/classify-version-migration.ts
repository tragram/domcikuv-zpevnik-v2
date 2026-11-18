// Read-only: produces proposals, never merges rows or writes to the source DB.
// Usage: node --import tsx scripts/dev/classify-version-migration.ts snapshot.sqlite report.json
import { DatabaseSync } from "node:sqlite";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildImportArchival, buildReviewPairs, type ReviewVersion } from "../shared/version-migration-review";

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error("Provide a SQLite snapshot and a new report path");
if (resolve(source) === resolve(output) || existsSync(output)) throw new Error("Refusing to overwrite an existing file");
const db = new DatabaseSync(source, { readOnly: true });
const versions = db.prepare("SELECT * FROM song_version").all() as ReviewVersion[];
const importSources = new Map(db.prepare("SELECT id,source_id FROM song_import").all().map((r) => [String(r.id), String(r.source_id)]));
const officials = new Map(db.prepare("SELECT id,current_version_id FROM song").all().map((r) => [String(r.id), r.current_version_id ? String(r.current_version_id) : null]));
const archival = buildImportArchival(versions, officials);
const allPairs = buildReviewPairs(versions, importSources);
const comparisons = allPairs.filter((p) => p.kind === "parent").map((p) => ({ ...p, id: p.afterId, parentId: p.beforeId, decision: p.proposed }));
// Separate roots within the same song have no ancestry to justify an automatic merge.
const roots = versions.filter((v) => !v.parent_id);
const rootGroups = Map.groupBy(roots, (v) => v.song_id);
const multipleRoots = [...rootGroups].filter(([, group]) => group.length > 1)
  .map(([songId, group]) => ({ songId, versionIds: group.map((v) => v.id) }));
const summary = { versions: versions.length, comparisons: comparisons.length,
  revisions: comparisons.filter((v) => v.decision === "revision").length,
  review: comparisons.filter((v) => v.decision === "review").length,
  separateImports: allPairs.filter((p) => p.proposed === "separate").length,
  importedVersionsToArchive: archival.reduce((n, p) => n + p.archiveImports.length, 0),
  songsWithMultipleRoots: multipleRoots.length };
writeFileSync(output, JSON.stringify({ policy: "import-curation-v3", summary, comparisons, rootComparisons: allPairs.filter((p) => p.kind === "roots"), multipleRoots, archival }, null, 2));
db.close();
console.log(summary);
