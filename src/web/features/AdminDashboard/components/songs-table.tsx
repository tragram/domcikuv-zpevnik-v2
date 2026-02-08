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
} from "lucide-react";
import React, { useState } from "react";
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
import { backendDropdownOptions } from "./illustrations-table/illustration-group";

// LocalStorage key for auto-illustration setting
const AUTO_ILLUSTRATION_STORAGE_KEY = "admin-auto-generate-illustration";

export default function SongsTable({ adminApi }: { adminApi: AdminApi }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());
  const navigate = useNavigate({ from: "/admin" });

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

  if (songsLoading || versionsLoading) return <div>Loading...</div>;
  if (!songs || !versions) return <div>Error loading data.</div>;

  // Organizing data
  const versionsBySong = versions.reduce(
    (acc, version) => {
      if (!acc[version.songId]) acc[version.songId] = [];
      acc[version.songId].push(version);
      return acc;
    },
    {} as Record<string, SongVersionDB[]>,
  );

  const getCurrentVersion = (song: SongDataDB) =>
    versions.find((v) => v.id === song.currentVersionId);

  // Filter Logic
  const filteredSongs = songs.filter((song) => {
    const current = getCurrentVersion(song);
    const vList = versionsBySong[song.id] || [];

    // Search in current or any version
    const matchesSearch = [current, ...vList].some(
      (v) =>
        v?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v?.artist.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return matchesSearch && (showDeleted || !song.deleted);
  });

  const toggleSongExpansion = (id: string) => {
    const next = new Set(expandedSongs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSongs(next);
  };

  // Helper to check if this is the first approval for a song
  const isFirstApproval = (songId: string) => {
    const songVersions = versionsBySong[songId] || [];
    // Check if there are no approved or current versions yet
    return songVersions.every(
      (v) => v.status === "pending" || v.status === "rejected",
    );
  };

  // Enhanced approve handler with auto-illustration generation
  const handleApproveVersion = (songId: string, versionId: string) => {
    const isFirst = isFirstApproval(songId);

    approveVersionMutation.mutate(
      { songId, versionId },
      {
        onSuccess: () => {
          toast.success("Version approved and published");

          // Auto-generate illustration if enabled and this is the first approval
          if (autoGenerateIllustration && isFirst) {
            toast.info("Auto-generating illustration...");

            // Use the same defaults as in illustration-group.tsx
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
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSongs.map((song) => {
              const currentVersion = getCurrentVersion(song);
              const songVersions = versionsBySong[song.id] || [];
              const isExpanded = expandedSongs.has(song.id);

              // Count pending suggestions to show a notification dot?
              const pendingCount = songVersions.filter(
                (v) => v.status === "pending",
              ).length;

              const workingVersion =
                currentVersion ??
                songVersions.find((v) => ["published"].includes(v.status)) ??
                songVersions.find((v) => ["archived"].includes(v.status)) ??
                songVersions.find((v) => ["pending"].includes(v.status)) ??
                songVersions.find((v) => ["rejected"].includes(v.status));
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
                      {workingVersion?.title}
                    </TableCell>
                    <TableCell
                      className={`font-medium  ${song.deleted ? "opacity-60" : ""}`}
                    >
                      {workingVersion?.artist}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {song.deleted ? (
                          <SongVersionStatusBadge status={"deleted"} />
                        ) : workingVersion ? (
                          <SongVersionStatusBadge
                            status={workingVersion.status}
                          />
                        ) : (
                          <Badge variant="outline">Empty</Badge>
                        )}
                        {pendingCount > 0 &&
                          !song.deleted &&
                          workingVersion?.status !== "pending" && (
                            <SongVersionStatusBadge status="pending" />
                          )}
                      </div>
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
                            title={`Delete "${currentVersion?.title || "this song"}"?`}
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
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
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
                              // Sort: Pending first, then by Date desc
                              .sort((a, b) => {
                                if (
                                  a.status === "pending" &&
                                  b.status !== "pending"
                                )
                                  return -1;
                                if (
                                  b.status === "pending" &&
                                  a.status !== "pending"
                                )
                                  return 1;
                                return (
                                  new Date(b.createdAt).getTime() -
                                  new Date(a.createdAt).getTime()
                                );
                              })
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
