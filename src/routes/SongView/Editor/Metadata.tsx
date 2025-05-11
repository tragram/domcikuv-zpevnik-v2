import React from 'react';
import MetadataField from './components/MetadataField';

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
  updateMetadata: (field: string, value: string) => void;
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
      />
      <MetadataField
        label="Artist"
        onChange={(value) => updateMetadata('artist', value)}
        placeholder="František Omáčka"
        value={metadata.artist}
      />
      <MetadataField
        label="Capo"
        onChange={(value) => updateMetadata('capo', value)}
        placeholder="0"
        value={metadata.capo}
      />
      <MetadataField
        label="Date Added"
        onChange={(value) => updateMetadata('dateAdded', value)}
        placeholder="02-2025"
        value={metadata.dateAdded}
        description="Use MM-YYYY format."
      />
      <MetadataField
        label="Language"
        onChange={(value) => updateMetadata('language', value)}
        placeholder="czech"
        value={metadata.language}
        description="If language not already present in some other song, flag might not be shown."
      />
      <MetadataField
        label="Key"
        onChange={(value) => updateMetadata('key', value)}
        placeholder="Dm"
        value={metadata.key}
        description="Use note name (with #/b into denote sharp/flat) for major key and append 'm' or 'mi' to indicate minor key."
      />
      <MetadataField
        label="Songbooks"
        onChange={(value) => updateMetadata('songbooks', value)}
        placeholder='["Domčík", "Kvítek"]'
        value={metadata.songbooks}
        description="Comma separated list with names in double quotes."
      />
      <MetadataField
        label="Range"
        onChange={(value) => updateMetadata('range', value)}
        placeholder="e.g. c1-g2"
        value={metadata.range}
        description="Also used for vocal range. See README. ;-)"
      />
      <MetadataField
        label="Start Melody"
        onChange={(value) => updateMetadata('startMelody', value)}
        placeholder="c# d e"
        value={metadata.startMelody}
        description="Currently not used so not very standardized across the songs."
      />
      <MetadataField
        label="Tempo"
        onChange={(value) => updateMetadata('tempo', value)}
        placeholder="123"
        value={metadata.tempo}
        description="In BPM. Currently not used and very few songs have it."
      />
    </div>
  );
};

export default Metadata;