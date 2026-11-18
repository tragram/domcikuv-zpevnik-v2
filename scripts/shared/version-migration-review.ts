import { createHash } from "node:crypto";
import { classifyVersionMigration } from "./version-migration-classifier";

export type ReviewVersion = {
  id: string; parent_id: string | null; song_id: string; title: string;
  artist: string; status: string; chordpro: string; [key: string]: unknown;
};
export type ReviewChoice = "revision" | "separate" | "unresolved";
export type ReviewDecision = {
  beforeId: string; afterId: string; beforeHash: string; afterHash: string;
  choice: ReviewChoice; note: string; updatedAt: string;
};
export function versionHash(version: ReviewVersion) {
  return createHash("sha256").update(JSON.stringify(Object.entries(version).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
}
export function buildReviewPairs(versions: ReviewVersion[], importSources: ReadonlyMap<string, string> = new Map()) {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const differentSources = (a: ReviewVersion, b: ReviewVersion) => {
    const left = importSources.get(String(a.import_id ?? "")), right = importSources.get(String(b.import_id ?? ""));
    return !!left && !!right && left !== right;
  };
  const pairs: { beforeId: string; afterId: string; kind: "parent" | "roots"; reason: string; proposed: "revision" | "review" | "separate" }[] = [];
  for (const child of versions) {
    if (!child.parent_id) continue;
    const parent = byId.get(child.parent_id);
    const result = parent && parent.song_id === child.song_id
      ? differentSources(parent, child)
        ? { decision: "separate" as const, reason: "Raw imports from different sources" }
        : child.import_id
        ? { decision: "review" as const, reason: "Raw import; not a curated edit" }
        : parent.import_id
        ? { decision: "revision" as const, reason: "Imported parent → curated revision" }
        : classifyVersionMigration(parent.chordpro, child.chordpro)
      : { decision: "review" as const, reason: "Missing or cross-song parent" };
    pairs.push({ beforeId: child.parent_id, afterId: child.id, kind: "parent", reason: result.reason, proposed: result.decision });
  }
  for (const roots of Map.groupBy(versions.filter((v) => !v.parent_id), (v) => v.song_id).values()) {
    roots.sort((a, b) => Number(a.created_at) - Number(b.created_at) || a.id.localeCompare(b.id));
    for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) {
      const separate = differentSources(roots[i], roots[j]);
      pairs.push({ beforeId: roots[i].id, afterId: roots[j].id, kind: "roots", reason: separate ? "Raw imports from different sources" : "Independent versions without a parent link", proposed: separate ? "separate" : "review" });
    }
  }
  return pairs.map((p) => {
    const before = byId.get(p.beforeId), after = byId.get(p.afterId)!;
    return { ...p, key: JSON.stringify([p.beforeId, p.afterId]), beforeHash: before ? versionHash(before) : "missing", afterHash: versionHash(after), title: after.title, songId: after.song_id };
  });
}

// Lifecycle proposal independent of whether two histories are consolidated.
// Only approved, live curation retires live raw imports. Preserve pins and links;
// pending/rejected/deleted records are not silently approved or withdrawn.
export function buildImportArchival(versions: ReviewVersion[], officials: ReadonlyMap<string, string | null>) {
  return [...Map.groupBy(versions, (v) => v.song_id)].flatMap(([songId, group]) => {
    const curated = group.filter((v) => !v.import_id && v.status === "published");
    const imports = group.filter((v) => !!v.import_id && v.status === "published");
    if (!curated.length || !imports.length) return [];
    const previousOfficialId = officials.get(songId) ?? null;
    const survivor = curated.find((v) => v.id === previousOfficialId) ?? curated.sort((a, b) => Number(b.approved_at ?? b.updated_at ?? b.created_at ?? 0) - Number(a.approved_at ?? a.updated_at ?? a.created_at ?? 0) || a.id.localeCompare(b.id))[0];
    return [{ songId, title: survivor.title, curatedId: survivor.id, curatedHash: versionHash(survivor), previousOfficialId,
      archiveImports: imports.map((v) => ({ id: v.id, hash: versionHash(v) })), preservePins: true }];
  });
}
export function decisionMatches(decision: ReviewDecision, pair: { beforeHash: string; afterHash: string; beforeId: string; afterId: string }) {
  return decision.beforeId === pair.beforeId && decision.afterId === pair.afterId && decision.beforeHash === pair.beforeHash && decision.afterHash === pair.afterHash;
}
