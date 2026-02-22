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
import { useIllustrationsTableData } from "../../../../services/adminHooks";
import { TableToolbar } from "../shared/table-toolbar";
import { SongIllustrationsGroup } from "./illustration-group";
import { SongIllustrationDB } from "src/lib/db/schema";
import useLocalStorageState from "use-local-storage-state";
import { Filter, Eye, Layers } from "lucide-react";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

type SortKey = "title" | "lastModified" | "illustrationCount";
type SortDirection = "asc" | "desc";

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useLocalStorageState<boolean>(
    "admin/illustration-table/show-deleted-illustrations",
    { defaultValue: false },
  );
  const [prioritizeUnillustrated, setPrioritizeUnillustrated] =
    useLocalStorageState<boolean>(
      "admin/illustration-table/prioritize-unillustrated",
      { defaultValue: true },
    );
  const [showDeletedSongs, setShowDeletedSongs] = useLocalStorageState<boolean>(
    "admin/illustration-table/show-deleted-songs",
    { defaultValue: false },
  );

  const [imageModelFilter, setImageModelFilter] = useState<string>("all");
  const [summaryModelFilter, setSummaryModelFilter] = useState<string>("all");
  const [promptVersionFilter, setPromptVersionFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("lastModified");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { groupedData, promptsById, filterOptions, isLoading, isError } =
    useIllustrationsTableData(adminApi);

  const filteredAndSortedGroups = useMemo(() => {
    // ... [Keep existing sorting/filtering logic intact] ...
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

    if (!showDeletedSongs) {
      groups = groups.filter(
        ([, group]) => !group.song.deleted && !group.song.hidden,
      );
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
      group: SongWithIllustrationsAndPrompts,
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
      if (prioritizeUnillustrated) {
        const isIllustrationActive = (i: SongIllustrationDB) =>
          !("deletedAt" in i && i.deletedAt !== null) &&
          !("isDeleted" in i && i.isDeleted === true);

        const aHasActive = a.illustrations.some(isIllustrationActive);
        const bHasActive = b.illustrations.some(isIllustrationActive);

        if (!aHasActive && bHasActive) return -1;
        if (aHasActive && !bHasActive) return 1;
      }

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
    showDeletedSongs,
    imageModelFilter,
    summaryModelFilter,
    promptVersionFilter,
    promptsById,
    prioritizeUnillustrated,
    sortKey,
    sortDirection,
  ]);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading data.</div>;

  const toggleGroup = (songId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(songId)) newExpanded.delete(songId);
    else newExpanded.add(songId);
    setExpandedGroups(newExpanded);
  };

  const handleSortChange = (value: string) => {
    const [key, dir] = value.split("-") as [SortKey, SortDirection];
    setSortKey(key);
    setSortDirection(dir);
  };

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex flex-col sm:flex-row items-end justify-between border-b pb-4 ">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Illustrations</h2>
          <p className="text-muted-foreground mt-1">
            Managing {filteredAndSortedGroups.length} songs and{" "}
            {filteredAndSortedGroups
              .map((g) => g[1].illustrations.length)
              .reduce((acc, el) => acc + el, 0)}{" "}
            generated assets.
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpandedGroups(
                new Set(filteredAndSortedGroups.map(([songId]) => songId)),
              )
            }
          >
            <Layers className="w-4 h-4 mr-2" /> Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedGroups(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Structured Control Panel */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden border-3 border-primary">
        <div className="p-4 border-b bg-muted/20">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>

        <div className="p-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Toggles Panel */}
          <div className="xl:col-span-5 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
              <Eye className="w-3 h-3 mr-2" /> View Options
            </h4>
            {/* Added flex-wrap and whitespace-nowrap, min-h to match dropdowns */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-muted/40 px-4 py-2.5 rounded-lg border border-border/50 min-h-[40px]">
              <Label className="flex items-center space-x-2 cursor-pointer group">
                <Checkbox
                  checked={prioritizeUnillustrated}
                  onCheckedChange={(c) =>
                    setPrioritizeUnillustrated(c as boolean)
                  }
                />
                <span className="text-sm font-medium whitespace-nowrap group-hover:text-primary transition-colors">
                  Unillustrated first
                </span>
              </Label>
              <Label className="flex items-center space-x-2 cursor-pointer group">
                <Checkbox
                  checked={showDeletedSongs}
                  onCheckedChange={(c) => setShowDeletedSongs(!!c)}
                />
                <span className="text-sm font-medium whitespace-nowrap group-hover:text-primary transition-colors">
                  Deleted songs
                </span>
              </Label>
              <Label className="flex items-center space-x-2 cursor-pointer group">
                <Checkbox
                  checked={showDeleted}
                  onCheckedChange={() => setShowDeleted(!showDeleted)}
                />
                <span className="text-sm font-medium whitespace-nowrap group-hover:text-primary transition-colors">
                  Deleted images
                </span>
              </Label>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="xl:col-span-7 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
              <Filter className="w-3 h-3 mr-2" /> Filter & Sort
            </h4>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Select
                value={imageModelFilter}
                onValueChange={setImageModelFilter}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Image Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Images</SelectItem>
                  {filterOptions.imageModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={summaryModelFilter}
                onValueChange={setSummaryModelFilter}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Summary Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Summaries</SelectItem>
                  {filterOptions.summaryModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={promptVersionFilter}
                onValueChange={setPromptVersionFilter}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Prompt Ver." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prompts</SelectItem>
                  {filterOptions.promptVersions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={`${sortKey}-${sortDirection}`}
                onValueChange={handleSortChange}
              >
                <SelectTrigger className="bg-background h-10 font-medium border-primary/20">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastModified-desc">
                    Newest First
                  </SelectItem>
                  <SelectItem value="lastModified-asc">Oldest First</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                  <SelectItem value="illustrationCount-desc">
                    Most Images
                  </SelectItem>
                  <SelectItem value="illustrationCount-asc">
                    Fewest Images
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAndSortedGroups.map(([songId, song]) => (
          <div key={songId} className="transition-all duration-200">
            <SongIllustrationsGroup
              song={song.song}
              illustrations={song.illustrations}
              prompts={song.prompts}
              isExpanded={expandedGroups.has(songId)}
              onToggleExpanded={() => toggleGroup(songId)}
              showDeleted={showDeleted}
            />
          </div>
        ))}
        {filteredAndSortedGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
            <Filter className="w-8 h-8 mb-4 opacity-50" />
            <p className="text-lg font-medium">No illustrations found</p>
            <p className="text-sm">
              Try adjusting your filters or search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
