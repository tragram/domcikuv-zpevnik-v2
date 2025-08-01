import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { SongIllustrationsGroup } from "./illustration-group";
import { songsWithIllustrationsAndPrompts } from "~/services/illustrations";
import { AdminApi } from "~/services/songs";
import {
  useIllustrationsAdmin,
  usePromptsAdmin,
  useSongDBAdmin,
} from "../../hooks";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: songs, isLoading: songsLoading } = useSongDBAdmin(adminApi);
  console.log(songsLoading)
  const { data: illustrations, isLoading: illustrationsLoading } =
    useIllustrationsAdmin(adminApi);
  const { data: prompts, isLoading: promptsLoading } =
    usePromptsAdmin(adminApi);

  if (songsLoading || illustrationsLoading || promptsLoading) {
    return <div>Loading...</div>;
  }

  if (!songs || !illustrations || !prompts) {
    return <div>Error loading data.</div>;
  }

  const toggleGroup = (songId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(songId)) {
      newExpanded.delete(songId);
    } else {
      newExpanded.add(songId);
    }
    setExpandedGroups(newExpanded);
  };
  const songsIllustrationsAndPrompts = songsWithIllustrationsAndPrompts(
    songs,
    illustrations,
    prompts
  );
  // Sort groups by song title
  const sortedGroups = Object.entries(songsIllustrationsAndPrompts).sort(
    ([, songA], [, songB]) => {
      const activeA = Boolean(songA.song.currentIllustrationId);
      const activeB = Boolean(songB.song.currentIllustrationId);
      if (!activeA || !activeB) {
        if (!activeA) {
          return -1;
        }
        if (!activeB) {
          return 1;
        }
      }
      return songA.song.title.localeCompare(songB.song.title);
    }
  );

  return (
    <div className="space-y-4 p-4 w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between">
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-medium">Song Illustrations</h3>
          <p className="text-sm text-muted-foreground">
            {sortedGroups.length} songs • {illustrations.length} illustrations
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-1 w-full">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs or illustrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs sm:text-sm md:text-base"
          />
        </div>
        <div className="flex items-center space-x-8">
          <div className="flex flex-row gap-2">
            <Checkbox
              id="show-deleted"
              checked={showDeleted}
              onCheckedChange={() => setShowDeleted(!showDeleted)}
            />
            <Label
              htmlFor="show-deleted"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show deleted
            </Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpandedGroups(new Set(sortedGroups.map(([songId]) => songId)))
            }
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedGroups(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedGroups.map(([songId, song]) => (
          <SongIllustrationsGroup
            key={songId}
            song={song.song}
            illustrations={song.illustrations}
            prompts={song.prompts}
            isExpanded={expandedGroups.has(songId)}
            onToggleExpanded={() => toggleGroup(songId)}
            showDeleted={showDeleted}
          />
        ))}

        {sortedGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No illustrations found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
