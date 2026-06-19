import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  ExternalLink,
  EyeOff,
  FileX,
  Globe,
  Library,
  ListRestart,
  RotateCcw,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Sparkles,
  Trash2,
  User,
  GitCompare,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { SongDataDB, SONG_SOURCES, SongVersionDB } from "src/lib/db/schema";
import { SongVersionAdminApi } from "src/worker/api/api-types";
import useLocalStorageState from "use-local-storage-state";
import ReactDiffViewer from "react-diff-viewer-continued";
import { useTheme } from "next-themes";
import SongVersionStatusBadge from "~/components/SongVersionStatusBadge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { AdminApi } from "~/../worker/api-client";
import ConfirmationDialog from "../../../components/dialogs/confirmation-dialog";
import DeletePrompt from "../../../components/dialogs/delete-prompt";
import {
  useApproveVersion,
  useDeleteSong,
  useDeleteVersion,
  useGenerateIllustration,
  useIllustrationOptions,
  useRejectVersion,
  useResetVersionDB,
  useRestoreSong,
  useRestoreVersion,
  useSongsAdmin,
  useUpdateSong,
  useUsersAdmin,
  useVersionsAdmin,
} from "../../../services/admin-hooks";
import { ActionButtons } from "./shared/action-buttons";
import { ControlPanel } from "./control-panel";
import { ExternalSourceBadge } from "./external-source-badge";
import { Pagination } from "./shared/pagination";
import { StatsBar } from "./stats-bar";
import { ToggleCheckbox } from "./toggle-checkbox";
import { formatChordpro } from "~/lib/formatChordpro";

// --- TYPES & CONSTANTS ---

const AUTO_ILLUSTRATION_STORAGE_KEY = "admin-auto-generate-illustration";
const PAGE_SIZE = 25;

type ExternalSource = {
  sourceId: (typeof SONG_SOURCES)[number];
  url: string;
};

/** Minimal shape of the admin users query needed to resolve version authors. */
type AdminUsers =
  | { users: { id: string; name?: string | null; nickname?: string | null }[] }
  | null
  | undefined;

type SortableSong = SongDataDB & {
  title: string;
  artist: string;
  lastModified: Date;
  status: string;
  hasPendingVersions: boolean;
  externalSource: ExternalSource | null;
  submittedBy: string | null;
};

type SortConfig = {
  key: keyof Omit<
    SortableSong,
    | "hasPendingVersions"
    | "currentVersionId"
    | "currentIllustrationId"
    | "externalSource"
    | "submittedBy"
  >;
  direction: "ascending" | "descending";
};

type StatusFilter =
  | "all"
  | "pending"
  | "published"
  | "archived"
  | "rejected"
  | "empty";

/**
 * The status filter lives entirely in the StatsBar: each card is a single-select
 * status, with "all" acting as the reset. `stat` maps the card to its count key.
 */
const STATUS_CARDS: {
  value: StatusFilter;
  label: string;
  stat: keyof SongStats;
  icon: React.ElementType;
  className?: string;
}[] = [
  { value: "all", label: "Songs", stat: "total", icon: Library },
  {
    value: "pending",
    label: "Pending",
    stat: "pending",
    icon: Clock,
    className: "text-orange-600",
  },
  {
    value: "published",
    label: "Published",
    stat: "published",
    icon: CheckCircle2,
    className: "text-emerald-600",
  },
  {
    value: "archived",
    label: "Archived",
    stat: "archived",
    icon: Archive,
    className: "text-amber-600",
  },
  {
    value: "rejected",
    label: "Rejected",
    stat: "rejected",
    icon: Ban,
    className: "text-rose-600",
  },
  {
    value: "empty",
    label: "No version",
    stat: "empty",
    icon: FileX,
    className: "text-muted-foreground",
  },
];

/** Independent visibility attributes, isolated via their own StatsBar cards. */
type AttrIsolate = "external" | "hidden" | "deleted";

