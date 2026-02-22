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
import {
  AdminApi,
  SongWithIllustrationsAndPrompts,
} from "~/services/song-service";
import { useIllustrationsTableData } from "../../adminHooks";
import { TableToolbar } from "../shared/table-toolbar";
import { SongIllustrationsGroup } from "./illustration-group";
import { SongIllustrationDB } from "src/lib/db/schema";
import useLocalStorageState from "use-local-storage-state";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

type SortKey = "title" | "lastModified" | "illustrationCount";
type SortDirection = "asc" | "desc";

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // New local storage toggle for unillustrated prioritization
  const [prioritizeUnillustrated, setPrioritizeUnillustrated] =
    useLocalStorageState<boolean>("prioritize-unillustrated", {
      defaultValue: true,
    });

  const [imageModelFilter, setImageModelFilter] = useState<string>("all");
  const [summaryModelFilter, setSummaryModelFilter] = useState<string>("all");
  const [promptVersionFilter, setPromptVersionFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("lastModified");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { groupedData, promptsById, filterOptions, isLoading, isError } =
    useIllustrationsTableData(adminApi);

  const filteredAndSortedGroups = useMemo(() => {
    let groups = Object.entries(groupedData) as [
      string,
      SongWithIllustrationsAndPrompts,
    ][];

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
          group.illustrations.some((i) => i.imageModel === imageModelFilter),
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

    const getGroupSortValue = (
      group: SongWithIllustrationsAndPrompts, // Replaced 'any' with explicit type
      key: SortKey,
    ): string | number | Date => {
      switch (key) {
        case "title":
          return group.song.title;
        case "lastModified":
          return group.illustrations.reduce(
            (max: Date, i: SongIllustrationDB) =>
              new Date(i.createdAt) > max ? new Date(i.createdAt) : max,
            new Date(0),
          );
        case "illustrationCount":
          return group.illustrations.length;
        default:
          return 0;
      }
    };

    return groups.sort(([, a], [, b]) => {
      // 1. Prioritize unillustrated logic (if toggle is active)
      if (prioritizeUnillustrated) {
        // Adjust this logic if your schema indicates "active" differently (e.g., an isActive boolean)
        const isIllustrationActive = (i: SongIllustrationDB) =>
          !("deletedAt" in i && i.deletedAt !== null) &&
          !("isDeleted" in i && i.isDeleted === true);

        const aHasActive = a.illustrations.some(isIllustrationActive);
        const bHasActive = b.illustrations.some(isIllustrationActive);

        // If a has no active illustrations but b does, a comes first
        if (!aHasActive && bHasActive) return -1;
        // If a has active illustrations but b doesn't, b comes first
        if (aHasActive && !bHasActive) return 1;
      }

      // 2. Standard sorting logic (applied among the prioritized and unprioritized groups)
      const valA = getGroupSortValue(a, sortKey);
      const valB = getGroupSortValue(b, sortKey);
      const direction = sortDirection === "asc" ? 1 : -1;

      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
      return 0;
    });
  }, [
    groupedData,
    searchTerm,
    imageModelFilter,
    summaryModelFilter,
    promptVersionFilter,
    promptsById,
    sortKey,
    sortDirection,
    prioritizeUnillustrated,
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

  const handleSortChange = (value: string) => {
    const [key, dir] = value.split("-") as [SortKey, SortDirection];
    setSortKey(key);
    setSortDirection(dir);
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
        <div className="flex flex-wrap items-center gap-4">
          <Select value={imageModelFilter} onValueChange={setImageModelFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by image model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Image Models</SelectItem>
              {filterOptions.imageModels.map((model) => (
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
              {filterOptions.summaryModels.map((model) => (
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
              {filterOptions.promptVersions.map((version) => (
                <SelectItem key={version} value={version}>
                  {version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={`${sortKey}-${sortDirection}`}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastModified-desc">
                Last Modified (Newest)
              </SelectItem>
              <SelectItem value="lastModified-asc">
                Last Modified (Oldest)
              </SelectItem>
              <SelectItem value="title-asc">Title (A-Z)</SelectItem>
              <SelectItem value="title-desc">Title (Z-A)</SelectItem>
              <SelectItem value="illustrationCount-desc">
                Illustrations (Most)
              </SelectItem>
              <SelectItem value="illustrationCount-asc">
                Illustrations (Fewest)
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-4 ml-auto">
            {/* New Priority Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="prioritize-unillustrated"
                checked={prioritizeUnillustrated}
                onCheckedChange={(checked) =>
                  setPrioritizeUnillustrated(checked as boolean)
                }
              />
              <Label
                htmlFor="prioritize-unillustrated"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap"
              >
                Prioritize unillustrated
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={() => setShowDeleted(!showDeleted)}
              />
              <Label
                htmlFor="show-deleted"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap"
              >
                Show deleted
              </Label>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpandedGroups(
                new Set(filteredAndSortedGroups.map(([songId]) => songId)),
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
