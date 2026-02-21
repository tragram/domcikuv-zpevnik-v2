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
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { SongDataDB, SongVersionDB } from "src/lib/db/schema";
import useLocalStorageState from "use-local-storage-state";
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
} from "../adminHooks";
import { ActionButtons } from "./shared/action-buttons";
import { TableToolbar } from "./shared/table-toolbar";
import { IllustrationGenerateSchema } from "src/worker/helpers/illustration-helpers";

// LocalStorage key for auto-illustration setting
const AUTO_ILLUSTRATION_STORAGE_KEY = "admin-auto-generate-illustration";

type SortableSong = SongDataDB & {
  title: string;
  artist: string;
  lastModified: Date;
  status: string;
  hasPendingVersions: boolean;
};

type SortConfig = {
  key: keyof Omit<SortableSong, "hasPendingVersions">;
  direction: "ascending" | "descending";
};

export default function SongsTable({ adminApi }: { adminApi: AdminApi }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());
  const navigate = useNavigate({ from: "/admin" });
  const backendDropdownOptions = useIllustrationOptions();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    key: "lastModified",
    direction: "descending",
  });

  // Load auto-illustration setting from localStorage (default: true)
  const [autoGenerateIllustration, setAutoGenerateIllustration] =
    useLocalStorageState(AUTO_ILLUSTRATION_STORAGE_KEY, {
      defaultValue: false,
    });

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
        const lastModified = songVersions.reduce(
          (latest, v) =>
            new Date(v.createdAt) > latest ? new Date(v.createdAt) : latest,
          new Date(0),
        );
        const hasPendingVersions = songVersions.some(
          (v) => v.status === "pending",
        );

        return {
          ...song,
          title: workingVersion?.title || "N/A",
          artist: workingVersion?.artist || "N/A",
          lastModified,
          status: song.deleted ? "deleted" : workingVersion?.status || "empty",
          hasPendingVersions,
        };
      })
      .filter((song) => {
        const matchesSearch =
          song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          song.artist.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch && (showDeleted || !song.deleted);
      });

    enrichedSongs.sort((a, b) => {
      if (a.hasPendingVersions && !b.hasPendingVersions) return -1;
      if (!a.hasPendingVersions && b.hasPendingVersions) return 1;

      if (sortConfig !== null) {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
      }
      return 0;
    });

    return enrichedSongs;
  }, [songs, versions, versionsBySong, searchTerm, showDeleted, sortConfig]);

  if (songsLoading || versionsLoading) return <div>Loading...</div>;
  if (!songs || !versions) return <div>Error loading data.</div>;

  const toggleSongExpansion = (id: string) => {
    const next = new Set(expandedSongs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSongs(next);
  };

  const isFirstApproval = (songId: string) => {
    const songVersions = versionsBySong[songId] || [];
    return songVersions.every(
      (v) => v.status === "pending" || v.status === "rejected",
    );
  };

  const handleApproveVersion = (songId: string, versionId: string) => {
    const isFirst = isFirstApproval(songId);

    approveVersionMutation.mutate(
      { songId, versionId },
      {
        onSuccess: () => {
          toast.success("Version approved and published");
          if (autoGenerateIllustration && isFirst) {
            toast.info("Auto-generating illustration...");
            const illustrationData: IllustrationGenerateSchema = {
              songId,
              promptVersion: backendDropdownOptions.promptVersions.default,
              summaryModel: backendDropdownOptions.summaryModels.default,
              imageModel: backendDropdownOptions.imageModels.default,
              setAsActive: true,
            };
            generateIllustrationMutation.mutate(illustrationData);
          }
        },
        onError: () => toast.error("Failed to approve version"),
      },
    );
  };

  const requestSort = (key: keyof Omit<SortableSong, "hasPendingVersions">) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (
    key: keyof Omit<SortableSong, "hasPendingVersions">,
  ) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === "ascending" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const renderHeader = (
    label: string,
    key: keyof Omit<SortableSong, "hasPendingVersions">,
  ) => (
    <TableHead onClick={() => requestSort(key)} className="cursor-pointer">
      <div className="flex items-center">
        {label}
        {getSortIndicator(key)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4 max-w-full">
      <TableToolbar searchTerm={searchTerm} onSearchChange={setSearchTerm}>
        <div className="flex flex-col gap-1">
          <div className="flex flex-row gap-2">
            <Checkbox
              id="show-deleted"
              className="size-3"
              checked={showDeleted}
              onCheckedChange={() => setShowDeleted(!showDeleted)}
            />
            <Label
              htmlFor="show-deleted"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show deleted
            </Label>
          </div>
          <div className="flex flex-row gap-2">
            <Checkbox
              id="auto-illustration"
              className="size-3"
              checked={autoGenerateIllustration}
              onCheckedChange={() =>
                setAutoGenerateIllustration(!autoGenerateIllustration)
              }
            />
            <Label
              htmlFor="auto-illustration"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Generate image on first approval
            </Label>
          </div>
        </div>
        <ConfirmationDialog
          trigger={
            <Button variant="outline" disabled={resetDBMutation.isPending}>
              <ListRestart className="mr-2 h-4 w-4" />
              {resetDBMutation.isPending ? "Resetting..." : "Reset DB Version"}
            </Button>
          }
          title="Reset Database Version"
          description={
            <div className="space-y-2">
              <p>
                <strong>Warning:</strong> This will force all clients to reload
                their song database.
              </p>
              <p>Use this when:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Multiple songs have been updated</li>
                <li>Critical changes need immediate propagation</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Note: Individual song updates automatically notify clients. This
                is only needed for bulk changes.
              </p>
            </div>
          }
          confirmText="Yes, Reset DB Version"
          cancelText="Cancel"
          variant="default"
          onConfirm={() => resetDBMutation.mutate()}
          isLoading={resetDBMutation.isPending}
        />
      </TableToolbar>

      <div className="rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              {renderHeader("Title", "title")}
              {renderHeader("Artist", "artist")}
              <TableHead>Status</TableHead>
              {renderHeader("Last Modified", "lastModified")}
              <TableHead>Visible</TableHead>
              <TableHead>Actions</TableHead>
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
                    className={`cursor-pointer hover:bg-muted/50`}
                    onClick={() => toggleSongExpansion(song.id)}
                  >
                    <TableCell>
                      <div className="flex items-center">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`font-medium  ${song.deleted ? "opacity-60" : ""}`}
                    >
                      {song.title}
                    </TableCell>
                    <TableCell
                      className={`font-medium  ${song.deleted ? "opacity-60" : ""}`}
                    >
                      {song.artist}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <SongVersionStatusBadge status={song.status} />
                        {pendingCount > 0 &&
                          !song.deleted &&
                          song.status !== "pending" && (
                            <SongVersionStatusBadge status="pending" />
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                            size="icon"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() =>
                              restoreSongMutation.mutate(song.id, {
                                onSuccess: () => toast.success("Song restored"),
                                onError: () =>
                                  toast.error("Failed to restore song"),
                              })
                            }
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <DeletePrompt
                            title={`Delete "${song.title || "this song"}"?`}
                            description="Are you sure you want to delete this song?"
                            onDelete={() =>
                              deleteSongMutation.mutate(song.id, {
                                onSuccess: () => toast.success("Song deleted"),
                                onError: () =>
                                  toast.error("Failed to delete song"),
                              })
                            }
                          />
                        )}
                      </ActionButtons>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-0">
                        <div className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Version History
                            <Badge variant="outline" className="ml-2">
                              {versionCount} version
                              {versionCount !== 1 ? "s" : ""}
                            </Badge>
                          </h4>
                          <div className="space-y-2">
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
                              .map((version) => (
                                <div
                                  key={version.id}
                                  className={`flex items-center justify-between p-3 rounded-lg border bg-background transition-colors ${
                                    version.id === song.currentVersionId
                                      ? "border-primary/50 shadow-sm"
                                      : "border-muted"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <Star
                                      className={`h-4 w-4 text-primary fill-primary ${version.id === song.currentVersionId ? "" : "opacity-0"}`}
                                    />
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text">
                                          {version.title}
                                        </span>
                                        <SongVersionStatusBadge
                                          status={version.status}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(
                                          version.createdAt,
                                        ).toLocaleDateString()}
                                        {` • Key: ${version.key}`}
                                        {version.tempo &&
                                          ` • Tempo: ${version.tempo}`}
                                      </span>
                                    </div>
                                  </div>

                                  <ActionButtons>
                                    {/* Approve / Reject Actions for Pending Items */}
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
                                          <CheckCircle2 className="w-4 h-4 mr-1" />{" "}
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
                                                  toast.success(
                                                    "Version marked as rejected",
                                                  ),
                                                onError: () =>
                                                  toast.error(
                                                    "Failed to reject version",
                                                  ),
                                              },
                                            )
                                          }
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}

                                    {/* Re-promote old versions */}
                                    {version.status === "archived" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          approveVersionMutation.mutate(
                                            {
                                              songId: song.id,
                                              versionId: version.id,
                                            },
                                            {
                                              onSuccess: () =>
                                                toast.success(
                                                  "Version restored as current",
                                                ),
                                              onError: () =>
                                                toast.error(
                                                  "Failed to restore version",
                                                ),
                                            },
                                          )
                                        }
                                      >
                                        Restore as Current
                                      </Button>
                                    )}

                                    {/* Restore Rejected/Deleted Versions */}
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
                                              onError: () =>
                                                toast.error(
                                                  "Failed to restore version",
                                                ),
                                            },
                                          )
                                        }
                                      >
                                        <RotateCcw className="h-4 w-4 mr-1" />
                                        Restore
                                      </Button>
                                    )}

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        window.open(
                                          `/song/${song.id}?version=${version.id}`,
                                          "_blank",
                                        )
                                      }
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>

                                    {/* Only allow hard delete if rejected or admin explicit choice */}
                                    <DeletePrompt
                                      title="Permanently Delete?"
                                      description="This will remove the data entirely."
                                      disabled={
                                        version.id === song.currentVersionId ||
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
                                                "Version permanently deleted",
                                              ),
                                            onError: () =>
                                              toast.error(
                                                "Failed to delete version",
                                              ),
                                          },
                                        )
                                      }
                                    />
                                  </ActionButtons>
                                </div>
                              ))}
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
  );
}
