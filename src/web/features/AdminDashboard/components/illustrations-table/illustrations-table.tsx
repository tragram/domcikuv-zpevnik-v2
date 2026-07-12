import { useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
  Layers,
  AlertCircle,
  Globe,
  Library,
  Image as ImageIcon,
  ArrowDownUp,
  FileText,
  Hash,
  Trash2,
} from "lucide-react";
import { SongWithIllustrationsAndPrompts } from "~/services/illustration-service";
import { AdminApi } from "src/worker/api-client";
import { cn } from "~/lib/utils";

interface IllustrationsTableProps {
  adminApi: AdminApi;
}

type SortKey = "title" | "lastModified" | "songDate" | "illustrationCount";
type SortDirection = "asc" | "desc";

/** Illustration-coverage filter (single-select); "all" is the reset. */
type CoverageFilter = "all" | "illustrated" | "unillustrated" | "assets";
/** Independent visibility focus, isolated via its own cards. */
type ShowOnly = "external" | "deleted";

const PAGE_SIZE = 20;

// "Visible" = not deleted and not hidden. External songs are visible but are
// hidden from the default working view (they rarely need illustrations); the
// External card reveals them, so coverage counts ignore them by default too.
const isVisibleSong = (g: SongWithIllustrationsAndPrompts) =>
  !g.song.deleted && !g.song.hidden;

// A song counts as illustrated when one of its illustrations carries the
// current flag (there is at most one; nothing is stored on the song row).
const hasCurrentIllustration = (g: SongWithIllustrationsAndPrompts) =>
  g.illustrations.some((i) => i.isCurrent);

type SelectOption = { value: string; label: string };

/**
 * A dropdown styled as a StatsBar card: the trigger looks like the filter cards
 * (icon badge + current value + label) and opens the option list on click.
 */
