import { and, eq, ne, sql, desc, asc } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  song,
  songVersion,
  songSubmission,
  songRevision,
  songImport,
  userFavoriteSongs,
} from "src/lib/db/schema";
import type { SongRevisionContent, SongVersionDB } from "src/lib/db/schema";
import type { EditorSubmitSchema } from "src/lib/contracts/editor-schema";
import type { AppDatabase } from "../../api/utils";
import { isCorrectionSubmission, publicationOptions, submissionReview, versionEditPolicy } from "src/lib/song-version-policy";
import {
  conflict,
  contentOf,
  loadVersion,
  officialCondition,
  reviseVersion,
  sameContent,
  versionActor,
  withVersionConflict,
} from "./revisions";

export async function saveSongVersion(
  db: AppDatabase,
  input: EditorSubmitSchema,
  songId: string,
  userId: string,
  importId?: string,
  options?: { editAsPreviousAuthor?: boolean; editAsSubmitter?: boolean; publish?: boolean },
) {
  const [actor, parent] = await Promise.all([
    versionActor(db, userId),
    db.query.song.findFirst({ where: eq(song.id, songId) }),
  ]);
  if (!parent || parent.deleted)
    throw new HTTPException(404, { message: "Song not found" });
  const baseId = input.baseVersionId ?? input.parentId;
  const base = baseId ? await loadVersion(db, songId, baseId) : undefined;
  if (base && input.expectedRevision !== base.revision) throw conflict();
  if (
    base?.status === "deleted" ||
    base?.status === "rejected" ||
    base?.mergedIntoVersionId
  )
    throw new HTTPException(400, {
      message: "This version is closed. Restore it before editing.",
    });
  const trusted = actor.isTrusted || actor.isAdmin;
  if (options?.publish && !trusted)
    throw new HTTPException(403, { message: "Admin approval required." });
  const owns = base?.userId === userId;
  const canManage = owns || actor.isAdmin;
  const attribution = actor.isAdmin
    ? options?.editAsPreviousAuthor ?? (base?.status === "pending" ? options?.editAsSubmitter : undefined)
    : undefined;
  const content: SongRevisionContent = {
    title: input.title,
    artist: input.artist,
    chordpro: input.chordpro,
    key: input.key,
    language: input.language,
    capo: input.capo,
    range: input.range,
    startMelody: input.startMelody,
    tempo: input.tempo,
    youtubeId: input.youtubeId,
    label: input.label === undefined ? (base?.label ?? null) : input.label,
    description:
      input.description === undefined
        ? (base?.description ?? null)
        : input.description,
  };
  // Import fetches reuse the first source copy. Manual corrections use the
  // normal revision path below and preserve the source provenance.
  if (importId) {
    const incoming = await db.query.songImport.findFirst({ where: eq(songImport.id, importId) });
    if (!incoming) throw new HTTPException(404, { message: "Import not found" });
    const copies = await db.query.songVersion.findMany({ where: eq(songVersion.songId, songId), with: { songImport: true }, orderBy: [asc(songVersion.createdAt), asc(songVersion.id)] });
    const copy = copies.find(v => v.status !== "deleted" && !v.mergedIntoVersionId && v.songImport?.sourceId === incoming.sourceId && v.songImport.url === incoming.url);
    if (copy && !(trusted || (copy.status === "pending" && copy.userId === userId))) {
      throw new HTTPException(409, { message: "This source is already imported. Edit the existing version instead." });
    }
    if (copy && (trusted || (copy.status === "pending" && copy.userId === userId))) {
      // Re-importing reuses the original identity; it must not overwrite later edits.
      return loadVersion(db, songId, copy.id);
    }
  }
  // Approving an untouched source copy is publication, not curation. Preserve
  // its ID, import marker and submitter just like the direct approval endpoint.
  if (base?.importId && base.status === "pending" && options?.publish && sameContent(base, content)) {
    const changeAuthor = attribution === false && !owns;
    if (changeAuthor) {
      await withVersionConflict(() => db.batch([
        reviseVersion(db, base, { userId }, userId, parent.currentVersionId),
      ]));
    }
    return approveVersion(db, songId, base.id, userId, {
      expectedRevision: base.revision + Number(changeAuthor),
    });
  }
  const isDraft = base?.status === "pending" && (!base.importId || owns || actor.isAdmin);
  const source = isDraft && base.parentId ? await loadVersion(db, songId, base.parentId) : base;
  const importedSource = !!source?.importId && !importId;
  const mode = input.saveMode ?? "correction";
  const editPolicy = versionEditPolicy(base ? { pending: base.status === "pending", imported: !!base.importId,
    pendingCuration: isDraft && importedSource, official: base.id === parent.currentVersionId, ownerId: base.userId } : undefined, actor);
  if (!editPolicy.canEdit)
    throw new HTTPException(403, {
      message: "You cannot edit another author's draft.",
    });
  if (base && mode === "correction" && !editPolicy.canCorrect)
    throw new HTTPException(403, {
      message:
        "Create a separate version to change another author's alternative.",
    });
  const { archivePrevious: archive, makeOfficial } = publicationOptions({
    archivePrevious: input.archivePreviousOnPublish ?? (isDraft ? base.archivePreviousOnPublish : false),
    makeOfficial: input.makeOfficialOnPublish ?? (isDraft ? base.makeOfficialOnPublish : false),
  }, { imported: importedSource && mode === "new-version", official: source?.id === parent.currentVersionId });
  if (archive && source && !source.importId && source.userId !== userId && !actor.isAdmin)
    throw new HTTPException(403, {
      message: "You cannot archive another author's version.",
    });
  if (archive && source?.id === parent.currentVersionId && !makeOfficial)
    throw new HTTPException(400, {
      message:
        "Select a replacement official version before archiving the current one.",
    });
  if (base && !isDraft && mode === "correction" && sameContent(base, content) && (attribution !== false || owns))
    return base;

  if (base && (isDraft || (mode === "correction" && canManage && trusted))) {
    const intent = isDraft
      ? mode === "correction" && base.parentId
        ? "update-parent"
        : "new-version"
      : base.submissionIntent;
    if (
      intent === "update-parent" &&
      source &&
      source.id !== parent.currentVersionId &&
      source.userId !== userId &&
      !actor.isAdmin
    )
      throw new HTTPException(403, {
        message:
          "Create a separate version to change another author's alternative.",
      });
    const author = attribution === false ? userId : base.userId;
    const changed =
      !sameContent(base, content) ||
      author !== base.userId ||
      (isDraft &&
        (intent !== base.submissionIntent ||
          archive !== base.archivePreviousOnPublish ||
          makeOfficial !== base.makeOfficialOnPublish));
    if (changed)
      await withVersionConflict(() =>
        db.batch([
          reviseVersion(
            db,
            base,
            {
              ...content,
              userId: author,
              ...(!isDraft
                ? { approvedBy: userId, approvedAt: new Date() }
                : {}),
            },
            userId,
            parent.currentVersionId,
          ),
          ...(isDraft
            ? [
                db
                  .insert(songSubmission)
                  .values({
                    versionId: base.id,
                    submissionIntent: intent,
                    baseRevision: base.baseRevision ?? null,
                    baseOfficialVersionId: base.baseOfficialVersionId ?? null,
                    archivePreviousOnPublish: archive,
                    makeOfficialOnPublish: makeOfficial,
                  })
                  .onConflictDoUpdate({
                    target: songSubmission.versionId,
                    set: {
                      submissionIntent: intent,
                      archivePreviousOnPublish: archive,
                      makeOfficialOnPublish: makeOfficial,
                    },
                  }),
              ]
            : []),
          db
            .update(song)
            .set({ updatedAt: new Date() })
            .where(eq(song.id, songId)),
        ]),
      );
    if (isDraft && options?.publish)
      return approveVersion(db, songId, base.id, userId, {
        expectedRevision: base.revision + Number(changed),
      });
    return loadVersion(db, songId, base.id);
  }

  const pendingCorrection = !!base && mode === "correction";
  const published = trusted && !pendingCorrection;
  const id = crypto.randomUUID();
  // A stale source or official pointer aborts creation, rather than leaving a
  // half-published replacement. IDs are NOT NULL in the existing SQLite schema.
  const sourceGuard = base
    ? sql`and exists(select 1 from ${songVersion} where ${songVersion.id} = ${base.id} and ${songVersion.revision} = ${base.revision})`
    : sql``;
  const guardedId = sql<string>`case when exists(select 1 from ${song} where ${officialCondition(songId, parent.currentVersionId)}) ${sourceGuard} then ${id} else null end`;
  const now = new Date();
  const insert = db.insert(songVersion).values({
    ...content,
    id: guardedId,
    songId,
    parentId: base?.id ?? null,
    importId: importId ?? null,
    userId: base && (attribution === true || (base.status === "pending" && actor.isAdmin && attribution === undefined))
      ? base.userId : userId,
    editedBy: userId,
    status: published ? "published" : "pending",
    approvedBy: published ? userId : null,
    approvedAt: published ? now : null,
    createdAt: now,
    updatedAt: now,
  });
  await withVersionConflict(async () => {
    // Keep the tuple explicit; Drizzle batches accept heterogeneous statements.
    if (published && archive && base)
      await db.batch([
        insert,
        reviseVersion(db, base, { status: "archived" }, userId),
        db
          .update(song)
          .set({
            updatedAt: now,
            currentVersionId:
              makeOfficial || !parent.currentVersionId
                ? id
                : parent.currentVersionId,
          })
          .where(eq(song.id, songId)),
      ]);
    else
      await db.batch([
        insert,
        ...(published
          ? []
          : [
              db.insert(songSubmission).values({
                versionId: id,
                submissionIntent: pendingCorrection
                  ? "update-parent"
                  : "new-version",
                baseRevision: base?.revision ?? null,
                baseOfficialVersionId: parent.currentVersionId,
                archivePreviousOnPublish: archive,
                makeOfficialOnPublish: makeOfficial,
              }),
            ]),
        db
          .update(song)
          .set({
            updatedAt: now,
            currentVersionId:
              published && (makeOfficial || !parent.currentVersionId)
                ? id
                : parent.currentVersionId,
          })
          .where(eq(song.id, songId)),
      ]);
  });
  return loadVersion(db, songId, id);
}

