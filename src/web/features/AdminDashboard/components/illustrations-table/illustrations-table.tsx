import { getRouteApi } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { IllustrationApiResponse } from "src/worker/api/admin/illustrations";
import { Button } from "~/components/shadcn-ui/button";
import { Input } from "~/components/shadcn-ui/input";
import {
  SongIllustrationsGroup,
  SongWithIllustrations,
} from "./illustration-group";

interface IllustrationsTableProps {
  illustrations: IllustrationApiResponse[];
}

export function IllustrationsTable({ illustrations }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // TODO: this will change when songDB source changes
  const { songDB } = getRouteApi("/admin").useLoaderData();
  // TODO: separate search for songs and illustrations
  const filteredIllustrations = illustrations.filter(
    (illustration) =>
      illustration.song?.title
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.song?.artist
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.promptModel
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.imageModel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleGroup = (songId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(songId)) {
      newExpanded.delete(songId);
    } else {
      newExpanded.add(songId);
    }
    setExpandedGroups(newExpanded);
  };

  const groupedIllustrations = songDB.songs.reduce((acc, s) => {
    acc[s.id] = {
      song: {
        id: s.id,
        title: s.title,
        artist: s.artist,
      },
      illustrations: [],
    } as SongWithIllustrations;

    return acc;
  }, {} as Record<string, SongWithIllustrations>);

  illustrations.forEach((il) =>
    groupedIllustrations[il.songId].illustrations.push(il)
  );

  // Sort groups by song title
  const sortedGroups = Object.entries(groupedIllustrations).sort(
    ([, songA], [, songB]) => {
      const activeSum = (illustrations: IllustrationApiResponse[]) =>
        illustrations
          .map((i) => i.isActive)
          .reduce((a: number, c: boolean) => a + Number(c), 0);
      const activeA = activeSum(songA.illustrations);
      const activeB = activeSum(songB.illustrations);
      if (activeA + activeB !== 0) {
        if (activeA === 0) {
          return -1;
        }
        if (activeB === 0) {
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
            {sortedGroups.length} songs • {filteredIllustrations.length}{" "}
            illustrations
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
            song={song}
            isExpanded={expandedGroups.has(songId)}
            onToggleExpanded={() => toggleGroup(songId)}
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
