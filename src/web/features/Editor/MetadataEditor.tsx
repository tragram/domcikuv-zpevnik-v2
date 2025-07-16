import React from "react";
import type { SongMetadata } from "~/types/songData";
import MetadataField from "./components/MetadataField";
import { metadataValidators } from "./components/validationUtils";
import type { EditorState } from "./Editor";

interface MetadataEditorProps {
  defaultMetadata: SongMetadata;
  metadata: SongMetadata;
  updateMetadata: (field: keyof EditorState["metadata"], value: string) => void;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({
  defaultMetadata,
  metadata,
  updateMetadata,
}) => {
  return (
    <div className="main-container space-y-2">
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
        onChange={(value) => updateMetadata("capo", value)}
        placeholder="0"
        value={metadata.capo}
        modified={defaultMetadata.capo !== metadata.capo}
        validator={metadataValidators.capo}
      />
      <MetadataField
        label="Date Added"
        onChange={(value) => updateMetadata("dateAdded", value)}
        placeholder="02-2025"
        value={metadata.dateAdded}
        modified={defaultMetadata.dateAdded !== metadata.dateAdded}
        description="Use MM-YYYY format."
        validator={metadataValidators.dateAdded}
      />
      <MetadataField
        label="Language"
        onChange={(value) => updateMetadata("language", value)}
        placeholder="czech"
        value={metadata.language}
        modified={defaultMetadata.language !== metadata.language}
        description="If language not already present in some other song, flag might not be shown."
        validator={metadataValidators.language}
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
        value={metadata.tempo}
        modified={defaultMetadata.tempo !== metadata.tempo}
        description="In BPM. Currently not used and very few songs define it."
        validator={metadataValidators.tempo}
      />
    </div>
  );
};

export default MetadataEditor;
