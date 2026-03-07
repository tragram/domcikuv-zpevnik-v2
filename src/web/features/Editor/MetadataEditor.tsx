import React from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import SelectOrEditList from "~/components/SelectOrEditList";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { EditorState, SongDB } from "~/types/types";
import { guessKey } from "../SongView/utils/songRendering";
import MetadataField from "./components/MetadataField";
import EditorSettingsComponent, { EditorSettings } from "./EditorSettings";

interface MetadataEditorProps {
  songDB: SongDB;
  defaultMetadata: EditorState;
  metadata: EditorState;
  extractedMetadata: Partial<EditorState>;
  fieldErrors: Partial<Record<keyof EditorState, string>>;
  updateMetadata: (field: keyof EditorState, value: string) => void;
  editorSettings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  user: UserProfileData;
  hasIllustration?: boolean;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({
  songDB,
  defaultMetadata,
  metadata,
  extractedMetadata,
  fieldErrors,
  updateMetadata,
  editorSettings,
  onSettingsChange,
  user,
  hasIllustration = false,
}) => {
  return (
    <div className="main-container space-y-4">
      {/* Metadata Fields */}
      <div className="space-y-2">
        <MetadataField
          label="Title"
          onChange={(value) => updateMetadata("title", value)}
          placeholder="Apassionata v F"
          value={metadata.title}
          modified={defaultMetadata.title !== metadata.title}
          error={fieldErrors.title}
          required={true}
          disabled={extractedMetadata.title !== undefined}
        />
        <MetadataField
          label="Artist"
          onChange={(value) => updateMetadata("artist", value)}
          placeholder="František Omáčka"
          value={metadata.artist}
          modified={defaultMetadata.artist !== metadata.artist}
          error={fieldErrors.artist}
          required={true}
          disabled={extractedMetadata.artist !== undefined}
        />
        <MetadataField
          label="Capo"
          onChange={(value) => updateMetadata("capo", value)}
          placeholder="0"
          value={metadata.capo?.toString()}
          modified={defaultMetadata.capo !== metadata.capo}
          error={fieldErrors.capo}
          disabled={extractedMetadata.capo !== undefined}
        />
        <MetadataField
          label="Language"
          onChange={(value) => updateMetadata("language", value)}
          placeholder="czech"
          value={metadata.language}
          modified={defaultMetadata.language !== metadata.language}
          description="If language not already present in some other song, flag might not be shown."
          error={fieldErrors.language}
          disabled={extractedMetadata.language !== undefined}
          customInput={
            <SelectOrEditList
              options={Object.keys(songDB.languages)}
              value={metadata.language}
              onValueChange={(value) => updateMetadata("language", value)}
              placeholderCollapsed="Select language"
              placeholderSearch="Find or add language"
              noOptionsFoundText="No language found."
              addNewText="Add new language"
              className={cn(
                "border-2 border-primary/50 dark:border-muted",
                defaultMetadata.language !== metadata.language
                  ? "text-foreground !bg-primary/30"
                  : "text-foreground/70 !bg-input/30",
              )}
            />
          }
        />
        <MetadataField
          label="Key"
          onChange={(value) => updateMetadata("key", value)}
          placeholder="Dm"
          value={metadata.key}
          modified={defaultMetadata.key !== metadata.key}
          description="Use note name (with #/b into denote sharp/flat) for major key and append 'm' or 'mi' to indicate minor key."
          error={fieldErrors.key}
          disabled={extractedMetadata.key !== undefined}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={extractedMetadata.key !== undefined}
              onClick={() => {
                const guessedKey = guessKey(metadata.chordpro);
                if (guessedKey) {
                  updateMetadata("key", guessedKey.toString());
                }
              }}
            >
              Guess
            </Button>
          }
        />
        <MetadataField
          label="Range"
          onChange={(value) => updateMetadata("range", value)}
          placeholder="e.g. c1-g2"
          value={metadata.range}
          modified={defaultMetadata.range !== metadata.range}
          description="Also used for vocal range. See README. ;-)"
          error={fieldErrors.range}
          disabled={extractedMetadata.range !== undefined}
        />
        <MetadataField
          label="Start Melody"
          onChange={(value) => updateMetadata("startMelody", value)}
          placeholder="c# d e"
          value={metadata.startMelody}
          modified={defaultMetadata.startMelody !== metadata.startMelody}
          description="Currently not used so not very standardized across the songs."
          error={fieldErrors.startMelody}
          disabled={extractedMetadata.startMelody !== undefined}
        />
        <MetadataField
          label="Tempo"
          onChange={(value) => updateMetadata("tempo", value)}
          placeholder="123"
          value={metadata.tempo?.toString()}
          modified={defaultMetadata.tempo !== metadata.tempo}
          description="In BPM. Currently not used and very few songs define it."
          error={fieldErrors.tempo}
          disabled={extractedMetadata.tempo !== undefined}
        />
        <Separator />
        {/* Editor Settings Section */}
        <div className="mt-4">
          <EditorSettingsComponent
            settings={editorSettings}
            onSettingsChange={onSettingsChange}
            user={user}
            hasIllustration={hasIllustration}
          />
        </div>
      </div>
    </div>
  );
};

export default MetadataEditor;