export type ApprovalOptions = {
  expectedRevision: number;
  expectedOfficialId?: string | null; expectedTargetRevision?: number;
  force?: boolean;
  makeOfficial?: boolean;
  archivePrevious?: boolean;
};

// Consolidation applies only to local versions. Keep the destination identity,
// delete the consumed source, and preserve both histories and personal settings.
export async function mergeVersion(
  db: AppDatabase,
  songId: string,
  sourceId: string,
  targetId: string,
  userId: string,
  expectedSourceRevision: number,
  expectedTargetRevision: number,
) {
  const [source, target, actor, parent] = await Promise.all([
    loadVersion(db, songId, sourceId),
    loadVersion(db, songId, targetId),
    versionActor(db, userId),
    db.query.song.findFirst({
      where: and(eq(song.id, songId), eq(song.deleted, false)),
    }),
  ]);
  if (!actor.isAdmin)
    throw new HTTPException(403, {
      message: "Admin required to merge versions.",
    });
  if (!parent) throw new HTTPException(404, { message: "Song not found" });
  if (
    source.revision !== expectedSourceRevision ||
    target.revision !== expectedTargetRevision
  )
    throw conflict();
  if (
    source.id === target.id ||
    source.mergedIntoVersionId ||
    source.importId ||
    target.mergedIntoVersionId ||
    !["pending", "published", "archived"].includes(source.status) ||
    !["published", "archived"].includes(target.status)
  )
    throw new HTTPException(400, {
      message: "Choose an available source and an approved destination.",
    });
  const now = new Date();
  await withVersionConflict(() =>
    db.batch([
      reviseVersion(
        db,
        target,
        {
          ...contentOf(source),
          label: target.label,
          description: target.description,
          status:
            parent.currentVersionId === source.id ? "published" : target.status,
          approvedBy: userId,
          approvedAt: now,
        },
        source.userId,
        parent.currentVersionId,
      ),
      reviseVersion(
        db,
        source,
        {
          status: "deleted",
          mergedIntoVersionId: target.id,
          approvedBy: userId,
          approvedAt: now,
        },
        userId,
      ),
      db.delete(songSubmission).where(eq(songSubmission.versionId, source.id)),
      db
        .update(userFavoriteSongs)
        .set({ pinnedVersionId: target.id })
        .where(
          and(
            eq(userFavoriteSongs.pinnedVersionId, source.id),
            eq(userFavoriteSongs.songId, songId),
          ),
        ),
      db
        .update(song)
        .set({
          updatedAt: now,
          currentVersionId:
            parent.currentVersionId === source.id
              ? target.id
              : parent.currentVersionId,
        })
        .where(eq(song.id, songId)),
    ]),
  );
  return loadVersion(db, songId, target.id);
}

