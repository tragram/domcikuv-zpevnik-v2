import React from "react";
import MetadataField from "./components/MetadataField";
import { metadataValidators } from "./components/validationUtils";
import type { EditorState } from "./Editor";
import SelectOrEditList from "~/components/SelectOrEditList";
import { SongDB } from "~/types/types";
import { cn } from "~/lib/utils";
import EditorSettingsComponent, { EditorSettings } from "./EditorSettings";
import { Separator } from "~/components/ui/separator";
import { UserProfileData } from "src/worker/api/userProfile";

interface MetadataEditorProps {
  songDB: SongDB;
  defaultMetadata: EditorState;
  metadata: EditorState;
  updateMetadata: (field: keyof EditorState, value: string) => void;
  editorSettings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  user: UserProfileData;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({
  songDB,
  defaultMetadata,
  metadata,
  updateMetadata,
  editorSettings,
  onSettingsChange,
  user,
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
          validator={metadataValidators.title}
          required={true}
        />
        <MetadataField
          label="Artist"
          onChange={(value) => updateMetadata("artist", value)}
          placeholder="František Omáčka"
          value={metadata.artist}
          modified={defaultMetadata.artist !== metadata.artist}
          validator={metadataValidators.artist}
          required={true}
        />
        <MetadataField
          label="Capo"
          onChange={(value) =>
            updateMetadata("capo", parseInt(value, 10) || value)
          }
          placeholder="0"
          value={metadata.capo?.toString()}
          modified={defaultMetadata.capo !== metadata.capo}
          validator={metadataValidators.capo}
        />
        <MetadataField
          label="Language"
          onChange={(value) => updateMetadata("language", value)}
          placeholder="czech"
          value={metadata.language}
          modified={defaultMetadata.language !== metadata.language}
          description="If language not already present in some other song, flag might not be shown."
          validator={metadataValidators.language}
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
          validator={metadataValidators.key}
        />
        <MetadataField
          label="Range"
          onChange={(value) => updateMetadata("range", value)}
          placeholder="e.g. c1-g2"
          value={metadata.range}
          modified={defaultMetadata.range !== metadata.range}
          description="Also used for vocal range. See README. ;-)"
          validator={metadataValidators.range}
        />
        <MetadataField
          label="Start Melody"
          onChange={(value) => updateMetadata("startMelody", value)}
          placeholder="c# d e"
          value={metadata.startMelody}
          modified={defaultMetadata.startMelody !== metadata.startMelody}
          description="Currently not used so not very standardized across the songs."
          validator={metadataValidators.startMelody}
        />
        <MetadataField
          label="Tempo"
          onChange={(value) => updateMetadata("tempo", value)}
          placeholder="123"
          value={metadata.tempo?.toString()}
          modified={defaultMetadata.tempo !== metadata.tempo}
          description="In BPM. Currently not used and very few songs define it."
          validator={metadataValidators.tempo}
        />
        <Separator />
        {/* Editor Settings Section */}
        <div className="mt-4">
          <EditorSettingsComponent
            settings={editorSettings}
            onSettingsChange={onSettingsChange}
            user={user}
          />
        </div>
      </div>
    </div>
  );
};

export default MetadataEditor;
