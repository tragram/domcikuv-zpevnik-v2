import { cn } from '~/lib/utils';
import { SongData, type SongMetadata } from '~/types/songData';
import React from 'react';
import SongHeading from '../SongView/components/SongHeading';
import { useViewSettingsStore } from '../SongView/hooks/viewSettingsStore';
import { chordSettingsClassNames } from '../SongView/settings/ChordSettingsMenu';
import { layoutSettingsClassNames } from '../SongView/settings/LayoutSettings';
import { renderSong } from '../SongView/utils/songRendering';

interface PreviewProps {
  metadata: SongMetadata;
  content: string;
}

const Preview: React.FC<PreviewProps> = ({
  metadata,
  content
}) => {
  const songData = new SongData(metadata);
  songData.content = content;
  let renderedContent = '';
  try {
    renderedContent = renderSong(
      songData,
      0, // transposeSteps
      true
    );
  } catch (error) {
    console.error('Error rendering song:', error);
    renderedContent = '<p>Error rendering song content.</p>';
  }

  const { layout, chords } = useViewSettingsStore();

  const transposeSteps = 0;

  return (
    <div className="relative h-full">
      <div className={cn('main-container editor-preview-container', chordSettingsClassNames(chords), layoutSettingsClassNames(layout), content.length === 0 ? "editor-content-empty" : "")}>
        <SongHeading
          songData={songData}
          layoutSettings={layout}
          transposeSteps={transposeSteps}
        />
        <div
          id="song-content-wrapper"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </div>
    </div>
  );
};

export default Preview;