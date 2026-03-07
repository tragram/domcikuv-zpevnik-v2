import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  ExternalLink,
  ListRestart,
  RotateCcw,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Sparkles,
  GitCompare,
} from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { SongDataDB, SongVersionDB } from "src/lib/db/schema";
import useLocalStorageState from "use-local-storage-state";
import ReactDiffViewer from "react-diff-viewer-continued";
import { useTheme } from "next-themes";
import SongVersionStatusBadge from "~/components/SongVersionStatusBadge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
import { AdminApi } from "~/services/song-service";
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
  useVersionsAdmin,
} from "../../../services/admin-hooks";
import { ActionButtons } from "./shared/action-buttons";
import { TableToolbar } from "./shared/table-toolbar";
import { formatChordpro } from "~/lib/formatChordpro";

const AUTO_ILLUSTRATION_STORAGE_KEY = "admin-auto-generate-illustration";

type SortableSong = SongDataDB & {
  title: string;
  artist: string;
  lastModified: Date;
  status: string;
  hasPendingVersions: boolean;
};

type SortConfig = {
  key: keyof Omit<
    SortableSong,
    "hasPendingVersions" | "currentVersionId" | "currentIllustrationId"
  >;
  direction: "ascending" | "descending";
};

type DiffViewState = {
  isOpen: boolean;
  songTitle: string;
  version: SongVersionDB;
  target: SongVersionDB;
  targetLabel: string;
};