// A misclassified alternative is a correction to its recorded parent. The
// caller reviews both sheets; there is no client-selected destination and no
// intermediate change to what public songbooks currently display.
export async function reclassifyVersion(
  db: AppDatabase,
  songId: string,
  sourceId: string,
  userId: string,
  expectedRevision: number,
  expectedParentRevision: number,
) {
  const source = await loadVersion(db, songId, sourceId);
  if (!source.parentId) throw new HTTPException(400, { message: "This version has no parent to correct." });
  return mergeVersion(db, songId, sourceId, source.parentId, userId, expectedRevision, expectedParentRevision);
}

export async function approveVersion(
  db: AppDatabase,
  songId: string,
  versionId: string,
  userId: string,
  options: ApprovalOptions,
) {
  const [proposal, actor, parent] = await Promise.all([
    loadVersion(db, songId, versionId),
    versionActor(db, userId),
    db.query.song.findFirst({
      where: and(eq(song.id, songId), eq(song.deleted, false)),
    }),
  ]);
  if (!parent) throw new HTTPException(404, { message: "Song not found" });
  if (proposal.status !== "pending")
    throw new HTTPException(400, {
      message: "Only pending submissions can be approved.",
    });
  if (proposal.revision !== options.expectedRevision) throw conflict();
  const source = proposal.parentId ? await loadVersion(db, songId, proposal.parentId) : null;
  const importedSource = !proposal.importId && !!source?.importId;
  const review = submissionReview(proposal, !!source?.importId);
  if (!review) throw new HTTPException(400, {
    message: "Submission metadata is incomplete or invalid. Classify it during migration before approval.",
  });
  const correction = isCorrectionSubmission(review);
  if (!actor.isAdmin && !(actor.isTrusted && proposal.userId === userId))
    throw new HTTPException(403, { message: "Admin approval required." });
  if (
    !actor.isAdmin &&
    (options.makeOfficial !== undefined ||
      options.archivePrevious !== undefined)
  )
    throw new HTTPException(403, {
      message: "Only admins can override publication requests.",
    });
  const { makeOfficial, archivePrevious } = publicationOptions({
    makeOfficial: options.makeOfficial ?? review.publication.makeOfficial,
    archivePrevious: options.archivePrevious ?? review.publication.archivePrevious,
  }, { imported: importedSource, official: source?.id === parent.currentVersionId });
  const now = new Date();
  if (correction) {
    if (!proposal.parentId)
      throw new HTTPException(400, {
        message: "The correction has no target.",
      });
    const target = await loadVersion(db, songId, proposal.parentId);
    if (!actor.isAdmin && target.userId !== userId)
      throw new HTTPException(403, {
        message: "Admin approval required to correct another author's version.",
      });
    if (
      !["published", "archived"].includes(target.status) ||
      target.mergedIntoVersionId
    )
      throw new HTTPException(400, {
        message: "The target is no longer available.",
      });
    // A correction changes only its target's content. Selecting a different
    // official version does not change what this proposal is correcting.
    const stale = target.revision !== review.baseRevision;
    if (stale && (!actor.isAdmin || !options.force)) throw conflict();
    if (options.force && options.expectedTargetRevision !== target.revision)
      throw conflict();
    await withVersionConflict(() =>
      db.batch([
        reviseVersion(
          db,
          target,
          { ...contentOf(proposal), approvedBy: userId, approvedAt: now },
          proposal.userId,
        ),
        reviseVersion(
          db,
          proposal,
          {
            status: "deleted",
            mergedIntoVersionId: target.id,
            approvedBy: userId,
            approvedAt: now,
          },
          userId,
        ),
        db
          .delete(songSubmission)
          .where(eq(songSubmission.versionId, proposal.id)),
        db
          .update(userFavoriteSongs)
          .set({ pinnedVersionId: target.id })
          .where(
            and(
              eq(userFavoriteSongs.pinnedVersionId, proposal.id),
              eq(userFavoriteSongs.songId, songId),
            ),
          ),
        db.update(song).set({ updatedAt: now }).where(eq(song.id, songId)),
      ]),
    );
    return loadVersion(db, songId, target.id);
  }
  if (!correction && (archivePrevious || makeOfficial) &&
      (options.force || options.expectedOfficialId !== undefined) &&
      options.expectedOfficialId !== parent.currentVersionId) throw conflict();
  if (source && (archivePrevious || makeOfficial)) {
    const stale =
      source.revision !== proposal.baseRevision ||
      parent.currentVersionId !== proposal.baseOfficialVersionId;
    if (stale && (!actor.isAdmin || !options.force)) throw conflict();
    if (options.force && options.expectedTargetRevision !== source.revision)
      throw conflict();
    if (
      source.mergedIntoVersionId ||
      !["published", "archived", ...(source.importId ? ["pending"] : [])].includes(source.status)
    )
      throw new HTTPException(400, {
        message: "The replacement source is no longer available.",
      });
  }
  if (
    source &&
    archivePrevious &&
    source.id === parent.currentVersionId &&
    !makeOfficial
  )
    throw new HTTPException(400, {
      message: "An official replacement is required.",
    });
  const publish = reviseVersion(
    db,
    proposal,
    { status: "published", approvedBy: userId, approvedAt: now },
    userId,
    parent.currentVersionId,
  );
  const select = db
    .update(song)
    .set({
      updatedAt: now,
      currentVersionId:
        makeOfficial || !parent.currentVersionId
          ? proposal.id
          : parent.currentVersionId,
    })
    .where(eq(song.id, songId));
  await withVersionConflict(async () => {
    if (source && archivePrevious)
      await db.batch([
        publish,
        db
          .delete(songSubmission)
          .where(eq(songSubmission.versionId, proposal.id)),
        reviseVersion(db, source, { status: "archived" }, userId),
        select,
      ]);
    else
      await db.batch([
        publish,
        db
          .delete(songSubmission)
          .where(eq(songSubmission.versionId, proposal.id)),
        select,
      ]);
  });
  return loadVersion(db, songId, proposal.id);
}

