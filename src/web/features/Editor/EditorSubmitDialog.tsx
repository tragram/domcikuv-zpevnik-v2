import { useState } from "react";
import { PublicationOption, VersionPublicationOptions } from "~/components/VersionPublicationOptions";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { RadioGroup, RadioGroupOption } from "~/components/ui/radio-group";
import type { SongData } from "~/types/songData";
import type { EditorState } from "~/types/types";
import { VersionDetailsFields, type VersionDetails } from "./components/VersionDetailsFields";
import { useEditorValidation } from "./components/use-editor-validation";
import { editorSaveOptions } from "./editor-save-options";

export type EditorSaveChoice = Pick<EditorState, "saveMode" | "archivePreviousOnPublish" | "makeOfficialOnPublish"> & VersionDetails & {
  editAsPreviousAuthor?: boolean;
  addToFavorites: boolean;
};

export function EditorSubmitDialog({ song, state, actor, publishing, submitting, onConfirm, onClose }: {
  song: SongData;
  state: EditorState;
  actor: { id: string; isAdmin?: boolean };
  publishing: boolean;
  submitting: boolean;
  onConfirm: (choice: EditorSaveChoice) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState(() => editorSaveOptions(song, {
    saveMode: song.versionStatus === "pending" ? state.saveMode : undefined,
    archivePreviousOnPublish: song.versionStatus === "pending" ? song.archivePreviousOnPublish : undefined,
    makeOfficialOnPublish: song.versionStatus === "pending" ? song.makeOfficialOnPublish : undefined,
  }, actor));
  const [attribution, setAttribution] = useState<boolean>();
  const [addToFavorites, setAddToFavorites] = useState(true);
  const editAsPreviousAuthor = actor.isAdmin
    ? song.versionAuthorId === actor.id || (attribution ?? (choice.isPending || choice.saveMode === "correction"))
    : undefined;
  const [versionDetails, setVersionDetails] = useState<VersionDetails>(() => ({
    label: state.label,
    description: state.description,
  }));
  const canSelectMode = song.versionStatus !== "pending" || !!song.versionParentId;
  const showVersionDetails = canSelectMode && choice.canEdit && choice.saveMode === "new-version";
  const { fieldErrors } = useEditorValidation({ ...state, ...versionDetails });
  const archiveDisabled = choice.replacesImportedSource || (song.isOfficial && !choice.makeOfficialOnPublish);
  function selectMode(saveMode: string) {
    if (saveMode === "correction" || saveMode === "new-version") {
      setChoice(editorSaveOptions(song, { saveMode }, actor));
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{publishing ? "Publish changes" : "Submit changes"}</DialogTitle>
        <DialogDescription>Choose how to save this edit before submitting.</DialogDescription>
      </DialogHeader>
      {!choice.canEdit && <p>This draft can only be edited by its author or an admin.</p>}
      {canSelectMode && choice.canEdit ? <div className="space-y-3">
        <RadioGroup aria-label="Save changes as" value={choice.saveMode} disabled={submitting} onValueChange={selectMode}>
          {choice.canCorrect && <RadioGroupOption
            value="correction"
            label="Revision of this version"
            description="Saved songbooks keep following this version."
          />}
          <RadioGroupOption
            value="new-version"
            label="Replacement or alternative"
            description="Create a separately selectable version."
          />
        </RadioGroup>
      </div> : choice.canEdit ? <p>Your existing draft will be updated.</p> : null}
      {song.externalSource && <p className="text-sm text-muted-foreground">A revision keeps this version and preserves the original imported sheet in its history. Choose a separate version for an alternative arrangement.</p>}
      {showVersionDetails && <fieldset className="min-w-0 space-y-2" disabled={submitting}>
        <legend className="text-sm font-medium">Version details <span className="font-normal text-muted-foreground">(optional)</span></legend>
        <VersionDetailsFields
          details={versionDetails}
          defaults={state}
          errors={fieldErrors}
          onChange={(field, value) => setVersionDetails((previous) => ({ ...previous, [field]: value }))}
        />
      </fieldset>}
      {showVersionDetails && <VersionPublicationOptions>
        <PublicationOption
          label="Make official when published"
          checked={choice.makeOfficialOnPublish}
          disabled={submitting || (choice.isImported && song.isOfficial)}
          onCheckedChange={(checked) => setChoice((previous) => ({ ...previous, makeOfficialOnPublish: checked,
            archivePreviousOnPublish: song.isOfficial && !checked ? false : previous.archivePreviousOnPublish }))}
        />
        {(choice.canArchiveSource || choice.replacesImportedSource) && <PublicationOption
          label="Archive previous version when published"
          checked={choice.archivePreviousOnPublish}
          disabled={submitting || archiveDisabled}
          onCheckedChange={(checked) => setChoice((previous) => ({ ...previous, archivePreviousOnPublish: checked }))}
        />}
      </VersionPublicationOptions>}
      {choice.canEdit && <div className="space-y-3">
        {actor.isAdmin && <PublicationOption
          label="Edit as previous author"
          description={song.externalSource && (choice.isPending || choice.saveMode === "correction")
            ? "The first revision to an imported sheet is credited to its editor."
            : undefined}
          checked={editAsPreviousAuthor === true}
          disabled={submitting || song.versionAuthorId === actor.id}
          onCheckedChange={setAttribution}
        />}
        <PublicationOption
          label="Add to your favorites"
          checked={addToFavorites}
          disabled={submitting}
          onCheckedChange={setAddToFavorites}
        />
      </div>}
      <DialogFooter>
        <Button variant="outline" disabled={submitting} onClick={onClose}>Cancel</Button>
        <Button disabled={submitting || !choice.canEdit || (showVersionDetails && !!(fieldErrors.label || fieldErrors.description))}
          onClick={() => onConfirm({ saveMode: choice.saveMode,
            archivePreviousOnPublish: choice.archivePreviousOnPublish, makeOfficialOnPublish: choice.makeOfficialOnPublish,
            editAsPreviousAuthor, addToFavorites,
            ...(showVersionDetails ? versionDetails : {}) })}>
          {submitting ? "Saving…" : publishing ? "Publish" : "Submit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
