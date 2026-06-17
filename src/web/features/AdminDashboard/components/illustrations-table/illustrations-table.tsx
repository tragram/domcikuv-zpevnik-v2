import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIllustrationsTableData } from "../../../../services/admin-hooks";
import { ControlPanel } from "../control-panel";
import { Pagination } from "../shared/pagination";
import { StatsBar } from "../stats-bar";
import { ToggleCheckbox } from "../toggle-checkbox";
import { SongIllustrationsGroup } from "./illustration-group";
import { SongIllustrationDB } from "src/lib/db/schema";
import useLocalStorageState from "use-local-storage-state";
import {
  Filter,
  Eye,
  Layers,
  AlertCircle,
  Globe,
  Library,
  Image as ImageIcon,
} from "lucide-react";
import { SongWithIllustrationsAndPrompts } from "~/services/illustration-service";
import { AdminApi } from "src/worker/api-client";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

type SortKey = "title" | "lastModified" | "illustrationCount";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 20;

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
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
  const [showExternal, setShowExternal] = useLocalStorageState<boolean>(
    "admin/illustration-table/show-external",
    { defaultValue: false },
  );

  const [imageModelFilter, setImageModelFilter] = useState<string>("all");
  const [summaryModelFilter, setSummaryModelFilter] = useState<string>("all");
  const [promptVersionFilter, setPromptVersionFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("lastModified");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { groupedData, promptsById, filterOptions, isLoading, isError, error } =
    useIllustrationsTableData(adminApi);

  const stats = useMemo(() => {
    const groups = Object.values(
      groupedData,
    ) as SongWithIllustrationsAndPrompts[];
    const visible = groups.filter((g) => !g.song.deleted && !g.song.hidden);
    return {
      songs: visible.length,
      illustrated: visible.filter((g) => g.song.currentIllustrationId).length,
      unillustrated: visible.filter((g) => !g.song.currentIllustrationId).length,
      assets: groups.reduce(
        (acc, g) => acc + g.illustrations.filter((i) => !i.deleted).length,
        0,
      ),
      external: visible.filter((g) => g.song.externalSource).length,
    };
  }, [groupedData]);

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

    if (!showDeletedSongs) {
      groups = groups.filter(
        ([, group]) => !group.song.deleted && !group.song.hidden,
      );
    }

    if (!showExternal) {
      groups = groups.filter(([, group]) => !group.song.externalSource);
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
    showExternal,
    imageModelFilter,
    summaryModelFilter,
    promptVersionFilter,
    promptsById,
    prioritizeUnillustrated,
    sortKey,
    sortDirection,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6 w-full pb-8 animate-pulse">
        <div className="flex flex-col sm:flex-row items-end justify-between border-b pb-4">
          <div>
            <div className="h-9 w-64 bg-muted rounded mb-2"></div>
            <div className="h-4 w-48 bg-muted rounded"></div>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <div className="h-9 w-28 bg-muted rounded"></div>
            <div className="h-9 w-28 bg-muted rounded"></div>
          </div>
        </div>

        {/* Skeleton Control Panel */}
        <div className="h-[140px] bg-muted/20 rounded-xl shadow-sm border-2 border-muted w-full mb-6"></div>

        {/* Skeleton Illustration Groups */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 w-full bg-muted/40 rounded-lg border"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 text-destructive p-4 flex gap-3 items-start bg-destructive/10 my-8">
        <AlertCircle className="h-5 w-5 mt-0.5" />
        <div>
          <h3 className="font-semibold leading-none tracking-tight mb-2">
            Error Loading Data
          </h3>
          <p className="text-sm opacity-90">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching data."}
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedGroups.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedGroups = filteredAndSortedGroups.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

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

  // Filter changes reset to the first page so results aren't hidden off-page.
  const withPageReset =
    <T,>(setter: (val: T) => void) =>
    (val: T) => {
      setter(val);
      setCurrentPage(0);
    };

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex flex-col sm:flex-row items-end justify-between border-b pb-4 ">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Illustrations</h2>
          <p className="text-muted-foreground mt-1">
            Manage AI illustrations and prompts for the song library.
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

      <StatsBar
        items={[
          { label: "Songs", value: stats.songs, icon: Library },
          {
            label: "Illustrated",
            value: stats.illustrated,
            icon: ImageIcon,
            className: "text-emerald-600",
          },
          {
            label: "Unillustrated",
            value: stats.unillustrated,
            icon: AlertCircle,
            className: "text-red-600",
          },
          {
            label: "Assets",
            value: stats.assets,
            icon: Layers,
            className: "text-blue-600",
          },
          {
            label: "External",
            value: stats.external,
            icon: Globe,
            className: "text-violet-600",
          },
        ]}
      />

      {/* Structured Control Panel */}
      <ControlPanel
        searchTerm={searchTerm}
        onSearchChange={withPageReset(setSearchTerm)}
      >
        <div className="p-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Toggles Panel */}
          <div className="xl:col-span-5 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
              <Eye className="w-3 h-3 mr-2" /> View Options
            </h4>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-muted/40 px-4 py-2.5 rounded-lg border border-border/50 min-h-[40px]">
              <ToggleCheckbox
                checked={prioritizeUnillustrated}
                onCheckedChange={setPrioritizeUnillustrated}
                label="Unillustrated first"
              />
              <ToggleCheckbox
                checked={showDeletedSongs}
                onCheckedChange={withPageReset(setShowDeletedSongs)}
                label="Deleted songs"
              />
              <ToggleCheckbox
                checked={showDeleted}
                onCheckedChange={setShowDeleted}
                label="Deleted images"
              />
              <ToggleCheckbox
                checked={showExternal}
                onCheckedChange={withPageReset(setShowExternal)}
                label="External songs"
                icon={Globe}
                iconClassName="text-violet-500"
              />
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
                onValueChange={withPageReset(setImageModelFilter)}
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
                onValueChange={withPageReset(setSummaryModelFilter)}
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
                onValueChange={withPageReset(setPromptVersionFilter)}
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
      </ControlPanel>

      <div className="space-y-4">
        {paginatedGroups.map(([songId, song]) => (
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

      {totalPages > 1 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          hasNextPage={safePage < totalPages - 1}
          hasPrevPage={safePage > 0}
          onPageChange={setCurrentPage}
          totalItems={filteredAndSortedGroups.length}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
