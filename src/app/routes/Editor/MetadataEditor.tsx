import React, { useCallback, useState } from 'react';
import MetadataField from './components/MetadataField';
import { metadataValidators } from './components/validationUtils';
import type { EditorState } from './Editor';
import type { SongMetadata } from '@/../types/songData';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/custom-ui/dropdown-menu';
import { DropdownMenuLabel, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/custom-ui/button';
import { PlusCircle } from 'lucide-react';

interface MetadataEditorProps {
  metadata: SongMetadata
  updateMetadata: (field: keyof EditorState["metadata"], value: string) => void;
  availableSongbooks: string[];
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({
  metadata,
  updateMetadata,
  availableSongbooks,
}) => {
  const [isAddingCustomSongbook, setIsAddingCustomSongbook] = useState(false);
  const [customSongbookName, setCustomSongbookName] = useState('');
  // this do be ugly but it's late and it's a lot of work to do more elegantly (extension of SongMetadata???)
  const currentSongbooks = React.useMemo(() => {
    try {
      return JSON.parse(metadata.songbooks ?? "[]");
    } catch (error) {
      console.error("Failed to parse songbooks metadata:", error);
      return [];
    }
  }, [metadata.songbooks]);
  availableSongbooks = [...new Set([...availableSongbooks, ...currentSongbooks])]
  const toggleSongbook = useCallback((songbook: string) => {
    let newSongbooks;
    if (currentSongbooks?.includes(songbook)) {
      newSongbooks = currentSongbooks?.filter((sb: string) => sb !== songbook);
    } else {
      newSongbooks = [...currentSongbooks, songbook];
    }
    updateMetadata("songbooks", JSON.stringify(newSongbooks));
  }, [currentSongbooks, updateMetadata]);

  const addCustomSongbook = useCallback(() => {
    if (customSongbookName.trim()) {
      if (!currentSongbooks.includes(customSongbookName)) {
        const newSongbooks = [...currentSongbooks, customSongbookName];
        updateMetadata("songbooks", JSON.stringify(newSongbooks));
      }
      setCustomSongbookName('');
      setIsAddingCustomSongbook(false);
    }
  }, [customSongbookName, currentSongbooks, updateMetadata])

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
      <div className="w-full items-center space-y-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="text-sm hover:bg-primary/30 w-full border-1 border-primary/30 text-start rounded-md h-8">
            Songbooks
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableSongbooks.map(a => (
              <DropdownMenuCheckboxItem
                key={a}
                checked={currentSongbooks.includes(a)}
                onCheckedChange={() => toggleSongbook(a)}
                onSelect={e => e.preventDefault()}
              >
                {a}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />

            {isAddingCustomSongbook ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Input
                  value={customSongbookName}
                  onChange={(e) => setCustomSongbookName(e.target.value)}
                  placeholder="Enter songbook name"
                  className="h-8 w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addCustomSongbook();
                    } else if (e.key === 'Escape') {
                      setIsAddingCustomSongbook(false);
                      setCustomSongbookName('');
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCustomSongbook}
                  className="h-8"
                >
                  Add
                </Button>
              </div>
            ) : (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setIsAddingCustomSongbook(true);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add custom songbook
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-xs text-primary/80 dark:text-primary/50">Describes who will play the song for you.</p>
      </div>
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
        description="In BPM. Currently not used and very few songs define it."
        validator={metadataValidators.tempo}
      />
    </div>
  );
};

export default MetadataEditor;