export default function SongsTable({ adminApi }: { adminApi: AdminApi }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());

  // Singleton state for the diff viewer to improve performance and sizing
  const [diffView, setDiffView] = useState<DiffViewState | null>(null);

  // Theme detection for the Diff Viewer
  const { theme, systemTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode =
      theme === "dark" ||
      (theme === "system" && systemTheme === "dark") ||
      document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, [theme, systemTheme]);

  const navigate = useNavigate({ from: "/admin" });
  const backendDropdownOptions = useIllustrationOptions();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "lastModified",
    direction: "descending",
  });

  const [autoGenerateIllustration, setAutoGenerateIllustration] =
    useLocalStorageState(AUTO_ILLUSTRATION_STORAGE_KEY, {
      defaultValue: false,
    });

  // Add this new state for the diff viewer
  const [isSplitView, setIsSplitView] = useLocalStorageState(
    "admin-diff-split-view",
    {
      defaultValue: true,
    },
  );

  const { data: songs, isLoading: songsLoading } = useSongsAdmin(adminApi);
  const { data: versions, isLoading: versionsLoading } =
    useVersionsAdmin(adminApi);

  const updateSongMutation = useUpdateSong(adminApi);
  const deleteSongMutation = useDeleteSong(adminApi);
  const restoreSongMutation = useRestoreSong(adminApi);
  const resetDBMutation = useResetVersionDB(adminApi);
  const approveVersionMutation = useApproveVersion(adminApi);
  const rejectVersionMutation = useRejectVersion(adminApi);
  const deleteVersionMutation = useDeleteVersion(adminApi);
  const restoreVersionMutation = useRestoreVersion(adminApi);
  const generateIllustrationMutation = useGenerateIllustration(adminApi);

  const versionsBySong = useMemo(() => {
    if (!versions) return {};
    return versions.reduce(
      (acc, version) => {
        if (!acc[version.songId]) acc[version.songId] = [];
        acc[version.songId].push(version);
        return acc;
      },
      {} as Record<string, SongVersionDB[]>,
    );
  }, [versions]);

  const sortedSongs = useMemo(() => {
    if (!songs) return [];

    const getWorkingVersion = (
      song: SongDataDB,
      songVersions: SongVersionDB[],
    ) =>
      versions?.find((v) => v.id === song.currentVersionId) ??
      songVersions.find((v) => ["published"].includes(v.status)) ??
      songVersions.find((v) => ["archived"].includes(v.status)) ??
      songVersions.find((v) => ["pending"].includes(v.status)) ??
      songVersions.find((v) => ["rejected"].includes(v.status));

    const enrichedSongs: SortableSong[] = songs
      .map((song) => {
        const songVersions = versionsBySong[song.id] || [];
        const workingVersion = getWorkingVersion(song, songVersions);
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
        };
      })
      .filter(
        (song) =>
          (song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            song.artist.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (showDeleted || !song.deleted),
      );

    enrichedSongs.sort((a, b) => {
      if (a.hasPendingVersions && !b.hasPendingVersions) return -1;
      if (!a.hasPendingVersions && b.hasPendingVersions) return 1;
      if (a[sortConfig.key] < b[sortConfig.key])
        return sortConfig.direction === "ascending" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key])
        return sortConfig.direction === "ascending" ? 1 : -1;

      return 0;
    });
    return enrichedSongs;
  }, [songs, versions, versionsBySong, searchTerm, showDeleted, sortConfig]);

  if (songsLoading || versionsLoading) return <div>Loading...</div>;
  if (!songs || !versions) return <div>Error loading data.</div>;

  const toggleSongExpansion = (id: string) => {
    const next = new Set(expandedSongs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSongs(next);
  };

  const isFirstApproval = (songId: string) =>
    (versionsBySong[songId] || []).every(
      (v) => v.status === "pending" || v.status === "rejected",
    );

  const handleApproveVersion = (songId: string, versionId: string) => {
    const isFirst = isFirstApproval(songId);
    approveVersionMutation.mutate(
      { songId, versionId },
      {
        onSuccess: () => {
          toast.success("Version approved and published");
          if (autoGenerateIllustration && isFirst) {
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

  return (
    <div className="space-y-6 max-w-full pb-8">
      {/* Control Panel Header */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden flex flex-col border-3 border-primary">
        <div className="p-4 border-b bg-muted/10">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>

        <div className="p-4 bg-muted/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
              <Settings2 className="w-3 h-3 mr-2" /> Quick Settings
            </span>
            <Label className="flex items-center space-x-2 cursor-pointer bg-background px-3 py-1.5 rounded-md border shadow-sm">
              <Checkbox
                checked={showDeleted}
                onCheckedChange={() => setShowDeleted(!showDeleted)}
              />
              <span className="text-sm font-medium">Show deleted</span>
            </Label>
            <Label className="flex items-center space-x-2 cursor-pointer bg-background px-3 py-1.5 rounded-md border shadow-sm">
              <Checkbox
                checked={autoGenerateIllustration}
                onCheckedChange={() =>
                  setAutoGenerateIllustration(!autoGenerateIllustration)
                }
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm font-medium">
                Auto-illustrate on first approval
              </span>
            </Label>
          </div>

          <ConfirmationDialog
            trigger={
              <Button
                variant="destructive"
                size="sm"
                className="shadow-sm"
                disabled={resetDBMutation.isPending}
              >
                <ListRestart className="mr-2 h-4 w-4" />
                {resetDBMutation.isPending
                  ? "Resetting..."
                  : "Reset DB Version"}
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
            onConfirm={() => resetDBMutation.mutate()}
            isLoading={resetDBMutation.isPending}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12 text-center"></TableHead>
                {renderHeader("Title", "title")}
                {renderHeader("Artist", "artist")}
                <TableHead className="whitespace-nowrap">Status</TableHead>
                {renderHeader("Last Modified", "lastModified")}
                <TableHead className="whitespace-nowrap">Visible</TableHead>
                <TableHead className="whitespace-nowrap text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSongs.map((song) => {
                const songVersions = versionsBySong[song.id] || [];
                const isExpanded = expandedSongs.has(song.id);
                const pendingCount = songVersions.filter(
                  (v) => v.status === "pending",
                ).length;
                const versionCount = (
                  showDeleted
                    ? songVersions
                    : songVersions.filter((v) => v.status !== "deleted")
                ).length;

                return (
                  <React.Fragment key={song.id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-accent/50 transition-colors ${isExpanded ? "bg-accent/30 border-b-transparent" : ""}`}
                      onClick={() => toggleSongExpansion(song.id)}
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
                          {pendingCount > 0 &&
                            !song.deleted &&
                            song.status !== "pending" && (
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
                        {song.lastModified.toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!song.hidden}
                          disabled={song.deleted}
                          onCheckedChange={(checked) =>
                            updateSongMutation.mutate({
                              songId: song.id,
                              song: { hidden: !checked },
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="pr-4"
                      >
                        <div className="flex justify-end">
                          <ActionButtons>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                navigate({ to: `/edit/${song.id}` })
                              }
                              disabled={song.deleted}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {song.deleted ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() =>
                                  restoreSongMutation.mutate(song.id, {
                                    onSuccess: () =>
                                      toast.success("Song restored"),
                                  })
                                }
                              >
                                <RotateCcw className="h-4 w-4 mr-1" /> Restore
                              </Button>
                            ) : (
                              <DeletePrompt
                                title={`Delete "${song.title}"?`}
                                description="Are you sure?"
                                onDelete={() =>
                                  deleteSongMutation.mutate(song.id, {
                                    onSuccess: () =>
                                      toast.success("Song deleted"),
                                  })
                                }
                              />
                            )}
                          </ActionButtons>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Version History Area */}
                    {isExpanded && (
                      <TableRow className="bg-accent/20">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-6 pl-14 border-l-4 border-primary/60 my-2 mx-4 bg-background rounded-r-xl shadow-inner overflow-x-auto">
                            <h4 className="font-semibold mb-4 flex items-center gap-2 text-primary/80">
                              <Clock className="h-4 w-4" />
                              Version Timeline
                              <Badge
                                variant="secondary"
                                className="ml-2 font-mono"
                              >
                                {versionCount}
                              </Badge>
                            </h4>
                            <div className="space-y-3 min-w-[600px]">
                              {songVersions
                                .sort(
                                  (a, b) =>
                                    new Date(b.createdAt).getTime() -
                                    new Date(a.createdAt).getTime(),
                                )
                                .filter(
                                  (version) =>
                                    version.status !== "deleted" || showDeleted,
                                )
                                .map((version) => {
                                  const parentVersion = version.parentId
                                    ? songVersions.find(
                                        (v) => v.id === version.parentId,
                                      )
                                    : null;

                                  const currentVersion = song.currentVersionId
                                    ? songVersions.find(
                                        (v) => v.id === song.currentVersionId,
                                      )
                                    : null;

                                  const isCurrentActive =
                                    version.id === song.currentVersionId;

                                  return (
                                    <div
                                      key={version.id}
                                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isCurrentActive ? "border-primary shadow-md bg-primary/5" : "border-border hover:border-border/80 bg-card hover:bg-accent/40"}`}
                                    >
                                      <div className="flex items-center gap-4 flex-1">
                                        <button
                                          onClick={() => {
                                            if (!isCurrentActive) {
                                              approveVersionMutation.mutate(
                                                {
                                                  songId: song.id,
                                                  versionId: version.id,
                                                },
                                                {
                                                  onSuccess: () =>
                                                    toast.success(
                                                      "Set as current version",
                                                    ),
                                                },
                                              );
                                            }
                                          }}
                                          disabled={
                                            isCurrentActive ||
                                            approveVersionMutation.isPending
                                          }
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
                                            <SongVersionStatusBadge
                                              status={version.status}
                                            />
                                          </div>
                                          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                                            <span>
                                              {new Date(
                                                version.createdAt,
                                              ).toLocaleDateString()}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-border"></span>
                                            <span className="bg-muted px-1.5 py-0.5 rounded">
                                              Key: {version.key}
                                            </span>
                                            {version.tempo && (
                                              <span className="bg-muted px-1.5 py-0.5 rounded">
                                                BPM: {version.tempo}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 bg-background p-1 px-2 rounded-lg border shadow-sm">
                                        {/* Version Actions */}

                                        {parentVersion && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              setDiffView({
                                                isOpen: true,
                                                songTitle: song.title,
                                                version: version,
                                                target: parentVersion,
                                                targetLabel: "Parent Version",
                                              })
                                            }
                                          >
                                            <GitCompare className="w-4 h-4 mr-1" />
                                            Diff Parent
                                          </Button>
                                        )}

                                        {currentVersion &&
                                          currentVersion.id !== version.id && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                setDiffView({
                                                  isOpen: true,
                                                  songTitle: song.title,
                                                  version: version,
                                                  target: currentVersion,
                                                  targetLabel:
                                                    "Current Active Version",
                                                })
                                              }
                                            >
                                              <GitCompare className="w-4 h-4 mr-1" />
                                              Diff Current
                                            </Button>
                                          )}

                                        <div className="w-px h-6 bg-border mx-2"></div>

                                        {version.status === "pending" && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200"
                                              onClick={() =>
                                                handleApproveVersion(
                                                  song.id,
                                                  version.id,
                                                )
                                              }
                                            >
                                              <CheckCircle2 className="w-4 h-4 mr-1.5" />{" "}
                                              Approve
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-700 hover:text-red-800 hover:bg-red-50"
                                              onClick={() =>
                                                rejectVersionMutation.mutate(
                                                  {
                                                    songId: song.id,
                                                    versionId: version.id,
                                                  },
                                                  {
                                                    onSuccess: () =>
                                                      toast.success("Rejected"),
                                                  },
                                                )
                                              }
                                            >
                                              Reject
                                            </Button>
                                          </>
                                        )}
                                        {(version.status === "rejected" ||
                                          version.status === "deleted") && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                              restoreVersionMutation.mutate(
                                                {
                                                  songId: song.id,
                                                  versionId: version.id,
                                                },
                                                {
                                                  onSuccess: () =>
                                                    toast.success(
                                                      "Version restored",
                                                    ),
                                                },
                                              )
                                            }
                                          >
                                            <RotateCcw className="h-4 w-4 mr-1.5" />{" "}
                                            Restore
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-muted-foreground hover:text-primary"
                                          onClick={() =>
                                            window.open(
                                              `/song/${song.id}?version=${version.id}`,
                                              "_blank",
                                            )
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
                                            version.id ===
                                              song.currentVersionId ||
                                            version.status === "deleted"
                                          }
                                          onDelete={() =>
                                            deleteVersionMutation.mutate(
                                              {
                                                songId: song.id,
                                                versionId: version.id,
                                              },
                                              {
                                                onSuccess: () =>
                                                  toast.success(
                                                    "Permanently deleted",
                                                  ),
                                              },
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={diffView?.isOpen ?? false}
        onOpenChange={(open) => !open && setDiffView(null)}
      >
        <DialogContent className="!max-w-[95vw] sm:!max-w-[95vw] !w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden p-0 sm:p-0 bg-card border-border shadow-lg">
          {/* 1. Updated DialogHeader to align items in a row */}
          <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-muted-foreground" />
              Comparing "{diffView?.songTitle}"
            </DialogTitle>

            {/* 2. Added Split View Toggle */}
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
                  splitView={isSplitView} // 3. Bound this to the state
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
                    diffContainer: {
                      width: "100%",
                    },
                    content: {
                      width: "100%",
                    },
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
