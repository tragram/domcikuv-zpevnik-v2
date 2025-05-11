import React from 'react';
import MetadataField from './components/MetadataField';
import { metadataValidators } from './components/validationUtils';
import { EditorState } from './Editor';

interface MetadataProps {
  metadata: {
    title: string;
    artist: string;
    key: string;
    dateAdded: string;
    songbooks: string;
    startMelody: string;
    language: string;
    tempo: string;
    capo: string;
    range: string;
    pdfFilenames: string;
  };
  updateMetadata: (field: keyof EditorState["metadata"], value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

const Metadata: React.FC<MetadataProps> = ({
  metadata,
  updateMetadata
}) => {
  return (
    <div className='main-container space-y-2'>
      <MetadataField
        label="Title"
        onChange={(value) => updateMetadata('title', value)}
        placeholder="Apassionata v F"
        value={metadata.title}
        validator={metadataValidators.title}
        required={true}
      />
      <MetadataField
        label="Artist"
        onChange={(value) => updateMetadata('artist', value)}
        placeholder="František Omáčka"
        value={metadata.artist}
        validator={metadataValidators.artist}
        required={true}
      />
      <MetadataField
        label="Capo"
        onChange={(value) => updateMetadata('capo', value)}
        placeholder="0"
        value={metadata.capo}
        validator={metadataValidators.capo}
      />
      <MetadataField
        label="Date Added"
        onChange={(value) => updateMetadata('dateAdded', value)}
        placeholder="02-2025"
        value={metadata.dateAdded}
        description="Use MM-YYYY format."
        validator={metadataValidators.dateAdded}
      />
      <MetadataField
        label="Language"
        onChange={(value) => updateMetadata('language', value)}
        placeholder="czech"
        value={metadata.language}
        description="If language not already present in some other song, flag might not be shown."
        validator={metadataValidators.language}
      />
      <MetadataField
        label="Key"
        onChange={(value) => updateMetadata('key', value)}
        placeholder="Dm"
        value={metadata.key}
        description="Use note name (with #/b into denote sharp/flat) for major key and append 'm' or 'mi' to indicate minor key."
        validator={metadataValidators.key}
      />
      <MetadataField
        label="Songbooks"
        onChange={(value) => updateMetadata('songbooks', value)}
        placeholder='["Domčík", "Kvítek"]'
        value={metadata.songbooks}
        description="Comma separated list with names in double quotes."
        validator={metadataValidators.songbooks}
      />
      <MetadataField
        label="Range"
        onChange={(value) => updateMetadata('range', value)}
        placeholder="e.g. c1-g2"
        value={metadata.range}
        description="Also used for vocal range. See README. ;-)"
        validator={metadataValidators.range}
      />
      <MetadataField
        label="Start Melody"
        onChange={(value) => updateMetadata('startMelody', value)}
        placeholder="c# d e"
        value={metadata.startMelody}
        description="Currently not used so not very standardized across the songs."
        validator={metadataValidators.startMelody}
      />
      <MetadataField
        label="Tempo"
        onChange={(value) => updateMetadata('tempo', value)}
        placeholder="123"
        value={metadata.tempo}
        description="In BPM. Currently not used and very few songs have it."
        validator={metadataValidators.tempo}
      />
    </div>
  );
};

export default Metadata;