const ATTR_CARDS: {
  value: AttrIsolate;
  label: string;
  stat: keyof SongStats;
  icon: React.ElementType;
  className?: string;
}[] = [
  {
    value: "external",
    label: "External",
    stat: "external",
    icon: Globe,
    className: "text-violet-600",
  },
  {
    value: "hidden",
    label: "Hidden",
    stat: "hidden",
    icon: EyeOff,
    className: "text-muted-foreground",
  },
  {
    value: "deleted",
    label: "Deleted",
    stat: "deleted",
    icon: Trash2,
    className: "text-red-600",
  },
];

type SongStats = {
  total: number;
  pending: number;
  published: number;
  archived: number;
  rejected: number;
  empty: number;
  external: number;
  hidden: number;
  deleted: number;
};

type DiffViewState = {
  isOpen: boolean;
  songTitle: string;
  version: SongVersionDB;
  target: SongVersionDB;
  targetLabel: string;
};

// --- 1. MODALS & VIEWERS ---

function DiffViewerModal({
  diffView,
  onClose,
}: {
  diffView: DiffViewState | null;
  onClose: () => void;
}) {
  const { theme, systemTheme } = useTheme();
  const isDark = useMemo(
    () =>
      theme === "dark" ||
      (theme === "system" && systemTheme === "dark") ||
      document.documentElement.classList.contains("dark"),
    [theme, systemTheme],
  );

  const [isSplitView, setIsSplitView] = useLocalStorageState(
    "admin-diff-split-view",
    {
      defaultValue: true,
    },
  );

  return (
    <Dialog
      open={diffView?.isOpen ?? false}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="!max-w-[95vw] sm:!max-w-[95vw] !w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden p-0 sm:p-0 bg-card border-border shadow-lg">
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-muted-foreground" />
            Comparing "{diffView?.songTitle}"
          </DialogTitle>

          <div className="flex items-center space-x-2 mr-6">
            <Label
              htmlFor="split-view"
              className="text-sm font-medium cursor-pointer"
            >
              Split View
            </Label>
            <Switch
              id="split-view"
              checked={isSplitView}
              onCheckedChange={setIsSplitView}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-background/50 p-4">
          <div className="border border-border rounded-md overflow-hidden bg-card h-full w-full">
            {diffView && (
              <ReactDiffViewer
                oldValue={formatChordpro(diffView.target.chordpro)}
                newValue={formatChordpro(diffView.version.chordpro)}
                splitView={isSplitView}
                leftTitle={`${diffView.targetLabel} (Key: ${diffView.target.key || "N/A"})`}
                rightTitle={`This Version (Key: ${diffView.version.key || "N/A"})`}
                hideLineNumbers={false}
                useDarkTheme={isDark}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: "transparent",
                      addedBackground: "rgba(20, 70, 32, 0.4)",
                      removedBackground: "rgba(80, 20, 20, 0.4)",
                      wordAddedBackground: "rgba(30, 110, 45, 0.6)",
                      wordRemovedBackground: "rgba(120, 30, 30, 0.6)",
                    },
                    light: {
                      diffViewerBackground: "transparent",
                    },
                  },
                  diffContainer: { width: "100%" },
                  content: { width: "100%" },
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- 2. SONG VERSION ITEM (Individual Version Logic) ---

interface SongVersionItemProps {
  song: SortableSong;
  version: SongVersionDB;
  parentVersion: SongVersionDB | undefined | null;
  currentVersion: SongVersionDB | undefined | null;
  isCurrentActive: boolean;
  users: AdminUsers;
  onApprove: () => void;
  onReject: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSetCurrent: () => void;
  onDiff: (target: SongVersionDB, label: string) => void;
  isApprovePending: boolean;
}

function SongVersionItem({
  song,
  version,
  parentVersion,
  currentVersion,
  isCurrentActive,
  users,
  onApprove,
  onReject,
  onRestore,
  onDelete,
  onSetCurrent,
  onDiff,
  isApprovePending,
}: SongVersionItemProps) {
  const navigate = useNavigate({ from: "/admin" });

  const author = useMemo(() => {
    if (!users) return null;
    const user = users.users.find((u) => u.id == version.userId);
    return user?.nickname || user?.name;
  }, [users, version.userId]);

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
        isCurrentActive
          ? "border-primary shadow-md bg-primary/5"
          : "border-border hover:border-border/80 bg-card hover:bg-accent/40"
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onSetCurrent}
          disabled={isCurrentActive || isApprovePending}
          title={
            isCurrentActive
              ? "Current Active Version"
              : "Set as Current Version"
          }
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            isCurrentActive
              ? "bg-primary/20 text-primary cursor-default"
              : "bg-muted text-muted-foreground/30 hover:bg-primary/10 hover:text-primary cursor-pointer"
          }`}
        >
          <Star
            className={`h-4 w-4 ${isCurrentActive ? "fill-primary" : ""}`}
          />
        </button>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground/90">
              {version.title}
            </span>
            <SongVersionStatusBadge status={version.status} />
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span>{new Date(version.createdAt).toLocaleDateString()}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            {author && (
              <span className="bg-muted px-1.5 py-0.5 rounded">{author}</span>
            )}
            {version.key && (
              <span className="bg-muted px-1.5 py-0.5 rounded">
                Key: {version.key}
              </span>
            )}
            {version.capo !== null && (
              <span className="bg-muted px-1.5 py-0.5 rounded">
                Capo: {version.capo}
              </span>
            )}
            {version.tempo !== null && (
              <span className="bg-muted px-1.5 py-0.5 rounded">
                BPM: {version.tempo}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-background p-1 px-2 rounded-lg border shadow-sm">
        {parentVersion && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDiff(parentVersion, "Parent Version")}
          >
            <GitCompare className="w-4 h-4 mr-1" /> Diff Parent
          </Button>
        )}

        {currentVersion && currentVersion.id !== version.id && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDiff(currentVersion, "Current Active Version")}
          >
            <GitCompare className="w-4 h-4 mr-1" /> Diff Current
          </Button>
        )}

        <div className="w-px h-6 bg-border mx-2"></div>

        {version.status === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200"
              onClick={onApprove}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-700 hover:text-red-800 hover:bg-red-50"
              onClick={onReject}
            >
              Reject
            </Button>
          </>
        )}
        {(version.status === "rejected" || version.status === "deleted") && (
          <Button size="sm" variant="ghost" onClick={onRestore}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Restore
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          onClick={() =>
            window.open(`/song/${song.id}?version=${version.id}`, "_blank")
          }
        >
          <ExternalLink className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate({
              to: "/edit/$songId",
              params: { songId: song.id },
              search: { version: version.id },
            })
          }
        >
          <Edit className="h-4 w-4" />
        </Button>
        <DeletePrompt
          title="Permanently Delete?"
          description="This will remove the data entirely."
          disabled={
            version.id === song.currentVersionId || version.status === "deleted"
          }
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

// --- 3. VERSION HISTORY TIMELINE ---

interface VersionHistoryTimelineProps {
  song: SortableSong;
  songVersions: SongVersionDB[];
  showDeleted: boolean;
  users: AdminUsers;
  onApproveVersion: (songId: string, versionId: string) => void;
  onRejectVersion: (songId: string, versionId: string) => void;
  onRestoreVersion: (songId: string, versionId: string) => void;
  onDeleteVersion: (songId: string, versionId: string) => void;
  onSetCurrentVersion: (songId: string, versionId: string) => void;
  onDiff: (
    version: SongVersionDB,
    target: SongVersionDB,
    label: string,
  ) => void;
  isApprovePending: boolean;
}

function VersionHistoryTimeline({
  song,
  songVersions,
  showDeleted,
  users,
  onApproveVersion,
  onRejectVersion,
  onRestoreVersion,
  onDeleteVersion,
  onSetCurrentVersion,
  onDiff,
  isApprovePending,
}: VersionHistoryTimelineProps) {
  const versionCount = (
    showDeleted
      ? songVersions
      : songVersions.filter((v) => v.status !== "deleted")
  ).length;

  const sortedFilteredVersions = songVersions
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .filter((version) => version.status !== "deleted" || showDeleted);

  return (
    <div className="p-6 pl-14 border-l-4 border-primary/60 my-2 mx-4 bg-background rounded-r-xl shadow-inner overflow-x-auto">
      <h4 className="font-semibold mb-4 flex items-center gap-2 text-primary/80">
        <Clock className="h-4 w-4" />
        Version Timeline
        <Badge variant="secondary" className="ml-2 font-mono">
          {versionCount}
        </Badge>
      </h4>
      <div className="space-y-3 min-w-[600px]">
        {sortedFilteredVersions.map((version) => {
          const parentVersion = version.parentId
            ? songVersions.find((v) => v.id === version.parentId)
            : null;
          const currentVersion = song.currentVersionId
            ? songVersions.find((v) => v.id === song.currentVersionId)
            : null;
          const isCurrentActive = version.id === song.currentVersionId;

          return (
            <SongVersionItem
              key={version.id}
              song={song}
              version={version}
              parentVersion={parentVersion}
              currentVersion={currentVersion}
              isCurrentActive={isCurrentActive}
              users={users}
              onApprove={() => onApproveVersion(song.id, version.id)}
              onReject={() => onRejectVersion(song.id, version.id)}
              onRestore={() => onRestoreVersion(song.id, version.id)}
              onDelete={() => onDeleteVersion(song.id, version.id)}
              onSetCurrent={() =>
                !isCurrentActive && onSetCurrentVersion(song.id, version.id)
              }
              onDiff={(target, label) => onDiff(version, target, label)}
              isApprovePending={isApprovePending}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- 4. SONG TABLE ROW ---

interface SongTableRowProps extends VersionHistoryTimelineProps {
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onUpdateHidden: (songId: string, hidden: boolean) => void;
  onRestoreSong: (songId: string) => void;
  onDeleteSong: (songId: string) => void;
}

function SongTableRow({
  song,
  songVersions,
  isExpanded,
  showDeleted,
  users,
  onToggleExpand,
  onUpdateHidden,
  onRestoreSong,
  onDeleteSong,
  onApproveVersion,
  onRejectVersion,
  onRestoreVersion,
  onDeleteVersion,
  onSetCurrentVersion,
  onDiff,
  isApprovePending,
}: SongTableRowProps) {
  const navigate = useNavigate({ from: "/admin" });
  const pendingCount = songVersions.filter(
    (v) => v.status === "pending",
  ).length;

  return (
    <React.Fragment>
      <TableRow
        className={`cursor-pointer hover:bg-accent/50 transition-colors ${
          isExpanded ? "bg-accent/30 border-b-transparent" : ""
        }`}
        onClick={() => onToggleExpand(song.id)}
      >
        <TableCell className="text-center">
          <div className="flex items-center justify-center bg-background border shadow-sm w-6 h-6 rounded-md">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </div>
        </TableCell>
        <TableCell
          className={`font-semibold text-base ${song.deleted ? "opacity-50 line-through" : ""}`}
        >
          {song.title}
        </TableCell>
        <TableCell
          className={`text-muted-foreground ${song.deleted ? "opacity-50" : ""}`}
        >
          {song.artist}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-2 items-center">
            <SongVersionStatusBadge status={song.status} />
            {song.externalSource && (
              <ExternalSourceBadge
                sourceId={song.externalSource.sourceId}
                url={song.externalSource.url}
              />
            )}
            {pendingCount > 0 && !song.deleted && song.status !== "pending" && (
              <Badge
                variant="outline"
                className="bg-orange-50 text-orange-700 border-orange-200 animate-pulse"
              >
                {pendingCount} Pending
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap">
          {song.submittedBy ? (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 opacity-60" />
              {song.submittedBy}
            </span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap">
          {song.lastModified.toLocaleDateString()}
        </TableCell>
        <TableCell>
          <Switch
            checked={!song.hidden}
            disabled={song.deleted}
            onCheckedChange={(checked) => onUpdateHidden(song.id, !checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()} className="pr-4">
          <div className="flex justify-end">
            <ActionButtons>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: `/edit/${song.id}` })}
                disabled={song.deleted}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {song.deleted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onRestoreSong(song.id)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Restore
                </Button>
              ) : (
                <DeletePrompt
                  title={`Delete "${song.title}"?`}
                  description="Are you sure?"
                  onDelete={() => onDeleteSong(song.id)}
                />
              )}
            </ActionButtons>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-accent/20">
          <TableCell colSpan={8} className="p-0">
            <VersionHistoryTimeline
              song={song}
              songVersions={songVersions}
              showDeleted={showDeleted}
              users={users}
              onApproveVersion={onApproveVersion}
              onRejectVersion={onRejectVersion}
              onRestoreVersion={onRestoreVersion}
              onDeleteVersion={onDeleteVersion}
              onSetCurrentVersion={onSetCurrentVersion}
              onDiff={onDiff}
              isApprovePending={isApprovePending}
            />
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}

// --- 5. SETTINGS BAR ---

interface SongsTableSettingsBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  showExternal: boolean;
  onShowExternalChange: (val: boolean) => void;
  showDeleted: boolean;
  onShowDeletedChange: (val: boolean) => void;
  showHidden: boolean;
  onShowHiddenChange: (val: boolean) => void;
  autoGenerateIllustration: boolean;
  onAutoGenerateIllustrationChange: (val: boolean) => void;
  isResetPending: boolean;
  onResetDB: () => void;
  /** The isolated attribute card forces (and locks) its matching checkbox. */
  attrIsolate: AttrIsolate | null;
}

function SongsTableSettingsBar({
  searchTerm,
  onSearchChange,
  showExternal,
  onShowExternalChange,
  showDeleted,
  onShowDeletedChange,
  showHidden,
  onShowHiddenChange,
  autoGenerateIllustration,
  onAutoGenerateIllustrationChange,
  isResetPending,
  onResetDB,
  attrIsolate,
}: SongsTableSettingsBarProps) {
  const boxed = "bg-background px-3 py-1.5 rounded-md border shadow-sm";
  // Each attribute card forces its own checkbox on and locks only that one.
  const lockedTitle = "Forced on by the active card above";
  return (
    <ControlPanel searchTerm={searchTerm} onSearchChange={onSearchChange}>
      <div className="p-4 bg-muted/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
            <Settings2 className="w-3 h-3 mr-2" /> Quick Settings
          </span>
          <ToggleCheckbox
            checked={attrIsolate === "external" ? true : showExternal}
            onCheckedChange={onShowExternalChange}
            label="Show external"
            icon={Globe}
            iconClassName="text-violet-500"
            className={boxed}
            disabled={attrIsolate === "external"}
            title={attrIsolate === "external" ? lockedTitle : undefined}
          />
          <ToggleCheckbox
            checked={attrIsolate === "deleted" ? true : showDeleted}
            onCheckedChange={onShowDeletedChange}
            label="Show deleted"
            className={boxed}
            disabled={attrIsolate === "deleted"}
            title={attrIsolate === "deleted" ? lockedTitle : undefined}
          />
          <ToggleCheckbox
            checked={attrIsolate === "hidden" ? true : showHidden}
            onCheckedChange={onShowHiddenChange}
            label="Show hidden"
            icon={EyeOff}
            className={boxed}
            disabled={attrIsolate === "hidden"}
            title={attrIsolate === "hidden" ? lockedTitle : undefined}
          />
          <ToggleCheckbox
            checked={autoGenerateIllustration}
            onCheckedChange={onAutoGenerateIllustrationChange}
            label="Auto-illustrate on approval (if none exists)"
            icon={Sparkles}
            iconClassName="text-amber-500"
            className={boxed}
          />
        </div>

        <ConfirmationDialog
          trigger={
            <Button
              variant="destructive"
              size="sm"
              className="shadow-sm"
              disabled={isResetPending}
            >
              <ListRestart className="mr-2 h-4 w-4" />
              {isResetPending ? "Resetting..." : "Reset DB Version"}
            </Button>
          }
          title="Reset Database Version"
          description={
            <div className="space-y-2">
              <p>
                <strong>Warning:</strong> This forces all clients to reload
                their song database.
              </p>
              <p>Use this when:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Multiple songs have been updated</li>
                <li>Critical changes need immediate propagation</li>
              </ul>
            </div>
          }
          confirmText="Yes, Reset DB Version"
          cancelText="Cancel"
          onConfirm={onResetDB}
          isLoading={isResetPending}
        />
      </div>
    </ControlPanel>
  );
}

// --- 6. MAIN COMPONENT (Container) ---

export default function SongsTable({ adminApi }: { adminApi: AdminApi }) {
  const [searchTerm, setSearchTerm] = useState("");
  // Status (single-select) and attribute isolation (single-select) are
  // independent dimensions, both driven by the StatsBar cards.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [attrIsolate, setAttrIsolate] = useState<AttrIsolate | null>(null);
  // Visibility toggles compose with the above; hidden songs show by default.
  const [showExternal, setShowExternal] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showHidden, setShowHidden] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());
  const [diffView, setDiffView] = useState<DiffViewState | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "lastModified",
    direction: "descending",
  });

  const [autoGenerateIllustration, setAutoGenerateIllustration] =
    useLocalStorageState(AUTO_ILLUSTRATION_STORAGE_KEY, {
      defaultValue: false,
    });

  const backendDropdownOptions = useIllustrationOptions();

  // Queries
  const { data: songs, isLoading: songsLoading } = useSongsAdmin(adminApi);
  const { data: versions, isLoading: versionsLoading } =
    useVersionsAdmin(adminApi);
  const { data: users } = useUsersAdmin(adminApi, { limit: 100, offset: 0 });

  // Mutations
  const updateSongMutation = useUpdateSong(adminApi);
  const deleteSongMutation = useDeleteSong(adminApi);
  const restoreSongMutation = useRestoreSong(adminApi);
  const resetDBMutation = useResetVersionDB(adminApi);
  const approveVersionMutation = useApproveVersion(adminApi);
  const rejectVersionMutation = useRejectVersion(adminApi);
  const deleteVersionMutation = useDeleteVersion(adminApi);
  const restoreVersionMutation = useRestoreVersion(adminApi);
  const generateIllustrationMutation = useGenerateIllustration(adminApi);

  const usersById = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name?: string | null; nickname?: string | null }
    >();
    users?.users?.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const versionsBySong = useMemo(() => {
    if (!versions) return {};
    return versions.reduce(
      (acc, version) => {
        if (!acc[version.songId]) acc[version.songId] = [];
        acc[version.songId].push(version);
        return acc;
      },
      {} as Record<string, SongVersionAdminApi[]>,
    );
  }, [versions]);

  const enrichedSongs = useMemo<SortableSong[]>(() => {
    if (!songs) return [];

    const getWorkingVersion = (
      song: SongDataDB,
      songVersions: SongVersionAdminApi[],
    ) =>
      versions?.find((v) => v.id === song.currentVersionId) ??
      songVersions.find((v) => ["published"].includes(v.status)) ??
      songVersions.find((v) => ["archived"].includes(v.status)) ??
      songVersions.find((v) => ["pending"].includes(v.status)) ??
      songVersions.find((v) => ["rejected"].includes(v.status));

    return songs.map((song) => {
      const songVersions = versionsBySong[song.id] || [];
      const workingVersion = getWorkingVersion(song, songVersions);
      const submitter = workingVersion
        ? usersById.get(workingVersion.userId)
        : undefined;
      return {
        ...song,
        title: workingVersion?.title || "N/A",
        artist: workingVersion?.artist || "N/A",
        lastModified: songVersions.reduce(
          (latest, v) =>
            new Date(v.createdAt) > latest ? new Date(v.createdAt) : latest,
          new Date(0),
        ),
        status: song.deleted ? "deleted" : workingVersion?.status || "empty",
        hasPendingVersions: songVersions.some((v) => v.status === "pending"),
        externalSource: workingVersion?.importSourceId
          ? {
              sourceId: workingVersion.importSourceId,
              url: workingVersion.importUrl ?? "#",
            }
          : null,
        submittedBy: submitter?.nickname || submitter?.name || null,
      };
    });
  }, [songs, versions, versionsBySong, usersById]);

  const stats = useMemo<SongStats>(() => {
    const live = enrichedSongs.filter((s) => !s.deleted);
    const byStatus = (status: string) =>
      live.filter((s) => s.status === status).length;
    return {
      total: live.length,
      pending: live.filter((s) => s.hasPendingVersions).length,
      published: byStatus("published"),
      archived: byStatus("archived"),
      rejected: byStatus("rejected"),
      empty: byStatus("empty"),
      external: live.filter((s) => s.externalSource).length,
      hidden: live.filter((s) => s.hidden).length,
      deleted: enrichedSongs.filter((s) => s.deleted).length,
    };
  }, [enrichedSongs]);

  const filteredSortedSongs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    // An isolated attribute forces its own visibility on; the other toggles
    // still compose, so only the isolated dimension is "locked".
    const effShowExternal = attrIsolate === "external" ? true : showExternal;
    const effShowDeleted = attrIsolate === "deleted" ? true : showDeleted;
    const effShowHidden = attrIsolate === "hidden" ? true : showHidden;
    const filtered = enrichedSongs.filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(term) ||
        song.artist.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      // Status (single-select); "all" matches everything.
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
            ? song.hasPendingVersions
            : song.status === statusFilter;
      if (!matchesStatus) return false;

      // Attribute isolation narrows to exactly the clicked attribute.
      if (attrIsolate === "external" && !song.externalSource) return false;
      if (attrIsolate === "deleted" && !song.deleted) return false;
      if (attrIsolate === "hidden" && !song.hidden) return false;

      // Visibility toggles (composing).
      if (!effShowExternal && song.externalSource) return false;
      if (!effShowDeleted && song.deleted) return false;
      if (!effShowHidden && song.hidden) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (a.hasPendingVersions && !b.hasPendingVersions) return -1;
      if (!a.hasPendingVersions && b.hasPendingVersions) return 1;
      if (a[sortConfig.key] < b[sortConfig.key])
        return sortConfig.direction === "ascending" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key])
        return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [
    enrichedSongs,
    searchTerm,
    showDeleted,
    showExternal,
    showHidden,
    statusFilter,
    attrIsolate,
    sortConfig,
  ]);

  if (songsLoading || versionsLoading) return <div>Loading...</div>;
  if (!songs || !versions) return <div>Error loading data.</div>;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSortedSongs.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedSongs = filteredSortedSongs.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  const toggleSongExpansion = (id: string) => {
    const next = new Set(expandedSongs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSongs(next);
  };

  const handleApproveVersion = (songId: string, versionId: string) => {
    const song = songs.find((s) => s.id === songId);
    const hasNoIllustration = !song?.currentIllustrationId;
    approveVersionMutation.mutate(
      { songId, versionId },
      {
        onSuccess: () => {
          toast.success("Version approved and published");
          if (autoGenerateIllustration && hasNoIllustration) {
            toast.info("Auto-generating illustration...");
            generateIllustrationMutation.mutate({
              songId,
              promptVersion: backendDropdownOptions.promptVersions.default,
              summaryModel: backendDropdownOptions.summaryModels.default,
              imageModel: backendDropdownOptions.imageModels.default,
              setAsActive: true,
            });
          }
        },
        onError: () => toast.error("Failed to approve version"),
      },
    );
  };

  const requestSort = (key: SortConfig["key"]) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    )
      direction = "descending";
    setSortConfig({ key, direction });
  };

  const renderHeader = (label: string, key: SortConfig["key"]) => (
    <TableHead
      onClick={() => requestSort(key)}
      className="cursor-pointer whitespace-nowrap hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center">
        {label}
        {!sortConfig || sortConfig.key !== key ? (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
        ) : sortConfig.direction === "ascending" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  // Filter changes reset to the first page so results aren't hidden off-page.
  const withPageReset =
    <T,>(setter: (val: T) => void) =>
    (val: T) => {
      setter(val);
      setCurrentPage(0);
    };

  // Selecting a status card is single-select; "Songs" (all) is the reset.
  const selectStatus = (status: StatusFilter) => {
    setStatusFilter(status);
    setCurrentPage(0);
  };

  // Clicking an active attribute card clears it; clicking another switches.
  const toggleAttr = (attr: AttrIsolate) => {
    setAttrIsolate((cur) => (cur === attr ? null : attr));
    setCurrentPage(0);
  };

  return (
    <div className="space-y-6 max-w-full pb-8">
      <StatsBar
        items={[
          ...STATUS_CARDS.map((c) => ({
            label: c.label,
            value: stats[c.stat],
            icon: c.icon,
            className: c.className,
            onClick: () => selectStatus(c.value),
            active: statusFilter === c.value,
          })),
          ...ATTR_CARDS.map((c) => ({
            label: c.label,
            value: stats[c.stat],
            icon: c.icon,
            className: c.className,
            onClick: () => toggleAttr(c.value),
            active: attrIsolate === c.value,
          })),
        ]}
      />

      <SongsTableSettingsBar
        searchTerm={searchTerm}
        onSearchChange={withPageReset(setSearchTerm)}
        showExternal={showExternal}
        onShowExternalChange={withPageReset(setShowExternal)}
        showDeleted={showDeleted}
        onShowDeletedChange={withPageReset(setShowDeleted)}
        showHidden={showHidden}
        onShowHiddenChange={withPageReset(setShowHidden)}
        autoGenerateIllustration={autoGenerateIllustration}
        onAutoGenerateIllustrationChange={setAutoGenerateIllustration}
        isResetPending={resetDBMutation.isPending}
        onResetDB={() => resetDBMutation.mutate()}
        attrIsolate={attrIsolate}
      />

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12 text-center"></TableHead>
                {renderHeader("Title", "title")}
                {renderHeader("Artist", "artist")}
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Submitted by</TableHead>
                {renderHeader("Last Modified", "lastModified")}
                <TableHead className="whitespace-nowrap">Visible</TableHead>
                <TableHead className="whitespace-nowrap text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSongs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No songs match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSongs.map((song) => (
                  <SongTableRow
                    key={song.id}
                    song={song}
                    songVersions={versionsBySong[song.id] || []}
                    isExpanded={expandedSongs.has(song.id)}
                    showDeleted={showDeleted}
                    users={users}
                    onToggleExpand={toggleSongExpansion}
                    onUpdateHidden={(songId, hidden) =>
                      updateSongMutation.mutate({ songId, song: { hidden } })
                    }
                    onRestoreSong={(songId) =>
                      restoreSongMutation.mutate(songId, {
                        onSuccess: () => toast.success("Song restored"),
                      })
                    }
                    onDeleteSong={(songId) =>
                      deleteSongMutation.mutate(songId, {
                        onSuccess: () => toast.success("Song deleted"),
                      })
                    }
                    onApproveVersion={handleApproveVersion}
                    onRejectVersion={(songId, versionId) =>
                      rejectVersionMutation.mutate(
                        { songId, versionId },
                        { onSuccess: () => toast.success("Rejected") },
                      )
                    }
                    onRestoreVersion={(songId, versionId) =>
                      restoreVersionMutation.mutate(
                        { songId, versionId },
                        { onSuccess: () => toast.success("Version restored") },
                      )
                    }
                    onDeleteVersion={(songId, versionId) =>
                      deleteVersionMutation.mutate(
                        { songId, versionId },
                        { onSuccess: () => toast.success("Permanently deleted") },
                      )
                    }
                    onSetCurrentVersion={(songId, versionId) =>
                      approveVersionMutation.mutate(
                        { songId, versionId },
                        {
                          onSuccess: () =>
                            toast.success("Set as current version"),
                        },
                      )
                    }
                    onDiff={(version, target, label) =>
                      setDiffView({
                        isOpen: true,
                        songTitle: song.title,
                        version,
                        target,
                        targetLabel: label,
                      })
                    }
                    isApprovePending={approveVersionMutation.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          hasNextPage={safePage < totalPages - 1}
          hasPrevPage={safePage > 0}
          onPageChange={setCurrentPage}
          totalItems={filteredSortedSongs.length}
          pageSize={PAGE_SIZE}
        />
      )}

      <DiffViewerModal diffView={diffView} onClose={() => setDiffView(null)} />
    </div>
  );
}