function SelectCard({
  label,
  icon: Icon,
  value,
  onValueChange,
  options,
  iconClassName,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  iconClassName?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-auto! w-full min-w-35 flex-1 items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all",
          "hover:border-primary/50 hover:shadow-md",
          "data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/30",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted",
              iconClassName,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold leading-tight">
              <SelectValue />
            </span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Same StatsBar-card look as `SelectCard`, but backed by a checkbox dropdown
 * so several options can be selected at once. An empty selection means "all".
 */
function MultiSelectCard({
  label,
  allLabel,
  icon: Icon,
  values,
  onValuesChange,
  options,
  iconClassName,
}: {
  label: string;
  allLabel: string;
  icon: React.ElementType;
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: SelectOption[];
  iconClassName?: string;
}) {
  const toggle = (value: string) => {
    onValuesChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  const displayText =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} selected`;

  const active = values.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-auto w-full min-w-35 flex-1 items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all",
            "hover:border-primary/50 hover:shadow-md",
            active && "border-primary ring-2 ring-primary/30",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted",
                iconClassName,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold leading-tight">
                {displayText}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuCheckboxItem
          onSelect={(e) => e.preventDefault()}
          checked={values.length === 0}
          onClick={() => onValuesChange([])}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            onSelect={(e) => e.preventDefault()}
            checked={values.includes(o.value)}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SORT_OPTIONS: SelectOption[] = [
  { value: "lastModified-desc", label: "Newest Illustration" },
  { value: "lastModified-asc", label: "Oldest Illustration" },
  { value: "songDate-desc", label: "Newest Song" },
  { value: "songDate-asc", label: "Oldest Song" },
  { value: "title-asc", label: "Title (A-Z)" },
  { value: "title-desc", label: "Title (Z-A)" },
  { value: "illustrationCount-desc", label: "Most Images" },
  { value: "illustrationCount-asc", label: "Fewest Images" },
];

export function IllustrationsTable({ adminApi }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [prioritizeUnillustrated, setPrioritizeUnillustrated] =
    useLocalStorageState<boolean>(
      "admin/illustration-table/prioritize-unillustrated",
      { defaultValue: true },
    );

  const [imageModelFilter, setImageModelFilter] = useState<string[]>([]);
  const [summaryModelFilter, setSummaryModelFilter] = useState<string[]>([]);
  const [promptVersionFilter, setPromptVersionFilter] = useState<string[]>(
    [],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("lastModified");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  // Visibility cards are show/hide toggles (single click) that also support
  // "show only" via double click (`isolate`). External and deleted are hidden
  // by default; hidden songs are always excluded (no card reveals them).
  const [showExternal, setShowExternal] = useLocalStorageState<boolean>(
    "admin/illustration-table/show-external",
    { defaultValue: false },
  );
  const [showDeleted, setShowDeleted] = useLocalStorageState<boolean>(
    "admin/illustration-table/show-deleted-songs",
    { defaultValue: false },
  );
  const [isolate, setIsolate] = useState<ShowOnly | null>(null);
  // Distinguishes a single click (toggle) from a double click (show only).
  const pendingClickRef = useRef<{
    attr: ShowOnly;
    timer: ReturnType<typeof setTimeout>;
    run: () => void;
  } | null>(null);

  const { groupedData, promptsById, filterOptions, isLoading, isError, error } =
    useIllustrationsTableData(adminApi);

  const stats = useMemo(() => {
    const groups = Object.values(
      groupedData,
    ) as SongWithIllustrationsAndPrompts[];
    const visible = groups.filter(isVisibleSong);
    // Coverage counts follow the external toggle so the cards match the list;
    // the visibility cards themselves show full category totals.
    const inScope = visible.filter(
      (g) => showExternal || !g.song.externalSource,
    );
    return {
      songs: inScope.length,
      illustrated: inScope.filter(hasCurrentIllustration).length,
      unillustrated: inScope.filter((g) => !hasCurrentIllustration(g)).length,
      assets: groups.reduce(
        (acc, g) => acc + g.illustrations.filter((i) => !i.deleted).length,
        0,
      ),
      external: visible.filter((g) => g.song.externalSource).length,
      deleted: groups.filter((g) => g.song.deleted).length,
    };
  }, [groupedData, showExternal]);

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

    // Double-click "show only" isolates a category; otherwise the visibility
    // toggles compose. Hidden songs are always excluded (no card reveals them).
    if (isolate === "deleted") {
      groups = groups.filter(([, group]) => group.song.deleted);
    } else if (isolate === "external") {
      groups = groups.filter(
        ([, group]) => isVisibleSong(group) && !!group.song.externalSource,
      );
    } else {
      groups = groups.filter(([, group]) => {
        if (group.song.hidden) return false;
        if (!showDeleted && group.song.deleted) return false;
        if (!showExternal && group.song.externalSource) return false;
        return true;
      });
    }

    // Coverage filter (single-select).
    if (coverageFilter === "illustrated") {
      groups = groups.filter(([, group]) => hasCurrentIllustration(group));
    } else if (coverageFilter === "unillustrated") {
      groups = groups.filter(([, group]) => !hasCurrentIllustration(group));
    } else if (coverageFilter === "assets") {
      groups = groups.filter(([, group]) =>
        group.illustrations.some((i) => !i.deleted),
      );
    }

    if (imageModelFilter.length > 0) {
      groups = groups.filter(
        ([, group]) =>
          Array.isArray(group.illustrations) &&
          group.illustrations.some((i) =>
            imageModelFilter.includes(i.imageModel),
          ),
      );
    }

    if (summaryModelFilter.length > 0) {
      groups = groups.filter(([, group]) => {
        if (!Array.isArray(group.illustrations)) return false;
        return group.illustrations.some((i) => {
          const prompt = promptsById.get(i.promptId);
          return !!prompt && summaryModelFilter.includes(prompt.summaryModel);
        });
      });
    }

    if (promptVersionFilter.length > 0) {
      groups = groups.filter(([, group]) => {
        if (!Array.isArray(group.illustrations)) return false;
        return group.illustrations.some((i) => {
          const prompt = promptsById.get(i.promptId);
          return (
            !!prompt &&
            promptVersionFilter.includes(prompt.summaryPromptVersion)
          );
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
        case "songDate":
          return group.song.createdAt
            ? new Date(group.song.createdAt)
            : new Date(0);
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
    isolate,
    showExternal,
    showDeleted,
    coverageFilter,
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

  // Coverage is single-select ("Songs" is the reset).
  const selectCoverage = (coverage: CoverageFilter) => {
    setCoverageFilter(coverage);
    setCurrentPage(0);
  };

  const showByAttr: Record<ShowOnly, boolean> = {
    external: showExternal,
    deleted: showDeleted,
  };
  const setShowByAttr: Record<ShowOnly, (v: boolean) => void> = {
    external: setShowExternal,
    deleted: setShowDeleted,
  };

  // Single click toggles show/hide; double click isolates ("show only"). A
  // short timer tells the two apart; a second click on the SAME card isolates.
  const onAttrClick = (attr: ShowOnly) => {
    const pending = pendingClickRef.current;
    if (pending && pending.attr === attr) {
      clearTimeout(pending.timer);
      pendingClickRef.current = null;
      setIsolate((cur) => (cur === attr ? null : attr));
      setCurrentPage(0);
      return;
    }
    if (pending) {
      clearTimeout(pending.timer);
      pending.run();
    }
    const wasShown = showByAttr[attr];
    const run = () => {
      pendingClickRef.current = null;
      setIsolate(null);
      setShowByAttr[attr](!wasShown);
      setCurrentPage(0);
    };
    pendingClickRef.current = { attr, run, timer: setTimeout(run, 220) };
  };

  // Highlight shown/isolated cards; dim hidden ones. In "show only" mode only
  // the isolated card is active (badged), the rest are dimmed.
  const attrCardState = (attr: ShowOnly) => {
    if (isolate) {
      return attr === isolate
        ? { active: true, badge: "only" }
        : { dimmed: true };
    }
    return showByAttr[attr] ? { active: true } : { dimmed: true };
  };

  // Focusing on / showing deleted songs reveals their deleted assets too.
  const showDeletedAssets = showDeleted || isolate === "deleted";

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

      <ControlPanel
        searchTerm={searchTerm}
        onSearchChange={withPageReset(setSearchTerm)}
        searchPosition="bottom"
        header={
          <StatsBar
            groups={[
              {
                label: "Coverage",
                hint: "choose one",
                items: [
                  {
                    label: "Songs",
                    value: stats.songs,
                    icon: Library,
                    onClick: () => selectCoverage("all"),
                    active: coverageFilter === "all",
                  },
                  {
                    label: "Illustrated",
                    value: stats.illustrated,
                    icon: ImageIcon,
                    className: "text-emerald-600",
                    onClick: () => selectCoverage("illustrated"),
                    active: coverageFilter === "illustrated",
                  },
                  {
                    label: "Unillustrated",
                    value: stats.unillustrated,
                    icon: AlertCircle,
                    className: "text-red-600",
                    onClick: () => selectCoverage("unillustrated"),
                    active: coverageFilter === "unillustrated",
                  },
                  {
                    label: "Assets",
                    value: stats.assets,
                    icon: Layers,
                    className: "text-blue-600",
                    onClick: () => selectCoverage("assets"),
                    active: coverageFilter === "assets",
                  },
                ],
              },
              {
                label: "Visibility",
                hint: "click show/hide · double-click = only",
                items: [
                  {
                    label: "External",
                    value: stats.external,
                    icon: Globe,
                    className: "text-violet-600",
                    onClick: () => onAttrClick("external"),
                    ...attrCardState("external"),
                  },
                  {
                    label: "Deleted",
                    value: stats.deleted,
                    icon: Trash2,
                    className: "text-red-600",
                    onClick: () => onAttrClick("deleted"),
                    ...attrCardState("deleted"),
                  },
                ],
              },
            ]}
          />
        }
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
              <Filter className="w-3 h-3 mr-2" /> Filter & sort
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <MultiSelectCard
                label="Prompt version"
                allLabel="All Prompts"
                icon={Hash}
                values={promptVersionFilter}
                onValuesChange={withPageReset(setPromptVersionFilter)}
                options={filterOptions.promptVersions.map((v) => ({
                  value: v,
                  label: v,
                }))}
              />
              <MultiSelectCard
                label="Summary model"
                allLabel="All Summaries"
                icon={FileText}
                values={summaryModelFilter}
                onValuesChange={withPageReset(setSummaryModelFilter)}
                options={filterOptions.summaryModels.map((m) => ({
                  value: m,
                  label: m,
                }))}
              />
              <MultiSelectCard
                label="Image model"
                allLabel="All Images"
                icon={ImageIcon}
                values={imageModelFilter}
                onValuesChange={withPageReset(setImageModelFilter)}
                options={filterOptions.imageModels.map((m) => ({
                  value: m,
                  label: m,
                }))}
              />
              <SelectCard
                label="Sort by"
                icon={ArrowDownUp}
                iconClassName="text-primary"
                value={`${sortKey}-${sortDirection}`}
                onValueChange={handleSortChange}
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-muted/40 px-4 py-2.5 rounded-lg border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Options
            </span>
            <ToggleCheckbox
              checked={prioritizeUnillustrated}
              onCheckedChange={setPrioritizeUnillustrated}
              label="Unillustrated first"
            />
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
              showDeleted={showDeletedAssets}
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
