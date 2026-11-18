// Preview fixtures only. Never opens the regular development or remote database.
// Reruns preserve existing demo edits and add only missing mock songs.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const folder = path.resolve("node_modules/.cache/revision-ui/v3/d1/miniflare-D1DatabaseObject");
const files = fs.readdirSync(folder).filter((name) => name.endsWith(".sqlite"));
if (files.length !== 1) throw new Error("Expected one isolated revision-preview database.");
const db = new DatabaseSync(path.join(folder, files[0]));
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
if (!db.prepare("SELECT id FROM user WHERE id = 'demo'").get()) throw new Error("The isolated demo account is missing.");
db.prepare("SELECT version_id FROM song_submission LIMIT 1").get();
const now = Math.floor(Date.now() / 1000);
const day = 86400;
let added = 0;

const sheet = (title, ending = "domů") => `{start_of_verse}
[C]Večer kreslí [G]stíny na nádraží,
[Am]v kapse nosím [F]malý papír přání.
[C]Každá cesta [G]něco nového mi dává,
[F]tahle píseň [G]tiše zazní [C]${ending}.
{end_of_verse}

{start_of_chorus}
[F]Ještě chvíli [C]zůstaň tady s námi,
[Dm]než se světla [G]rozplynou nad stráněmi.
[F]${title}, [C]až se ráno vrátí,
[G]naše kroky [C]najdou cestu zpátky.
{end_of_chorus}`;

