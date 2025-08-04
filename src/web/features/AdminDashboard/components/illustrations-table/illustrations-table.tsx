import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { SongIllustrationsGroup } from "./illustration-group";
import { songsWithIllustrationsAndPrompts } from "~/services/illustrations";
import { AdminApi } from "~/services/songs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  useIllustrationsAdmin,
  usePromptsAdmin,
  useSongDBAdmin,
} from "../../adminHooks";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [imageModelFilter, setImageModelFilter] = useState<string>("all");
  const [summaryModelFilter, setSummaryModelFilter] = useState<string>("all");
  const [promptVersionFilter, setPromptVersionFilter] =
    useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: songs, isLoading: songsLoading } = useSongDBAdmin(adminApi);
  const { data: illustrations, isLoading: illustrationsLoading } =
    useIllustrationsAdmin(adminApi);
  const { data: prompts, isLoading: promptsLoading } =
    usePromptsAdmin(adminApi);

  const songsIllustrationsAndPrompts = useMemo(() => {
    if (!songs || !illustrations || !prompts) {
      return {};
    }
    return songsWithIllustrationsAndPrompts(songs, illustrations, prompts);
  }, [songs, illustrations, prompts]);

  const imageModels = useMemo(() => {
    if (!illustrations) return [];
    return [...new Set(illustrations.map((i) => i.imageModel))];
  }, [illustrations]);

  const summaryModels = useMemo(() => {
    if (!prompts) return [];
    return [...new Set(prompts.map((p) => p.summaryModel))];
  }, [prompts]);

  const promptVersions = useMemo(() => {
    if (!prompts) return [];
    return [...new Set(prompts.map((p) => p.summaryPromptVersion))];
  }, [prompts]);

  const promptsById = useMemo(() => {
    if (!prompts) return new Map();
    return new Map(prompts.map((p) => [p.id, p]));
  }, [prompts]);

  const filteredAndSortedGroups = useMemo(() => {
    let groups = Object.entries(songsIllustrationsAndPrompts);

    // Filter by search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      groups = groups.filter(([, group]) => {
        const { song } = group;
        return (
          song.title.toLowerCase().includes(lowerCaseSearchTerm) ||
          song.artist.toLowerCase().includes(lowerCaseSearchTerm)
        );
      });
    }

    // Filter by image model
    if (imageModelFilter !== "all") {
      groups = groups.filter(
        ([, group]) =>
          Array.isArray(group.illustrations) &&
          group.illustrations.some((i) => i.imageModel === imageModelFilter)
      );
    }

    // Filter by summary model
    if (summaryModelFilter !== "all") {
      groups = groups.filter(([, group]) => {
        if (!Array.isArray(group.illustrations)) return false;
        return group.illustrations.some((i) => {
          const prompt = promptsById.get(i.promptId);
          return prompt && prompt.summaryModel === summaryModelFilter;
        });
      });
    }

    // Filter by prompt version
    if (promptVersionFilter !== "all") {
      groups = groups.filter(([, group]) => {
        if (!Array.isArray(group.illustrations)) return false;
        return group.illustrations.some((i) => {
          const prompt = promptsById.get(i.promptId);
          return prompt && prompt.summaryPromptVersion === promptVersionFilter;
        });
      });
    }

    // Sort groups by song title
    return groups.sort(([, songA], [, songB]) => {
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
    });
  }, [
    songsIllustrationsAndPrompts,
    searchTerm,
    imageModelFilter,
    summaryModelFilter,
    promptVersionFilter,
    promptsById,
  ]);

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

  return (
    <div className="space-y-4 p-4 w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between">
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-medium">Song Illustrations</h3>
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedGroups.length} songs • {illustrations.length}{" "}
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
        <div className="flex items-center space-x-4">
          <Select value={imageModelFilter} onValueChange={setImageModelFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by image model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Image Models</SelectItem>
              {imageModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={summaryModelFilter}
            onValueChange={setSummaryModelFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by summary model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Summary Models</SelectItem>
              {summaryModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={promptVersionFilter}
            onValueChange={setPromptVersionFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by prompt version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prompt Versions</SelectItem>
              {promptVersions.map((version) => (
                <SelectItem key={version} value={version}>
                  {version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
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
              setExpandedGroups(
                new Set(filteredAndSortedGroups.map(([songId]) => songId))
              )
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
        {filteredAndSortedGroups.map(([songId, song]) => (
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

        {filteredAndSortedGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No illustrations found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
