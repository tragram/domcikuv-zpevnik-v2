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
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { SongDataDB, SongVersionDB } from "src/lib/db/schema";
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

export default function SongsTable({ adminApi }: { adminApi: AdminApi }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());
  const navigate = useNavigate({ from: "/admin" });

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
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSongs(next);
  };

  return (
    <div className="space-y-4">
      <TableToolbar searchTerm={searchTerm} onSearchChange={setSearchTerm}>
        <div className="flex items-center space-x-8">
          <div className="flex flex-row gap-2">
            <Checkbox
              id="show-deleted"
              checked={showDeleted}
              onCheckedChange={() => setShowDeleted(!showDeleted)}
            />
            <Label
              htmlFor="show-deleted"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show deleted
            </Label>
          </div>
          <ConfirmationDialog
            trigger={
              <Button variant="outline" disabled={resetDBMutation.isPending}>
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
                  <strong>Warning:</strong> This will force all clients to
                  reload their song database.
                </p>
                <p>Use this when:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Multiple songs have been updated</li>
                  <li>Critical changes need immediate propagation</li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  Note: Individual song updates automatically notify clients.
                  This is only needed for bulk changes.
                </p>
              </div>
            }
            confirmText="Yes, Reset DB Version"
            cancelText="Cancel"
            variant="default"
            onConfirm={() => resetDBMutation.mutate()}
            isLoading={resetDBMutation.isPending}
          />
        </div>
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

              return (
                <React.Fragment key={song.id}>
                  {/* Master Row */}
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
                      {currentVersion?.title}
                    </TableCell>
                    <TableCell
                      className={`font-medium  ${song.deleted ? "opacity-60" : ""}`}
                    >
                      {currentVersion?.artist || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {song.deleted ? (
                          <SongVersionStatusBadge status={"deleted"} />
                        ) : currentVersion ? (
                          <SongVersionStatusBadge
                            status={currentVersion.status}
                          />
                        ) : (
                          <Badge variant="outline">Empty</Badge>
                        )}
                        {pendingCount > 0 && !isExpanded && !song.deleted && (
                          <SongVersionStatusBadge status="pending" />
                        )}
                      </div>
                      {/* Show status of the CURRENT version */}
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
                          size="sm"
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
                          <ConfirmationDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                            title="Delete Song"
                            description="Are you sure you want to delete this song?"
                            confirmText="Delete"
                            cancelText="Cancel"
                            variant="destructive"
                            onConfirm={() =>
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

                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <TableRow className="bg-muted/5 hover:bg-muted/5">
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4 border-b border-t shadow-inner ">
                          <h4 className="font-semibold text-sm mb-3 text-primary">
                            History & Suggestions
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
                                  className={`flex items-center justify-between p-3 rounded-md border ${
                                    version.status === "published"
                                      ? "border-green-200 ring-1 ring-green-100"
                                      : version.status === "rejected" ||
                                          version.status === "deleted"
                                        ? "opacity-75 border-dashed"
                                        : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {/* Icon indicating state */}
                                    {version.status === "published" && (
                                      <Star className="h-4 w-4 text-green-500 fill-green-100" />
                                    )}
                                    {version.status === "pending" && (
                                      <Clock className="h-4 w-4 text-amber-500" />
                                    )}

                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                          {version.title}
                                        </span>
                                        <SongVersionStatusBadge
                                          status={version.status}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        by {version.userId} •{" "}
                                        {new Date(
                                          version.createdAt,
                                        ).toLocaleDateString()}
                                        {version.key &&
                                          ` • Key: ${version.key}`}
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
                                            approveVersionMutation.mutate(
                                              {
                                                songId: song.id,
                                                versionId: version.id,
                                              },
                                              {
                                                onSuccess: () =>
                                                  toast.success(
                                                    "Version approved and published",
                                                  ),
                                                onError: () =>
                                                  toast.error(
                                                    "Failed to approve version",
                                                  ),
                                              },
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