export async function setOfficialVersion(
  db: AppDatabase,
  songId: string,
  versionId: string,
  userId: string,
  expectedRevision: number,
) {
  const [version, actor, parent] = await Promise.all([
    loadVersion(db, songId, versionId),
    versionActor(db, userId),
    db.query.song.findFirst({ where: eq(song.id, songId) }),
  ]);
  if (!actor.isAdmin && !actor.isTrusted)
    throw new HTTPException(403, { message: "Trusted user required." });
  if (
    !parent ||
    parent.deleted ||
    version.status !== "published" ||
    version.mergedIntoVersionId
  )
    throw new HTTPException(400, {
      message: "Select a published version of an available song.",
    });
  if (version.revision !== expectedRevision) throw conflict();
  if (parent.currentVersionId === versionId) return version;
  // Official selection belongs to the song, not to the sheet's revision
  // history. A single conditional write guards both the pointer and the sheet.
  const updated = await db.update(song)
    .set({ currentVersionId: versionId, updatedAt: new Date() })
    .where(and(
      officialCondition(songId, parent.currentVersionId),
      sql`exists (select 1 from ${songVersion} where ${songVersion.id} = ${versionId}
        and ${songVersion.songId} = ${songId} and ${songVersion.revision} = ${expectedRevision}
        and ${songVersion.status} = 'published' and ${songVersion.mergedIntoVersionId} is null)`,
    ))
    .returning({ id: song.id }).get();
  if (!updated) throw conflict();
  return version;
}

