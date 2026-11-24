import { ApiException } from "~/services/api-service";
import { VersionActionButton } from "~/components/VersionActionButton";
import { useQueryClient } from "@tanstack/react-query";
import { useIsOnline } from "~/hooks/use-is-online";
import { refreshSongVersions, versionAction, type VersionMutationInput } from "~/services/version-service";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Archive,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  Edit,
  ExternalLink,
  FileX,
  Globe,
  Library,
  ListRestart,
  RotateCcw,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Trash2,
  User,
  UserRoundPen,
  GitCompare,
  Youtube,
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SongDataDB, SongVersionWithSubmission as SongVersionDB } from "src/lib/db/schema";
import { SONG_SOURCES } from "src/lib/contracts/song-sources";
import type { SongVersionAdminApi } from "src/worker/api/api-types";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { AdminApi } from "~/../worker/api-client";
import ConfirmationDialog from "../../../components/dialogs/confirmation-dialog";
import DeletePrompt from "../../../components/dialogs/delete-prompt";
import {
  useApproveVersion,
  useDeleteSong,
  useDeleteVersion,
  useGenerateIllustration,
  useRejectVersion,
  useResetVersionDB,
  useRestoreSong,
  useRestoreVersion,
  useSongsAdmin,
  useUpdateVersion,
  useVersionsAdmin,
} from "../../../services/admin-hooks";
import { ActionButtons } from "./shared/action-buttons";
import { ControlPanel } from "./control-panel";
import { ExternalSourceBadge } from "./external-source-badge";
import { Pagination } from "./shared/pagination";
import { StatsBar } from "./stats-bar";
import { ToggleCheckbox } from "./toggle-checkbox";
import { formatChordpro } from "~/lib/formatChordpro";
import { parseYoutubeId } from "src/lib/youtube";
import YoutubeField from "~/features/Editor/components/YoutubeField";
import { SongMaxWidth } from "./song-max-width";
import { useSongLayoutPressures } from "./use-song-width-metrics";
import { SongRevisionHistory } from "~/components/SongRevisionHistory";
import { versionLabel } from "src/lib/version-label";
import { Description } from "~/components/ui/description";
import { Checkbox } from "~/components/ui/checkbox";
import { PublicationOption, VersionPublicationOptions } from "~/components/VersionPublicationOptions";
import { VersionReclassification } from "./version-reclassification";
import { VersionRename } from "./version-rename";
import { VersionAuthor } from "./version-author";
import { getWorkingVersion, getCorrectionParent } from "./version-selection";
import { isCorrectionSubmission, publicationOptions, requiresImportRevision, submissionReview } from "src/lib/song-version-policy";

// --- TYPES & CONSTANTS ---

const AUTO_ILLUSTRATION_STORAGE_KEY = "admin-auto-generate-illustration";
const HIDDEN_COLUMNS_STORAGE_KEY = "admin/songs-table/hidden-columns";
const PAGE_SIZE = 25;

const HIDEABLE_COLUMNS = [
  { id: "artist", label: "Artist" },
  { id: "status", label: "Status" },
  { id: "submittedBy", label: "Author" },
  { id: "lastModified", label: "Last modified" },
  { id: "maxRowWidth", label: "Max width" },
] as const;

type HideableColumn = (typeof HIDEABLE_COLUMNS)[number]["id"];

type ExternalSource = {
  sourceId: (typeof SONG_SOURCES)[number];
  url: string;
};

type SortableSong = SongDataDB & {
  title: string;
  artist: string;
  lastModified: Date;
  status: string;
  hasPendingVersions: boolean;
  hasYoutube: boolean;
  externalSource: ExternalSource | null;
  submittedBy: string | null;
  maxRowWidth: number | null;
};

type SortConfig = {
  key: keyof Omit<
    SortableSong,
    | "hasPendingVersions"
    | "hasYoutube"
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
  | "noYoutube"
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
    className: "text-warning",
  },
  {
    value: "published",
    label: "Published",
    stat: "published",
    icon: CheckCircle2,
    className: "text-success",
  },
  {
    value: "archived",
    label: "Archived",
    stat: "archived",
    icon: Archive,
    className: "text-muted-foreground",
  },
  {
    value: "rejected",
    label: "Rejected",
    stat: "rejected",
    icon: Ban,
    className: "text-destructive",
  },
  {
    value: "noYoutube",
    label: "No YouTube",
    stat: "noYoutube",
    icon: Youtube,
    className: "text-muted-foreground",
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
type AttrIsolate = "external" | "unofficial" | "deleted";

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
    className: "text-info",
  },
  {
    value: "unofficial",
    label: "Unofficial",
    stat: "unofficial",
    icon: Star,
    className: "text-muted-foreground",
  },
  {
    value: "deleted",
    label: "Deleted",
    stat: "deleted",
    icon: Trash2,
    className: "text-destructive",
  },
];