function version(id, songId, title, label, { owner = "demo", status = "published", parent = null, days = 10, description = null, importId = null, key = "C", capo = 0 } = {}) {
  const approved = status === "published" || status === "archived";
  db.prepare(`INSERT INTO song_version
    (id,song_id,parent_id,import_id,status,title,artist,user_id,edited_by,approved_by,approved_at,created_at,updated_at,chordpro,label,description,key,capo,language,tempo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, songId, parent, importId, status, title, "Ukázková kapela", owner, owner,
    approved ? "demo" : null, approved ? now - days * day : null,
    now - days * day, now - days * day, sheet(title), label, description, key, capo, "czech", "96",
  );
  return id;
}

function revise(id, changes, days = 0, editor = "demo") {
  const keys = Object.keys(changes);
  db.prepare(`UPDATE song_version SET ${keys.map((key) => `${key} = ?`).join(", ")}, revision = revision + 1, updated_at = ?, edited_by = ? WHERE id = ?`)
    .run(...Object.values(changes), now - days * day, editor, id);
}

function official(songId, id) {
  db.prepare("UPDATE song SET current_version_id = ?, updated_at = ? WHERE id = ?").run(id, now, songId);
}

function pin(songId, id, key = 2, capo = 3) {
  db.prepare(`INSERT INTO favorites (user_id,song_id,added_at,pinned_version_id,key_index,capo)
    SELECT 'demo',?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM favorites WHERE user_id='demo' AND song_id=?)`)
    .run(songId, now, id, key, capo, songId);
}

function proposal(id, songId, title, source, { intent = "update-parent", stale = false, replacement = false, owner = "mock-petr" } = {}) {
  version(id, songId, title, intent === "update-parent" ? "Oprava textu" : "Nové zpracování", { owner, status: "pending", parent: source, days: 1 });
  revise(id, { chordpro: sheet(title, "za tebou"), description: "Návrh k posouzení. Ukázková data." }, 0, owner);
  const base = source ? db.prepare("SELECT revision FROM song_version WHERE id = ?").get(source).revision : null;
  const current = db.prepare("SELECT current_version_id FROM song WHERE id = ?").get(songId).current_version_id;
  db.prepare(`INSERT INTO song_submission (version_id,submission_intent,base_revision,base_official_version_id,archive_previous_on_publish,make_official_on_publish)
    VALUES (?,?,?,?,?,?)`).run(id, intent, stale ? Math.max(1, base - 1) : base, current, Number(replacement), Number(replacement));
  return id;
}

const titles = ["Noční vlak", "U řeky", "Poslední světlo", "Na kopci", "Ranní déšť", "Cesta domů", "Papírový drak", "Malá kavárna", "Pod hvězdami", "Tiché město", "Zimní oheň", "Ještě jednu"];
db.exec("BEGIN IMMEDIATE");
try {
  for (const [id, name, trusted] of [["mock-jana", "Jana (demo)", 1], ["mock-petr", "Petr (demo)", 0], ["mock-eliska", "Eliška (demo)", 1]]) {
    db.prepare(`INSERT OR IGNORE INTO user (id,name,email,email_verified,created_at,updated_at,nickname,is_trusted,is_admin,last_login)
      VALUES (?,?,?,0,?,?,?, ?,0,?)`).run(id, name, `${id}@example.invalid`, now, now, id, trusted, now);
  }
  for (const [index, title] of titles.entries()) {
    const songId = `mock-song-${String(index + 1).padStart(2, "0")}`;
    if (db.prepare("SELECT id FROM song WHERE id = ?").get(songId)) continue;
    db.prepare("INSERT INTO song (id,created_at,updated_at) VALUES (?,?,?)").run(songId, now - (30 - index) * day, now);
    added++;
    const main = `${songId}-main`;
    const owner = index === 3 ? "mock-petr" : index % 3 === 0 ? "mock-jana" : "demo";
    if (index === 8) {
      proposal(main, songId, title, null, { intent: "new-version" });
      pin(songId, main, 7, 0);
      continue;
    }
    version(main, songId, title, "Základní verze", { owner, days: 20 - index });
    official(songId, main);
    revise(main, { description: "Doplněné akordy a sjednocené značení." }, 6);
    revise(main, { chordpro: sheet(title, "s tebou") }, 3);
    if (index === 0 || index === 4) {
      version(`${songId}-acoustic`, songId, title, "Klidná akustická", { owner, parent: main, days: 2, key: "G", description: "Pomalejší doprovod pro jednu kytaru." });
      version(`${songId}-campfire`, songId, title, "Táborová verze s druhým hlasem", { owner, parent: main, days: 1, key: "D", capo: 2, description: "Jednoduchý doprovod a společný refrén. Obě alternativy zůstávají záměrně dostupné." });
    }
    if (index === 1 || index === 2) proposal(`${songId}-suggestion`, songId, title, main, { stale: index === 2 });
    if (index === 3) proposal(`${songId}-replacement`, songId, title, main, { intent: "new-version", replacement: true });
    if (index === 5) {
      const old = version(`${songId}-old`, songId, title, "Původní táborová", { status: "archived", days: 28, description: "Archivovaná, ale stále připnutá v ukázkovém zpěvníku." });
      pin(songId, old);
    }
    if (index === 6 || index === 7) {
      const closed = proposal(`${songId}-closed`, songId, title, main);
      revise(closed, { status: index === 6 ? "rejected" : "deleted" });
      // Closed proposals retain intent so Restore behaves like the runtime.
    }
    if (index === 9) {
      const merged = proposal(`${songId}-merged`, songId, title, main);
      revise(main, { chordpro: sheet(title, "za tebou"), approved_by: "demo", approved_at: now }, 0, "mock-petr");
      revise(merged, { status: "deleted", merged_into_version_id: main, approved_by: "demo", approved_at: now });
      db.prepare("DELETE FROM song_submission WHERE version_id = ?").run(merged);
      pin(songId, main, 9, 1);
    }
    if (index === 10) {
      for (const [offset, source] of ["pisnicky-akordy", "zpevnik-skorepova", "cifraclub"].entries()) {
        const importId = `${songId}-import-${offset}`;
        db.prepare(`INSERT INTO song_import (id,title,artist,source_id,originalContent,url,created_at,user_id)
          VALUES (?,?,?,?,?,?,?,?)`).run(importId, title, "Ukázková kapela", source, sheet(title), `https://example.invalid/demo/${source}`, now - 10 * day, "mock-eliska");
        version(`${songId}-source-${offset}`, songId, title, null, { importId, owner: "mock-eliska", parent: main, days: 2 + offset });
      }
    }
    if (index === 11) {
      for (let number = 4; number <= 32; number++) {
        revise(main, { chordpro: sheet(title, number % 2 ? "k ránu" : "domů"), description: `Ukázková úprava ${number}: test listování historií a porovnání změn.` }, (32 - number) / 24, number % 2 ? "demo" : "mock-jana");
      }
      pin(songId, main, 0, 0);
    }
  }
  db.exec("COMMIT");
  console.log(JSON.stringify({ addedSongs: added, totals: db.prepare("SELECT (SELECT count(*) FROM song) AS songs, (SELECT count(*) FROM song_version) AS versions, (SELECT count(*) FROM song_submission) AS pendingReviews, (SELECT count(*) FROM song_revision) AS revisions").get() }));
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
