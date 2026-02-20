import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AdminApi } from "~/services/song-service";
import { useIllustrationsTableData } from "../../adminHooks";
import { TableToolbar } from "../shared/table-toolbar";
import { SongIllustrationsGroup } from "./illustration-group";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [imageModelFilter, setImageModelFilter] = useState<string>("all");
  const [summaryModelFilter, setSummaryModelFilter] = useState<string>("all");
  const [promptVersionFilter, setPromptVersionFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { 
    groupedData, 
    promptsById, 
    filterOptions, 
    isLoading, 
    isError 
  } = useIllustrationsTableData(adminApi);

  const filteredAndSortedGroups = useMemo(() => {
    let groups = Object.entries(groupedData);

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

    if (imageModelFilter !== "all") {
      groups = groups.filter(
        ([, group]) =>
          Array.isArray(group.illustrations) &&
          group.illustrations.some((i) => i.imageModel === imageModelFilter)
      );
    }

    if (summaryModelFilter !== "all") {
      groups = groups.filter(([, group]) => {
        if (!Array.isArray(group.illustrations)) return false;
        return group.illustrations.some((i) => {
          const prompt = promptsById.get(i.promptId);
          return prompt && prompt.summaryModel === summaryModelFilter;
        });
      });
    }

    if (promptVersionFilter !== "all") {
      groups = groups.filter(([, group]) => {
        if (!Array.isArray(group.illustrations)) return false;
        return group.illustrations.some((i) => {
          const prompt = promptsById.get(i.promptId);
          return prompt && prompt.summaryPromptVersion === promptVersionFilter;
        });
      });
    }

    return groups.sort(([, songA], [, songB]) => {
      const activeA = Boolean(songA.song.currentIllustrationId);
      const activeB = Boolean(songB.song.currentIllustrationId);
      if (!activeA || !activeB) {
        if (!activeA) return -1;
        if (!activeB) return 1;
      }
      return songA.song.title.localeCompare(songB.song.title);
    });
  }, [
    groupedData,
    searchTerm,
    imageModelFilter,
    summaryModelFilter,
    promptVersionFilter,
    promptsById,
  ]);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading data.</div>;

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
            {filteredAndSortedGroups.length} songs •{" "}
            {filteredAndSortedGroups
              .map((g) => g[1].illustrations.length)
              .reduce((acc, el) => acc + el, 0)}{" "}
            illustrations
          </p>
        </div>
      </div>

      <TableToolbar searchTerm={searchTerm} onSearchChange={setSearchTerm}>
        <div className="flex items-center space-x-4">
          <Select value={imageModelFilter} onValueChange={setImageModelFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by image model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Image Models</SelectItem>
              {filterOptions.imageModels.map((model) => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={summaryModelFilter} onValueChange={setSummaryModelFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by summary model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Summary Models</SelectItem>
              {filterOptions.summaryModels.map((model) => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={promptVersionFilter} onValueChange={setPromptVersionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by prompt version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prompt Versions</SelectItem>
              {filterOptions.promptVersions.map((version) => (
                <SelectItem key={version} value={version}>{version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-deleted"
              checked={showDeleted}
              onCheckedChange={() => setShowDeleted(!showDeleted)}
            />
            <Label htmlFor="show-deleted" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Show deleted
            </Label>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpandedGroups(new Set(filteredAndSortedGroups.map(([songId]) => songId)))
            }
          >
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpandedGroups(new Set())}>
            Collapse All
          </Button>
        </div>
      </TableToolbar>

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