type SongStats = {
  total: number;
  pending: number;
  published: number;
  archived: number;
  rejected: number;
  noYoutube: number;
  empty: number;
  external: number;
  unofficial: number;
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

const diffColors = {
  addedBackground: "color-mix(in oklab, var(--success) 15%, transparent)",
  addedGutterBackground: "color-mix(in oklab, var(--success) 25%, transparent)",
  wordAddedBackground: "color-mix(in oklab, var(--success) 35%, transparent)",
  removedBackground: "color-mix(in oklab, var(--destructive) 15%, transparent)",
  removedGutterBackground: "color-mix(in oklab, var(--destructive) 25%, transparent)",
  wordRemovedBackground: "color-mix(in oklab, var(--destructive) 35%, transparent)",
};

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
      <DialogContent className="!max-w-[95vw] sm:!max-w-[95vw] !w-[95vw] h-[95vh] max-h-[95vh] !flex !flex-col overflow-hidden p-0 sm:p-0 bg-card border-border shadow-lg">
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-muted-foreground" />
            Compare versions · {diffView?.songTitle}
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

        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-background/50 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Comparing the latest saved content of two different versions. To compare earlier edits of the same version, open Revision history.
          </p>
          <div className="border border-border rounded-md bg-card min-h-full min-w-full w-full">
            {diffView && (
              <ReactDiffViewer
                oldValue={formatChordpro(diffView.target.chordpro)}
                newValue={formatChordpro(diffView.version.chordpro)}
                splitView={isSplitView}
                leftTitle={`${diffView.targetLabel}: ${versionLabel(diffView.target)} (Key: ${diffView.target.key || "N/A"})`}
                rightTitle={`Selected version: ${versionLabel(diffView.version)} (Key: ${diffView.version.key || "N/A"})`}
                hideLineNumbers={false}
                useDarkTheme={isDark}
                styles={{
                  variables: {
                    dark: {
                      ...diffColors,
                      diffViewerBackground: "transparent",
                    },
                    light: {
                      ...diffColors,
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

type ApprovalChoices = { force?: boolean; makeOfficial?: boolean; archivePrevious?: boolean; expectedOfficialId?: string | null; expectedTargetRevision?: number };

interface SongVersionItemProps {
  adminApi: AdminApi;
  versions: SongVersionDB[];
  song: SortableSong;
  version: SongVersionAdminApi;
  parentVersion: SongVersionDB | undefined | null;
  currentVersion: SongVersionDB | undefined | null;
  isCurrentActive: boolean;
  onApprove: (choices: ApprovalChoices) => void;
  onReject: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onToggleOfficial: () => void;
  onDiff: (target: SongVersionDB, label: string) => void;
  isApprovePending: boolean;
}

function SongVersionItem({
  adminApi,
  versions,
  song,
  version,
  parentVersion,
  currentVersion,
  isCurrentActive,
  onApprove,
  onReject,
  onRestore,
  onDelete,
  onToggleOfficial,
  onDiff,
  isApprovePending,
}: SongVersionItemProps) {
  const cache = useQueryClient();
  const online = useIsOnline();
  const importedSource = !version.importId && !!parentVersion?.importId;
  const review = submissionReview(version, !!parentVersion?.importId);
  const isCorrection = isCorrectionSubmission(review);
  const [archiving, setArchiving] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);
  const canChangeAuthor = !song.deleted && version.status !== "deleted" && !version.mergedIntoVersionId;
  const needsRevision = !isCurrentActive && requiresImportRevision(!!version.importId, version.revision);
  const canMerge = !isCorrection && !!getCorrectionParent(version, versions);
  const compareTargets = [
    ...(parentVersion && parentVersion.id !== version.id ? [{ version: parentVersion, label: "Source version" }] : []),
    ...(currentVersion && currentVersion.id !== version.id && currentVersion.id !== parentVersion?.id ? [{ version: currentVersion, label: "Official version" }] : []),
  ];
  async function archive() {
    setArchiving(true);
    try { await versionAction(song.id, version.id, "archive", version.revision); await refreshSongVersions(cache, song.id); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not archive version"); }
    finally { setArchiving(false); }
  }
  const reviewState = `${version.revision}:${parentVersion?.revision}:${song.currentVersionId}`;
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const override = overrideFor === reviewState;
  const [publication, setPublication] = useState<{ reviewState: string; makeOfficial: boolean; archivePrevious: boolean } | null>(null);
  const automaticallyOfficial = !song.currentVersionId && !version.importId;
  const { makeOfficial, archivePrevious } = publicationOptions({
    makeOfficial: automaticallyOfficial || (publication?.reviewState === reviewState ? publication.makeOfficial : review?.publication.makeOfficial),
    archivePrevious: publication?.reviewState === reviewState ? publication.archivePrevious : review?.publication.archivePrevious,
  }, { imported: importedSource, official: parentVersion?.id === song.currentVersionId });
  const canArchivePrevious = !!parentVersion && (parentVersion.id !== song.currentVersionId || makeOfficial);
  const targetChanged = version.baseRevision !== parentVersion?.revision;
  const officialChanged = version.baseOfficialVersionId !== song.currentVersionId;
  const changesPublication = !isCorrection && (archivePrevious || makeOfficial);
  const stale = version.status === "pending" && !!version.parentId && (isCorrection || changesPublication)
    && (targetChanged || (changesPublication && officialChanged));
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
        isCurrentActive
          ? "border-primary shadow-md bg-primary/5"
          : "border-border hover:border-border/80 bg-card hover:bg-accent/40"
      }`}
    >
      <div className="flex min-w-0 grow basis-80 items-center gap-4">
        <button
          type="button"
          onClick={onToggleOfficial}
          disabled={!online || song.deleted || isApprovePending || version.status !== "published" || needsRevision}
          aria-label="Official version"
          aria-pressed={isCurrentActive}
          title={isCurrentActive ? "Clear official selection" : needsRevision ? "Save a revision before making this import official" : "Make official"}
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors enabled:cursor-pointer ${
            isCurrentActive
              ? "bg-primary/20 text-primary enabled:hover:bg-primary/30"
              : "bg-muted text-muted-foreground/30 enabled:hover:bg-primary/10 enabled:hover:text-primary"
          }`}
        >
          <Star
            className={`h-4 w-4 ${isCurrentActive ? "fill-primary" : ""}`}
          />
        </button>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground/90">
              {versionLabel(version)}
            </span>
            {!song.deleted && version.status !== "deleted" && !version.mergedIntoVersionId && (
              <VersionRename adminApi={adminApi} version={version} online={online} />
            )}
            <SongVersionStatusBadge status={version.status} />


          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
            <span>{new Date(version.updatedAt).toLocaleString()}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span className="bg-muted px-1.5 py-0.5 rounded">{version.authorName}</span>
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
            <SongMaxWidth
              versionId={version.id}
              chordpro={version.chordpro}
            />
          </div>
        </div>
      </div>

      {version.status === "pending" && <div className="w-full space-y-1 text-sm">
        <p><span className="text-muted-foreground">Submitted as: </span><strong>{isCorrection ? "Revision" : (importedSource || version.submissionIntent === "new-version") ? "New version" : "Classification required"}</strong></p>
        <Description>{isCorrection
          ? <>Updates “{parentVersion ? versionLabel(parentVersion) : "the original version"}” and keeps its existing songbook choices.</>
          : "Approval publishes a separately selectable version."}</Description>
      </div>}
      {version.status === "pending" && !isCorrection && <VersionPublicationOptions>
        {(version.makeOfficialOnPublish || version.archivePreviousOnPublish) && <Description>Author requested: {[version.makeOfficialOnPublish && "make official", version.archivePreviousOnPublish && "archive previous version"].filter(Boolean).join(" · ")}.</Description>}
        <PublicationOption
          label="Make official"
          description={automaticallyOfficial
            ? "The first published curated version becomes official automatically."
            : version.importId && !song.currentVersionId
              ? "Approval makes this import official if it is the only published version. You can also choose it explicitly."
              : "Use this version by default for this song."}
          checked={makeOfficial}
          disabled={automaticallyOfficial || (importedSource && parentVersion?.id === song.currentVersionId)}
          onCheckedChange={(checked) => setPublication({ reviewState, makeOfficial: checked, archivePrevious: parentVersion?.id === song.currentVersionId && !checked ? false : archivePrevious })}
        />
        {parentVersion && <PublicationOption
          label={`Archive “${versionLabel(parentVersion)}”`}
          description={importedSource ? "Imported source copies are always archived unchanged when the curated version is published." : canArchivePrevious ? "Hide the previous version from discovery. Saved songbook choices and links keep working." : "Select Make official before archiving the current official version."}
          checked={archivePrevious && canArchivePrevious}
          disabled={importedSource || !canArchivePrevious}
          onCheckedChange={(checked) => setPublication({ reviewState, makeOfficial, archivePrevious: checked })}
        />}
      </VersionPublicationOptions>}
      {stale && <div className="w-full space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
        <p className="font-medium">{targetChanged ? "The target version changed after this suggestion was submitted." : "The official selection changed after this suggestion was submitted."}</p>
        <p className="text-muted-foreground">{isCorrection ? "Approving will replace the current sheet with this suggestion. Compare the changes before continuing." : "Publishing will apply the requested official selection and archival changes. Review the current version first."}</p>
        <label className="flex cursor-pointer items-start gap-3"><Checkbox className="mt-0.5" checked={override} onCheckedChange={(checked) => setOverrideFor(checked === true ? reviewState : null)} />I reviewed the current changes. Apply this suggestion anyway.</label>
      </div>}
      <div className="flex max-w-full flex-wrap items-center gap-2 [&>button]:h-8 [&>a]:h-8 [&>button]:min-w-8 [&>a]:min-w-8">
        {compareTargets.length > 0 && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <VersionActionButton><GitCompare className="size-4" /> Compare with… <ChevronDown className="size-4" /></VersionActionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Latest content of another version</DropdownMenuLabel>
            {compareTargets.map((target) => <DropdownMenuItem key={target.version.id} onSelect={() => onDiff(target.version, target.label)}>
              <div className="min-w-0"><div>{target.label}</div><Description className="max-w-64 truncate">{versionLabel(target.version)}</Description></div>
            </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>}

        <SongRevisionHistory songId={song.id} versionId={version.id} ownerId={version.userId} currentRevision={version.revision} status={version.status} merged={!!version.mergedIntoVersionId} iconOnly />


        {version.status === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-success hover:text-success hover:bg-success/10 border-success/30 dark:hover:bg-success/20 dark:border-success/30"
              onClick={() => onApprove(isCorrection ? { force: override } : { force: override, makeOfficial, archivePrevious: archivePrevious && canArchivePrevious })} disabled={!review || isApprovePending || (stale && !override)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> {isCorrection ? "Approve revision" : "Publish new version"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
              onClick={onReject}
            >
              Reject
            </Button>
          </>
        )}
        {(canChangeAuthor || canMerge || (version.status === "published" && !isCurrentActive) || (!version.mergedIntoVersionId && ["rejected", "deleted", "archived"].includes(version.status))) && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <VersionActionButton>Manage <ChevronDown className="size-4" /></VersionActionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canChangeAuthor && <DropdownMenuItem disabled={!online} onSelect={() => setAuthorOpen(true)}><UserRoundPen className="size-4" /> Change author</DropdownMenuItem>}
            {canMerge && <DropdownMenuItem disabled={!online} onSelect={() => setMergeOpen(true)}><GitCompare className="size-4" /> Reclassify as correction…</DropdownMenuItem>}
            {version.status === "published" && !isCurrentActive && <DropdownMenuItem disabled={!online || archiving} onSelect={() => void archive()}><Archive className="size-4" /> Archive version</DropdownMenuItem>}
            {!version.mergedIntoVersionId && ["rejected", "deleted", "archived"].includes(version.status) && <DropdownMenuItem disabled={!online} onSelect={onRestore}><RotateCcw className="size-4" /> Restore version</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>}
        {authorOpen && canChangeAuthor && <VersionAuthor adminApi={adminApi} version={version} online={online} onClose={() => setAuthorOpen(false)} />}
        <Button variant="ghost" size="sm" className="size-8 p-0" disabled={version.status === "deleted"} aria-label="View version" onClick={() => window.open(`/song/${song.id}?version=${version.id}`, "_blank", "noopener,noreferrer")}>
          <ExternalLink className="size-4" />
        </Button>
        {!version.mergedIntoVersionId && ["pending", "published", "archived"].includes(version.status) && <Button variant="ghost" size="sm" className="size-8 p-0" asChild>
          <Link to="/edit/$songId" params={{ songId: song.id }} search={{ version: version.id }}><Edit className="size-4" /><span className="sr-only">Edit version</span></Link>
        </Button>}
        <DeletePrompt size="sm" title="Delete version?" description="This hides the version. Its revision history will be preserved." disabled={!online || isCurrentActive || version.status === "deleted"} onDelete={onDelete} />

        <VersionReclassification source={version} versions={versions} officialId={song.currentVersionId} open={mergeOpen} onOpenChange={setMergeOpen} hideTrigger />

      </div>
    </div>
  );
}

// --- 3. VERSION HISTORY TIMELINE ---

interface VersionHistoryTimelineProps {
  adminApi: AdminApi;
  song: SortableSong;
  songVersions: SongVersionAdminApi[];
  showDeleted: boolean;
  onApproveVersion: (input: VersionMutationInput & ApprovalChoices) => void;
  onRejectVersion: (input: VersionMutationInput) => void;
  onRestoreVersion: (input: VersionMutationInput) => void;
  onDeleteVersion: (input: VersionMutationInput) => void;
  onSetCurrentVersion: (input: VersionMutationInput & { clearOfficial?: boolean }) => void;
  onDiff: (
    version: SongVersionDB,
    target: SongVersionDB,
    label: string,
  ) => void;
  isApprovePending: boolean;
}

function VersionHistoryTimeline({
  adminApi,
  song,
  songVersions,
  showDeleted,
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

  const sortedFilteredVersions = [...songVersions]
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
              adminApi={adminApi}
              versions={songVersions}
              key={version.id}
              song={song}
              version={version}
              parentVersion={parentVersion}
              currentVersion={currentVersion}
              isCurrentActive={isCurrentActive}
              onApprove={(choices) => onApproveVersion({ songId: song.id, versionId: version.id,
                expectedRevision: version.revision, expectedOfficialId: song.currentVersionId, expectedTargetRevision: parentVersion?.revision, ...choices })}
              onReject={() => onRejectVersion({ songId: song.id, versionId: version.id, expectedRevision: version.revision })}
              onRestore={() => onRestoreVersion({ songId: song.id, versionId: version.id, expectedRevision: version.revision })}
              onDelete={() => onDeleteVersion({ songId: song.id, versionId: version.id, expectedRevision: version.revision })}
              onToggleOfficial={() => onSetCurrentVersion({ songId: song.id, versionId: version.id, expectedRevision: version.revision, clearOfficial: isCurrentActive })}
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
  onRestoreSong: (songId: string) => void;
  onDeleteSong: (songId: string) => void;
  onUpdateYoutube: (input: VersionMutationInput & { youtubeId: string }) => void;
  isYoutubeUpdatePending: boolean;
  hiddenColumns: readonly HideableColumn[];
  visibleColumnCount: number;
}

interface YoutubeDialogContentProps {
  song: SortableSong;
  currentVersion: SongVersionDB;
  onUpdateYoutube: SongTableRowProps["onUpdateYoutube"];
  onClose: () => void;
  isUpdatePending: boolean;
}

function YoutubeDialogForm({
  song,
  currentVersion,
  onUpdateYoutube,
  onClose,
  isUpdatePending,
}: YoutubeDialogContentProps) {
  const originalYoutubeId = currentVersion.youtubeId ?? "";
  const [youtubeId, setYoutubeId] = useState(originalYoutubeId);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit YouTube link</DialogTitle>
      </DialogHeader>
      <YoutubeField
        value={youtubeId}
        onChange={setYoutubeId}
        title={currentVersion.title ?? song.title}
        artist={currentVersion.artist ?? song.artist}
        modified={youtubeId !== originalYoutubeId}
      />
      <Button
        onClick={() => {
          const normalizedYoutubeId = youtubeId.trim()
            ? (parseYoutubeId(youtubeId) ?? "")
            : "";
          if (youtubeId.trim() && !normalizedYoutubeId) {
            toast.error("Enter a valid YouTube link or video ID.");
            return;
          }
          onUpdateYoutube({ songId: song.id, versionId: currentVersion.id, expectedRevision: currentVersion.revision, youtubeId: normalizedYoutubeId });
          onClose();
        }}
        disabled={isUpdatePending || youtubeId === originalYoutubeId}
      >
        {isUpdatePending ? "Saving..." : "Save link"}
      </Button>
    </DialogContent>
  );
}

function SongTableRow({
  adminApi,
  song,
  songVersions,
  isExpanded,
  showDeleted,
  onToggleExpand,
  onRestoreSong,
  onDeleteSong,
  onApproveVersion,
  onRejectVersion,
  onRestoreVersion,
  onDeleteVersion,
  onSetCurrentVersion,
  onUpdateYoutube,
  onDiff,
  isApprovePending,
  isYoutubeUpdatePending,
  hiddenColumns,
  visibleColumnCount,
}: SongTableRowProps) {
  const router = useRouter();
  // TODO: Move YouTube metadata to `song` once it no longer needs to vary by version.
  const currentVersion = songVersions.find(
    (version) => version.id === song.currentVersionId,
  );
  const workingVersion = getWorkingVersion(song, songVersions);
  const editLocation = !song.deleted && workingVersion ? {
    to: "/edit/$songId" as const,
    params: { songId: song.id },
    search: { version: workingVersion.id },
  } : null;
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);
  const pendingCount = songVersions.filter(
    (v) => v.status === "pending",
  ).length;
  const isColumnVisible = (column: HideableColumn) =>
    !hiddenColumns.includes(column);

  return (
    <React.Fragment>
      <TableRow
        className={`cursor-pointer hover:bg-accent/50 transition-colors ${
          isExpanded ? "bg-accent/30 border-b-transparent" : ""
        }`}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) {
            if (editLocation && !(event.target instanceof Element && event.target.closest("a, button"))) {
              window.open(router.buildLocation(editLocation).publicHref, "_blank", "noopener,noreferrer");
            }
            return;
          }
          onToggleExpand(song.id);
        }}
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
        {isColumnVisible("artist") && (
          <TableCell
            className={`text-muted-foreground ${song.deleted ? "opacity-50" : ""}`}
          >
            {song.artist}
          </TableCell>
        )}
        {isColumnVisible("status") && (
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
                className="bg-warning/10 text-warning border-warning/30 animate-pulse"
              >
                {pendingCount} Pending
              </Badge>
            )}
          </div>
          </TableCell>
        )}
        {isColumnVisible("submittedBy") && (
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
        )}
        {isColumnVisible("lastModified") && (
          <TableCell className="text-muted-foreground whitespace-nowrap">
          {song.lastModified.toLocaleDateString()}
          </TableCell>
        )}
        {isColumnVisible("maxRowWidth") && (
          <TableCell>
          {workingVersion ? (
            <SongMaxWidth
              versionId={workingVersion.id}
              chordpro={workingVersion.chordpro}
            />
          ) : (
            <span className="text-muted-foreground/40">â€”</span>
          )}
          </TableCell>
        )}
        <TableCell onClick={(e) => e.stopPropagation()} className="pr-4">
          <div className="flex justify-end">
            <ActionButtons>
              {editLocation ? (
                <Button variant="ghost" size="icon" asChild>
                  <Link {...editLocation} aria-label="Edit song">
                    <Edit className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="ghost" size="icon" aria-label="Edit song" disabled>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsYoutubeDialogOpen(true)}
                disabled={song.deleted || !currentVersion}
                title="Edit YouTube link"
              >
                <Youtube className="h-5 w-5" />
                <span className="sr-only">Edit YouTube link</span>
              </Button>
              {song.deleted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-success hover:text-success hover:bg-success/10 dark:hover:bg-success/20"
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
            <Dialog
              open={isYoutubeDialogOpen}
              onOpenChange={setIsYoutubeDialogOpen}
            >
              {isYoutubeDialogOpen && currentVersion && (
                <YoutubeDialogForm
                  key={`${currentVersion.id}:${currentVersion.youtubeId ?? ""}`}
                  song={song}
                  currentVersion={currentVersion}
                  onUpdateYoutube={onUpdateYoutube}
                  onClose={() => setIsYoutubeDialogOpen(false)}
                  isUpdatePending={isYoutubeUpdatePending}
                />
              )}
            </Dialog>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-accent/20">
          <TableCell colSpan={visibleColumnCount} className="p-0">
            <VersionHistoryTimeline
              adminApi={adminApi}
              song={song}
              songVersions={songVersions}
              showDeleted={showDeleted}
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
  /** Rendered inside the bordered card above the search (e.g. the stats bar). */
  header?: React.ReactNode;
  autoGenerateIllustration: boolean;
  onAutoGenerateIllustrationChange: (val: boolean) => void;
  isResetPending: boolean;
  onResetDB: () => void;
  hiddenColumns: readonly HideableColumn[];
  onColumnVisibilityChange: (
    column: HideableColumn,
    visible: boolean,
  ) => void;
}

function SongsTableSettingsBar({
  searchTerm,
  onSearchChange,
  header,
  autoGenerateIllustration,
  onAutoGenerateIllustrationChange,
  isResetPending,
  onResetDB,
  hiddenColumns,
  onColumnVisibilityChange,
}: SongsTableSettingsBarProps) {
  return (
    <ControlPanel
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      header={header}
      searchPosition="bottom"
    >
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-5 gap-y-3 bg-muted/40 px-4 py-2.5 rounded-lg border border-border/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Options
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shadow-sm">
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
                {hiddenColumns.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {HIDEABLE_COLUMNS.length - hiddenColumns.length}/
                    {HIDEABLE_COLUMNS.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              {HIDEABLE_COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={!hiddenColumns.includes(column.id)}
                  onCheckedChange={(visible) =>
                    onColumnVisibilityChange(column.id, visible)
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ToggleCheckbox
            checked={autoGenerateIllustration}
            onCheckedChange={onAutoGenerateIllustrationChange}
            label="Auto-illustrate on approval"
            title="Auto-illustrate on approval when the song has no illustration yet"
            icon={Sparkles}
            iconClassName="text-primary"
          />

          <ConfirmationDialog
            trigger={
              <Button
                variant="destructive-outline"
                size="sm"
                className="shadow-sm w-full sm:w-auto sm:ml-auto"
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
            variant="destructive-outline"
            cancelText="Cancel"
            onConfirm={onResetDB}
            isLoading={isResetPending}
          />
        </div>
      </div>
    </ControlPanel>
  );
}

// --- 6. MAIN COMPONENT (Container) ---

export default function SongsTable({ adminApi }: { adminApi: AdminApi }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Visibility cards are show/hide toggles (single click) that also support
  // "show only" via double click (`isolate`). External is hidden by default
  // since those songs are rarely the focus.
  const [showExternal, setShowExternal] = useLocalStorageState<boolean>(
    "admin/songs-table/show-external",
    { defaultValue: false },
  );
  const [showDeleted, setShowDeleted] = useLocalStorageState<boolean>(
    "admin/songs-table/show-deleted",
    { defaultValue: false },
  );
  const [showUnofficial, setShowUnofficial] = useLocalStorageState<boolean>(
    "admin/songs-table/show-unofficial",
    { defaultValue: true },
  );
  const [hiddenColumns, setHiddenColumns] = useLocalStorageState<
    HideableColumn[]
  >(HIDDEN_COLUMNS_STORAGE_KEY, { defaultValue: [] });
  const [isolate, setIsolate] = useState<AttrIsolate | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  // Distinguishes a single click (toggle) from a double click (show only). The
  // pending single-click action is held so a second click on the SAME card can
  // cancel it and isolate instead.
  const pendingClickRef = useRef<{
    attr: AttrIsolate;
    timer: ReturnType<typeof setTimeout>;
    run: () => void;
  } | null>(null);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());
  const [diffView, setDiffView] = useState<DiffViewState | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "lastModified",
    direction: "descending",
  });

  const validHiddenColumns = HIDEABLE_COLUMNS.map((column) => column.id).filter(
    (column) => hiddenColumns.includes(column),
  );
  const visibleColumnCount = 9 - validHiddenColumns.length;

  const setColumnVisibility = (
    column: HideableColumn,
    visible: boolean,
  ) => {
    setHiddenColumns(
      visible
        ? hiddenColumns.filter((hidden) => hidden !== column)
        : [...validHiddenColumns.filter((hidden) => hidden !== column), column],
    );

    if (!visible && sortConfig.key === column) {
      setSortConfig({ key: "title", direction: "ascending" });
    }
  };

  const [autoGenerateIllustration, setAutoGenerateIllustration] =
    useLocalStorageState(AUTO_ILLUSTRATION_STORAGE_KEY, {
      defaultValue: false,
    });

  // Queries
  const { data: songs, isLoading: songsLoading } = useSongsAdmin(adminApi);
  const { data: versions, isLoading: versionsLoading } =
    useVersionsAdmin(adminApi);

  // Mutations
  const updateVersionMutation = useUpdateVersion(adminApi);
  const deleteSongMutation = useDeleteSong(adminApi);
  const restoreSongMutation = useRestoreSong(adminApi);
  const resetDBMutation = useResetVersionDB(adminApi);
  const approveVersionMutation = useApproveVersion(adminApi);
  const rejectVersionMutation = useRejectVersion(adminApi);
  const deleteVersionMutation = useDeleteVersion(adminApi);
  const restoreVersionMutation = useRestoreVersion(adminApi);
  const [legacyRestore, setLegacyRestore] = useState<VersionMutationInput | null>(null);
  function restoreVersion(input: VersionMutationInput, fallbackStatus?: "published" | "archived" | "pending") {
    restoreVersionMutation.mutate({ ...input, fallbackStatus }, {
      onSuccess: () => { setLegacyRestore(null); toast.success("Version restored"); },
      onError: (error) => {
        if (error instanceof ApiException && error.status === 422) setLegacyRestore(input);
        else { setLegacyRestore(null); toast.error(error.message); }
      },
    });
  }
  const generateIllustrationMutation = useGenerateIllustration(adminApi);

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

  const workingVersionSources = useMemo(() => {
    if (!songs) return [];
    return songs.flatMap((song) => {
      const workingVersion = getWorkingVersion(
        song,
        versionsBySong[song.id] || [],
      );
      return workingVersion
        ? [{ id: workingVersion.id, chordpro: workingVersion.chordpro }]
        : [];
    });
  }, [songs, versionsBySong]);
  const layoutPressures = useSongLayoutPressures(workingVersionSources);

  const enrichedSongs = useMemo<SortableSong[]>(() => {
    if (!songs) return [];

    return songs.map((song) => {
      const songVersions = versionsBySong[song.id] || [];
      const workingVersion = getWorkingVersion(song, songVersions);
      const status = !song.currentVersionId && workingVersion?.status === "published"
        ? "unofficial"
        : workingVersion?.status ?? "empty";
      return {
        ...song,
        title: workingVersion?.title || "N/A",
        artist: workingVersion?.artist || "N/A",
        lastModified: songVersions.reduce(
          (latest, v) =>
            new Date(v.updatedAt) > latest ? new Date(v.updatedAt) : latest,
          new Date(0),
        ),
        status: song.deleted ? "deleted" : status,
        hasPendingVersions: songVersions.some((v) => v.status === "pending"),
        hasYoutube: !!workingVersion?.youtubeId,
        externalSource: workingVersion?.importSourceId
          ? {
              sourceId: workingVersion.importSourceId,
              url: workingVersion.importUrl ?? "#",
            }
          : null,
        submittedBy: workingVersion?.authorName || null,
        maxRowWidth: workingVersion
          ? (layoutPressures.get(workingVersion.id)?.widestRowEm ?? null)
          : null,
      };
    });
  }, [songs, versionsBySong, layoutPressures]);

  const stats = useMemo<SongStats>(() => {
    // Status counts follow the visibility toggles so the cards match the
    // list; the visibility cards themselves show full category totals.
    const inScope = enrichedSongs.filter(
      (s) =>
        !s.deleted &&
        (showExternal || !s.externalSource) &&
        (showUnofficial || s.status !== "unofficial"),
    );
    const byStatus = (status: string) =>
      inScope.filter((s) => s.status === status).length;
    return {
      total: inScope.length,
      pending: inScope.filter((s) => s.hasPendingVersions).length,
      published: byStatus("published"),
      archived: byStatus("archived"),
      rejected: byStatus("rejected"),
      noYoutube: inScope.filter((s) => !s.hasYoutube).length,
      empty: byStatus("empty"),
      external: enrichedSongs.filter((s) => s.externalSource && !s.deleted)
        .length,
      unofficial: enrichedSongs.filter((s) => s.status === "unofficial").length,
      deleted: enrichedSongs.filter((s) => s.deleted).length,
    };
  }, [enrichedSongs, showExternal, showUnofficial]);

  const filteredSortedSongs = useMemo(() => {
    const term = searchTerm.toLowerCase();
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
          : statusFilter === "noYoutube"
            ? !song.hasYoutube
          : song.status === statusFilter;
      if (!matchesStatus) return false;

      // Double-click "show only" overrides the toggles and isolates a category.
      if (isolate) {
        switch (isolate) {
          case "external":
            return !!song.externalSource && !song.deleted;
          case "unofficial":
            return song.status === "unofficial";
          case "deleted":
            return song.deleted;
        }
      }

      // Apply the visibility toggles together.
      if (!showExternal && song.externalSource) return false;
      if (!showUnofficial && song.status === "unofficial") return false;
      if (!showDeleted && song.deleted) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (a.hasPendingVersions && !b.hasPendingVersions) return -1;
      if (!a.hasPendingVersions && b.hasPendingVersions) return 1;
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (aValue < bValue)
        return sortConfig.direction === "ascending" ? -1 : 1;
      if (aValue > bValue)
        return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [
    enrichedSongs,
    searchTerm,
    statusFilter,
    isolate,
    showExternal,
    showUnofficial,
    showDeleted,
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

  const handleApproveVersion = ({ songId, versionId, expectedRevision, ...choices }: VersionMutationInput & ApprovalChoices) => {
    const song = songs.find((s) => s.id === songId);
    const hasNoIllustration = !song?.currentIllustrationId;
    approveVersionMutation.mutate(
      { songId, versionId, expectedRevision, ...choices },
      {
        onSuccess: () => {
          toast.success("Version approved and published");
          if (autoGenerateIllustration && hasNoIllustration) {
            toast.info("Auto-generating illustration...");
            generateIllustrationMutation.mutate(
              { songId, setAsActive: true },
              { onError: (error) => toast.error(error.message) },
            );
          }
        },
        onError: (error) => toast.error(error.message),
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

  const showByAttr: Record<AttrIsolate, boolean> = {
    external: showExternal,
    unofficial: showUnofficial,
    deleted: showDeleted,
  };
  const setShowByAttr: Record<AttrIsolate, (v: boolean) => void> = {
    external: setShowExternal,
    unofficial: setShowUnofficial,
    deleted: setShowDeleted,
  };

  // Single click toggles show/hide; double click isolates ("show only"). A
  // short timer tells the two apart.
  const onAttrClick = (attr: AttrIsolate) => {
    const pending = pendingClickRef.current;
    // Second click on the same card within the window => "show only".
    if (pending && pending.attr === attr) {
      clearTimeout(pending.timer);
      pendingClickRef.current = null;
      setIsolate((cur) => (cur === attr ? null : attr));
      setCurrentPage(0);
      return;
    }
    // A different card was pending: run its toggle now, then queue this one.
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
    pendingClickRef.current = {
      attr,
      run,
      timer: setTimeout(run, 220),
    };
  };

  // Highlight the shown/isolated cards; dim hidden ones. In "show only" mode
  // only the isolated card is active (badged), the rest are dimmed.
  const attrCardState = (attr: AttrIsolate) => {
    if (isolate) {
      return attr === isolate
        ? { active: true, badge: "only" }
        : { dimmed: true };
    }
    return showByAttr[attr] ? { active: true } : { dimmed: true };
  };

  return (
    <div className="space-y-6 max-w-full pb-8">
      <Dialog open={!!legacyRestore} onOpenChange={(open) => { if (!open) setLegacyRestore(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restore deleted version</DialogTitle></DialogHeader>
          <p>The earliest saved revision is already deleted. Choose how this version should return.</p>
          {(["pending", "archived", "published"] as const).map(status => (
            <Button key={status} disabled={restoreVersionMutation.isPending}
              onClick={() => legacyRestore && restoreVersion(legacyRestore, status)}>
              Restore as {status}
            </Button>
          ))}
        </DialogContent>
      </Dialog>
      <SongsTableSettingsBar
        searchTerm={searchTerm}
        onSearchChange={withPageReset(setSearchTerm)}
        header={
          <StatsBar
            groups={[
              {
                label: "Status",
                hint: "choose one",
                items: STATUS_CARDS.map((c) => ({
                  label: c.label,
                  value: stats[c.stat],
                  icon: c.icon,
                  className: c.className,
                  onClick: () => selectStatus(c.value),
                  active: statusFilter === c.value,
                })),
              },
              {
                label: "Visibility",
                hint: "click show/hide · double-click = only",
                items: ATTR_CARDS.map((c) => ({
                  label: c.label,
                  value: stats[c.stat],
                  icon: c.icon,
                  className: c.className,
                  onClick: () => onAttrClick(c.value),
                  ...attrCardState(c.value),
                })),
              },
            ]}
          />
        }
        autoGenerateIllustration={autoGenerateIllustration}
        onAutoGenerateIllustrationChange={setAutoGenerateIllustration}
        hiddenColumns={validHiddenColumns}
        onColumnVisibilityChange={setColumnVisibility}
        isResetPending={resetDBMutation.isPending}
        onResetDB={() => resetDBMutation.mutate()}
      />

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12 text-center"></TableHead>
                {renderHeader("Title", "title")}
                {!validHiddenColumns.includes("artist") &&
                  renderHeader("Artist", "artist")}
                {!validHiddenColumns.includes("status") && (
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                )}
                {!validHiddenColumns.includes("submittedBy") && (
                  <TableHead className="whitespace-nowrap">
                    Author
                  </TableHead>
                )}
                {!validHiddenColumns.includes("lastModified") &&
                  renderHeader("Last Modified", "lastModified")}
                {!validHiddenColumns.includes("maxRowWidth") &&
                  renderHeader("Max width", "maxRowWidth")}
                <TableHead className="whitespace-nowrap text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSongs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnCount}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No songs match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSongs.map((song) => (
                  <SongTableRow
                    adminApi={adminApi}
                    key={song.id}
                    song={song}
                    songVersions={versionsBySong[song.id] || []}
                    isExpanded={expandedSongs.has(song.id)}
                    showDeleted={showDeleted || isolate === "deleted"}
                    onToggleExpand={toggleSongExpansion}
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
                    onRejectVersion={(input) =>
                      rejectVersionMutation.mutate(
                        input,
                        { onSuccess: () => toast.success("Rejected") },
                      )
                    }
                    onRestoreVersion={restoreVersion}
                    onDeleteVersion={(input) =>
                      deleteVersionMutation.mutate(
                        input,
                        {
                          onSuccess: () => toast.success(
                            showDeleted || isolate === "deleted"
                              ? "Version deleted. It stays visible because deleted items are shown."
                              : "Version deleted",
                          ),
                          onError: (error) => toast.error(error.message),
                        },
                      )
                    }
                    onSetCurrentVersion={(input) =>
                      approveVersionMutation.mutate(
                        { ...input, official: true },
                        {
                          onSuccess: () =>
                            toast.success(input.clearOfficial ? "Official selection cleared" : "Set as current version"),
                          onError: (error) => toast.error(error.message),
                        },
                      )
                    }
                    onUpdateYoutube={({ songId, versionId, expectedRevision, youtubeId }) =>
                      updateVersionMutation.mutate(
                        {
                          songId,
                          versionId,
                          version: { youtubeId: youtubeId.trim() || null, expectedRevision },
                        },
                        {
                          onSuccess: () => toast.success("YouTube link updated"),
                          onError: () => toast.error("Failed to update YouTube link"),
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
                    isYoutubeUpdatePending={updateVersionMutation.isPending}
                    hiddenColumns={validHiddenColumns}
                    visibleColumnCount={visibleColumnCount}
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
