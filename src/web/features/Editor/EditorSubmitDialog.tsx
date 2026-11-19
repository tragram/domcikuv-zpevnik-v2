import { useState } from "react";
import { analyzeSongEdit } from "src/lib/song-edit-analysis";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import type { SongData } from "~/types/songData";
import type { EditorState } from "~/types/types";
import { editorSaveOptions } from "./editor-save-options";

export type EditorSaveChoice = Pick<EditorState, "saveMode" | "archivePreviousOnPublish" | "makeOfficialOnPublish">;

export function EditorSubmitDialog({ song, state, actor, publishing, submitting, onConfirm, onClose }: {
  song: SongData;
  state: EditorState;
  actor: { id: string; isAdmin?: boolean };
  publishing: boolean;
  submitting: boolean;
  onConfirm: (choice: EditorSaveChoice) => void;
  onClose: () => void;
}) {
  // This component mounts only after Submit. Recommendation and user choices
  // belong to this confirmation, never to the continuously edited local draft.
  const [analysis] = useState(() => analyzeSongEdit(song.chordpro, state.chordpro));
  const [choice, setChoice] = useState(() => editorSaveOptions(song, {
    saveMode: song.versionStatus === "pending" ? state.saveMode : undefined,
    archivePreviousOnPublish: song.versionStatus === "pending" ? song.archivePreviousOnPublish : undefined,
    makeOfficialOnPublish: song.versionStatus === "pending" ? song.makeOfficialOnPublish : undefined,
  }, actor, analysis.large));
  const canSelectMode = song.versionStatus !== "pending" || !!song.versionParentId;
  const archiveDisabled = choice.replacesImportedSource || (song.isOfficial && !choice.makeOfficialOnPublish);
  function selectMode(saveMode: "correction" | "new-version") {
    setChoice(editorSaveOptions(song, { saveMode }, actor, analysis.large));
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{publishing ? "Publish changes" : "Submit changes"}</DialogTitle>
        <DialogDescription>Choose how to save this edit before submitting.</DialogDescription>
      </DialogHeader>
      {!choice.canEdit && <p>This draft can only be edited by its author or an admin.</p>}
      {canSelectMode && choice.canEdit ? <fieldset className="space-y-3">
        <legend className="sr-only">Save changes as</legend>
        {choice.canCorrect && <label className="flex items-start gap-2">
          <input type="radio" name="save-mode" checked={choice.saveMode === "correction"} onChange={() => selectMode("correction")} />
          <span>Revision of this version<span className="block text-sm text-muted-foreground">Saved songbooks keep following this version.</span></span>
        </label>}
        <label className="flex items-start gap-2">
          <input type="radio" name="save-mode" checked={choice.saveMode === "new-version"} onChange={() => selectMode("new-version")} />
          <span>Replacement or alternative<span className="block text-sm text-muted-foreground">Create a separately selectable version.</span></span>
        </label>
        <p className="text-sm text-muted-foreground">{choice.canCorrect ? analysis.reason : "This edit needs a separate version."}</p>
      </fieldset> : choice.canEdit ? <p>Your existing draft will be updated.</p> : null}
      {choice.isImported && <p className="text-sm text-muted-foreground">A revision keeps this version and preserves the original imported sheet in its history. Choose a separate version for an alternative arrangement.</p>}
      {canSelectMode && choice.canEdit && choice.saveMode === "new-version" && <div className="space-y-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={choice.makeOfficialOnPublish}
          disabled={choice.isImported && song.isOfficial}
          onChange={(event) => setChoice((previous) => ({ ...previous, makeOfficialOnPublish: event.target.checked,
            archivePreviousOnPublish: song.isOfficial && !event.target.checked ? false : previous.archivePreviousOnPublish }))} />Make official when published</label>
        {(choice.canArchiveSource || choice.replacesImportedSource) && <label className="flex items-center gap-2"><input type="checkbox"
          checked={choice.archivePreviousOnPublish} disabled={archiveDisabled}
          onChange={(event) => setChoice((previous) => ({ ...previous, archivePreviousOnPublish: event.target.checked }))} />Archive previous version when published</label>}
      </div>}
      <DialogFooter>
        <Button variant="outline" disabled={submitting} onClick={onClose}>Cancel</Button>
        <Button disabled={submitting || !choice.canEdit} onClick={() => onConfirm({ saveMode: choice.saveMode,
          archivePreviousOnPublish: choice.archivePreviousOnPublish, makeOfficialOnPublish: choice.makeOfficialOnPublish })}>
          {submitting ? "Saving…" : publishing ? "Publish" : "Submit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