export async function changeVersionStatus(
  db: AppDatabase,
  songId: string,
  versionId: string,
  userId: string,
  action: "archive" | "restore" | "reject" | "delete",
  expectedRevision: number,
  fallbackStatus?: "published" | "archived" | "pending",
) {
  const [version, actor, parent] = await Promise.all([
    loadVersion(db, songId, versionId),
    versionActor(db, userId),
    db.query.song.findFirst({ where: eq(song.id, songId) }),
  ]);
  if (!parent || parent.deleted)
    throw new HTTPException(404, { message: "Song not found" });
  if (version.revision !== expectedRevision) throw conflict();
  if (!actor.isAdmin && version.userId !== userId)
    throw new HTTPException(403, { message: "Owner or admin required." });
  if (version.status === "deleted" && !actor.isAdmin)
    throw new HTTPException(403, {
      message: "Admin required to restore deleted records.",
    });
  // Admin deletion only hides a consumed source. Its merge link and immutable
  // history stay intact, and restoration into a duplicate remains forbidden.
  if (version.mergedIntoVersionId && action !== "delete")
    throw new HTTPException(400, {
      message: "This proposal has already been applied.",
    });
  if (parent.currentVersionId === versionId)
    throw new HTTPException(400, {
      message: "Select another official version first.",
    });
  let status: SongVersionDB["status"];
  let explicitRestore = false;
  if (action === "restore" && version.status === "deleted") {
    const previous = await db.query.songRevision.findFirst({
      where: and(eq(songRevision.versionId, versionId), ne(songRevision.status, "deleted")),
      orderBy: [desc(songRevision.number)],
      columns: { status: true },
    });
    const prior = previous?.status;
    if (prior === "published" || prior === "archived" || prior === "pending" || prior === "rejected") {
      status = prior;
    } else {
      if (!fallbackStatus) throw new HTTPException(422, { message: "Choose a restoration status. History begins after deletion." });
      status = fallbackStatus;
      explicitRestore = true;
    }
  } else if (action === "archive" && version.status === "published")
    status = "archived";
  else if (
    action === "restore" &&
    ["archived", "rejected"].includes(version.status)
  )
    status =
      version.status === "archived" && version.approvedAt
        ? "published"
        : "pending";
  else if (action === "reject" && actor.isAdmin && version.status === "pending")
    status = "rejected";
  else if (
    action === "delete" &&
    (actor.isAdmin || version.status === "pending")
  )
    status = "deleted";
  else throw new HTTPException(400, { message: "Invalid version transition." });
  await withVersionConflict(() =>
    db.batch([
      reviseVersion(db, version, { status, ...(explicitRestore && status !== "pending" ? { approvedAt: new Date(), approvedBy: userId } : {}) }, userId, parent.currentVersionId),
      ...(explicitRestore && status === "pending" && !version.submissionIntent
        ? [db.insert(songSubmission).values({ versionId, submissionIntent: "new-version", baseOfficialVersionId: parent.currentVersionId }).onConflictDoUpdate({ target: songSubmission.versionId, set: { submissionIntent: "new-version" } })]
        : []),
      ...(["pending", "rejected", "deleted"].includes(status)
        ? []
        : [
            db
              .delete(songSubmission)
              .where(eq(songSubmission.versionId, versionId)),
          ]),
      db.update(song).set({ updatedAt: new Date() }).where(eq(song.id, songId)),
    ]),
  );
  return loadVersion(db, songId, versionId);
}
