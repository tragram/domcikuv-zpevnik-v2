import type { SongData } from "~/types/songData";
import type { EditorState } from "~/types/types";
import { publicationOptions, versionEditPolicy } from "src/lib/song-version-policy";

type EditableSong = Pick<SongData,
  "externalSource" | "versionStatus" | "versionParentIsImported" |
  "versionAuthorId" | "isOfficial" | "archivePreviousOnPublish" | "makeOfficialOnPublish"
>;

export function editorSaveOptions(
  song: EditableSong | undefined,
  state: Pick<EditorState, "saveMode" | "archivePreviousOnPublish" | "makeOfficialOnPublish">,
  actor: { id: string; isAdmin?: boolean } | undefined,
) {
  const isPending = song?.versionStatus === "pending";
  const isImported = !!song?.externalSource;
  // Once published, a curation is an ordinary local version. Its ancestry
  // matters only while the initial replacement is awaiting publication.
  const replacesImportedSource = isImported || (isPending && !!song?.versionParentIsImported);
  const { canEdit, canCorrect, canManage: canArchiveSource } = versionEditPolicy(song ? {
    pending: isPending, imported: isImported, pendingCuration: isPending && !!song.versionParentIsImported,
    official: song.isOfficial !== false, ownerId: song.versionAuthorId,
  } : undefined, actor);
  const recommendedMode = canCorrect ? "correction" : "new-version";
  const saveMode = state.saveMode ?? recommendedMode;

  let archivePreviousOnPublish = false;
  let makeOfficialOnPublish = false;
  if (saveMode === "new-version") {
    archivePreviousOnPublish = state.archivePreviousOnPublish ??
      (isPending ? !!song?.archivePreviousOnPublish : canArchiveSource);
    makeOfficialOnPublish = state.makeOfficialOnPublish ??
      (isPending ? !!song?.makeOfficialOnPublish : song?.isOfficial === true);
    const resolved = publicationOptions({ archivePrevious: archivePreviousOnPublish, makeOfficial: makeOfficialOnPublish },
      { imported: replacesImportedSource, official: song?.isOfficial === true });
    archivePreviousOnPublish = resolved.archivePrevious;
    makeOfficialOnPublish = resolved.makeOfficial;
  }
  return { isPending, isImported, replacesImportedSource, canEdit, canCorrect, canArchiveSource,
    saveMode, archivePreviousOnPublish, makeOfficialOnPublish };
}
