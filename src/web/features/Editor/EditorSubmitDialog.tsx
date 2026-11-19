import { useId, useState } from "react";
import { analyzeSongEdit } from "src/lib/song-edit-analysis";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupOption } from "~/components/ui/radio-group";
import type { SongData } from "~/types/songData";
import type { EditorState } from "~/types/types";
import { VersionDetailsFields, type VersionDetails } from "./components/VersionDetailsFields";
import { useEditorValidation } from "./components/use-editor-validation";
import { editorSaveOptions } from "./editor-save-options";

export type EditorSaveChoice = Pick<EditorState, "saveMode" | "archivePreviousOnPublish" | "makeOfficialOnPublish"> & VersionDetails;

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
  const [versionDetails, setVersionDetails] = useState<VersionDetails>(() => ({
    label: state.label,
    description: state.description,
  }));
  const canSelectMode = song.versionStatus !== "pending" || !!song.versionParentId;
  const showVersionDetails = canSelectMode && choice.canEdit && choice.saveMode === "new-version";
  const { fieldErrors } = useEditorValidation({ ...state, ...versionDetails });
  const publicationId = useId();
  const archiveDisabled = choice.replacesImportedSource || (song.isOfficial && !choice.makeOfficialOnPublish);
  function selectMode(saveMode: string) {
    if (saveMode === "correction" || saveMode === "new-version") {
      setChoice(editorSaveOptions(song, { saveMode }, actor, analysis.large));
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
        <p className="text-sm text-muted-foreground">{choice.canCorrect ? analysis.reason : "This edit needs a separate version."}</p>
      </div> : choice.canEdit ? <p>Your existing draft will be updated.</p> : null}
      {choice.isImported && <p className="text-sm text-muted-foreground">A revision keeps this version and preserves the original imported sheet in its history. Choose a separate version for an alternative arrangement.</p>}
      {showVersionDetails && <fieldset className="min-w-0 space-y-2" disabled={submitting}>
        <legend className="text-sm font-medium">Version details <span className="font-normal text-muted-foreground">(optional)</span></legend>
        <VersionDetailsFields
          details={versionDetails}
          defaults={state}
          errors={fieldErrors}
          onChange={(field, value) => setVersionDetails((previous) => ({ ...previous, [field]: value }))}
        />
      </fieldset>}
      {showVersionDetails && <fieldset className="grid min-w-0 gap-3 rounded-lg border border-border bg-background/30 px-3 pt-2 pb-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">Publication options</legend>
        <div className="flex items-center gap-3">
          <Checkbox id={`${publicationId}-official`} checked={choice.makeOfficialOnPublish}
            disabled={submitting || (choice.isImported && song.isOfficial)}
            onCheckedChange={(checked) => setChoice((previous) => ({ ...previous, makeOfficialOnPublish: checked === true,
              archivePreviousOnPublish: song.isOfficial && checked !== true ? false : previous.archivePreviousOnPublish }))} />
          <Label htmlFor={`${publicationId}-official`} className="cursor-pointer leading-snug">Make official when published</Label>
        </div>
        {(choice.canArchiveSource || choice.replacesImportedSource) && <div className="flex items-center gap-3">
          <Checkbox id={`${publicationId}-archive`} checked={choice.archivePreviousOnPublish} disabled={submitting || archiveDisabled}
            onCheckedChange={(checked) => setChoice((previous) => ({ ...previous, archivePreviousOnPublish: checked === true }))} />
          <Label htmlFor={`${publicationId}-archive`} className="cursor-pointer leading-snug">Archive previous version when published</Label>
        </div>}
      </fieldset>}
      <DialogFooter>
        <Button variant="outline" disabled={submitting} onClick={onClose}>Cancel</Button>
        <Button disabled={submitting || !choice.canEdit || (showVersionDetails && !!(fieldErrors.label || fieldErrors.description))}
          onClick={() => onConfirm({ saveMode: choice.saveMode,
            archivePreviousOnPublish: choice.archivePreviousOnPublish, makeOfficialOnPublish: choice.makeOfficialOnPublish,
            ...(showVersionDetails ? versionDetails : {}) })}>
          {submitting ? "Saving…" : publishing ? "Publish" : "Submit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
