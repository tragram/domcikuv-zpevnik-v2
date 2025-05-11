import React from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { DropdownIconStart } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SongData } from '@/types/songData';
import DownloadButton from './components/DownloadButton';
import SongHeading from '../SongView/components/SongHeading';
import { useViewSettingsStore } from '../SongView/hooks/viewSettingsStore';
import { ChordSettingsDropdownMenu, chordSettingsClassNames } from '../SongView/settings/ChordSettingsMenu';
import { layoutSettingsValues, layoutSettingsClassNames } from '../SongView/settings/LayoutSettings';

interface PreviewProps {
  songData: SongData;
  renderedContent: string;
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
  content: string;
}

const Preview: React.FC<PreviewProps> = ({ 
  songData, 
  renderedContent, 
  metadata, 
  content 
}) => {
  const { layout, chords, actions } = useViewSettingsStore();
  const transposeSteps = 0;

  return (
    <div className="relative h-full">
      <div className="absolute w-full bottom-0 left-0 p-4 flex flex-row justify-between h-fit items-center">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular">
              <Settings2 size={32} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-[85dvh] overflow-y-auto">
            <DropdownMenuLabel>Contents</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["repeatParts", "repeatPartsChords"].map(k => (
              <DropdownMenuCheckboxItem
                key={k}
                checked={layout[k]}
                onCheckedChange={() => actions.setLayoutSettings({ [k]: !layout[k] })}
                onSelect={e => e.preventDefault()}
              >
                <DropdownIconStart icon={layoutSettingsValues[k].icon} />
                {layoutSettingsValues[k].label}
              </DropdownMenuCheckboxItem>
            ))}
            {React.Children.toArray(<ChordSettingsDropdownMenu />)}
          </DropdownMenuContent>
        </DropdownMenu>
        <DownloadButton metadata={metadata} content={content} />
      </div>
      <div className={cn('main-container editor-preview-container', chordSettingsClassNames(chords), layoutSettingsClassNames(layout))}>
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