import React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DeletePrompt } from "./shared/delete-prompt";
import { ActionButtons } from "./shared/action-buttons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Edit,
  ExternalLink,
  ListRestart,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Star,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { SongDataDB, SongVersionDB } from "src/lib/db/schema";
import { AdminApi } from "~/services/songs";
import {
  useDeleteVersion,
  useResetVersionDB,
  useSetCurrentVersion,
  useSongsAdmin,
  useUpdateSong,
  useUpdateVersion,
  useVersionsAdmin,
} from "../adminHooks";
import { TableToolbar } from "./shared/table-toolbar";

interface SongsTableProps {
  adminApi: AdminApi;
}

export default function SongsTable({ adminApi }: SongsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());
  const navigate = useNavigate({ from: "/admin" });

  const { data: songs, isLoading: songsLoading } = useSongsAdmin(adminApi);
  const { data: versions, isLoading: versionsLoading } =
    useVersionsAdmin(adminApi);

  const updateSongMutation = useUpdateSong(adminApi);
  const updateVersionMutation = useUpdateVersion(adminApi);
  const deleteVersionMutation = useDeleteVersion(adminApi);
  const setCurrentVersionMutation = useSetCurrentVersion(adminApi);
  const resetDBMutation = useResetVersionDB(adminApi);

  const handleMutationSuccess = (message: string) => {
    toast.success(message);
  };

  const handleMutationError = (error: Error, message: string) => {
    console.error(message, error);
    toast.error(message);
  };

  // TanStack Query mutations
  const updateSong = useMutation({
    mutationFn: ({
      songId,
      data,
    }: {
      songId: string;
      data: Partial<SongDataDB>;
    }) => updateSongMutation.mutateAsync({ songId, song: data }),
    onSuccess: () => handleMutationSuccess("Song updated successfully"),
    onError: (error) => handleMutationError(error, "Error updating song"),
  });

  const updateVersion = useMutation({
    mutationFn: ({
      songId,
      versionId,
      data,
    }: {
      songId: string;
      versionId: string;
      data: Partial<SongVersionDB>;
    }) =>
      updateVersionMutation.mutateAsync({
        songId,
        versionId,
        version: data as SongVersionDB,
      }),
    onSuccess: () => handleMutationSuccess("Version updated successfully"),
    onError: (error) => handleMutationError(error, "Error updating version"),
  });

  const deleteVersion = useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => deleteVersionMutation.mutateAsync({ songId, versionId }),
    onSuccess: () => handleMutationSuccess("Version deleted successfully"),
    onError: (error) => handleMutationError(error, "Error deleting version"),
  });

  const setCurrentVersion = useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => setCurrentVersionMutation.mutateAsync({ songId, versionId }),
    onSuccess: () =>
      handleMutationSuccess("Current version updated successfully"),
    onError: (error) =>
      handleMutationError(error, "Error setting current version"),
  });

  const resetDB = useMutation({
    mutationFn: () => resetDBMutation.mutateAsync(),
    onSuccess: () =>
      handleMutationSuccess("Database version reset successfully"),
    onError: (error) =>
      handleMutationError(error, "Error resetting database version"),
  });

  if (songsLoading || versionsLoading) {
    return <div>Loading...</div>;
  }

  if (!songs || !versions) {
    return <div>Error loading data.</div>;
  }

  // Create a map of versions by song ID for easy lookup
  const versionsBySong = versions.reduce(
    (acc: Record<string, SongVersionDB[]>, version: SongVersionDB) => {
      if (!acc[version.songId]) {
        acc[version.songId] = [];
      }
      acc[version.songId].push(version);
      return acc;
    },
    {}
  );

  // Get current version for a song
  const getCurrentVersion = (song: SongDataDB): SongVersionDB | undefined => {
    if (!song.currentVersionId) return undefined;
    return versions.find((v) => v.id === song.currentVersionId);
  };

  const filteredSongs = (songs || []).filter((song) => {
    const currentVersion = getCurrentVersion(song);
    const songVersions = versionsBySong[song.id] || [];

    const matchesSearch = currentVersion
      ? currentVersion.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        currentVersion.artist
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        currentVersion.key?.toLowerCase().includes(searchTerm.toLowerCase())
      : songVersions.some(
          (version) =>
            version.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            version.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
            version.key?.toLowerCase().includes(searchTerm.toLowerCase())
        );

    return matchesSearch && (showDeleted || !song.deleted);
  });

  const handleSongUpdate = (songId: string, data: Partial<SongDataDB>) => {
    updateSong.mutate({ songId, data });
  };

  const handleVersionUpdate = (
    songId: string,
    versionId: string,
    data: Partial<SongVersionDB>
  ) => {
    updateVersion.mutate({ songId, versionId, data });
  };

  const handleVersionDelete = (songId: string, versionId: string) => {
    deleteVersion.mutate({ songId, versionId });
  };

  const handleSetCurrentVersion = (songId: string, versionId: string) => {
    setCurrentVersion.mutate({ songId, versionId });
  };

  const handleVisibilityToggle = (songId: string, hidden: boolean) => {
    handleSongUpdate(songId, { hidden });
  };

  const handleDelete = (songId: string) =>
    handleSongUpdate(songId, { deleted: true });

  const handleRestore = (songId: string) => {
    handleSongUpdate(songId, { deleted: false });
  };

  const handleResetDB = () => {
    resetDB.mutate();
  };

  const toggleSongExpansion = (songId: string) => {
    const newExpanded = new Set(expandedSongs);
    if (newExpanded.has(songId)) {
      newExpanded.delete(songId);
    } else {
      newExpanded.add(songId);
    }
    setExpandedSongs(newExpanded);
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetDB.isPending}>
                <ListRestart className="mr-2 h-4 w-4" />
                {resetDB.isPending ? "Resetting..." : "Reset DB Version"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Reset Database Version
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <strong>Warning:</strong> This will force all clients to
                  redownload the entire song database.
                  <br />
                  <br />
                  This should only be done when the database schema changes or
                  when there are significant structural updates that require a
                  full sync.
                  <br />
                  <br />
                  Are you sure you want to proceed? This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetDB}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset Database Version
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableToolbar>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Modified</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSongs.map((song) => {
              const currentVersion = getCurrentVersion(song);
              const songVersions = versionsBySong[song.id] || [];
              const isExpanded = expandedSongs.has(song.id);

              return (
                <React.Fragment key={song.id}>
                  {/* Main song row */}
                  <TableRow
                    className={`cursor-pointer hover:bg-muted/50 ${
                      song.deleted ? "opacity-50" : ""
                    }`}
                    onClick={() => toggleSongExpansion(song.id)}
                  >
                    <TableCell>
                      {songVersions.length > 0 &&
                        (isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        ))}
                    </TableCell>
                    <TableCell className="font-medium">
                      {currentVersion?.title || "No current version"}
                    </TableCell>
                    <TableCell>{currentVersion?.artist || "-"}</TableCell>
                    <TableCell>
                      {currentVersion?.key && (
                        <Badge variant="outline">{currentVersion.key}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{currentVersion?.language || "-"}</TableCell>
                    <TableCell>{currentVersion?.tempo || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {currentVersion?.approved ? (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : currentVersion ? (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline">No Version</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!song.hidden}
                        onCheckedChange={(checked) =>
                          handleVisibilityToggle(song.id, !checked)
                        }
                        disabled={song.deleted || updateSong.isPending}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      {song.updatedAt ? song.updatedAt.toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionButtons>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigate({ to: `/edit/${song.id}` });
                          }}
                          disabled={song.deleted}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {currentVersion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/chordpro/${currentVersion.id}`,
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {song.deleted ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <RotateCcw className="h-5 w-5 text-green-600" />
                                  Restore Song
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to restore this song?
                                  This will make the song visible to users
                                  again.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRestore(song.id)}
                                  className="bg-green-600 text-white hover:bg-green-700"
                                >
                                  Restore Song
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <DeletePrompt
                            onDelete={() => handleDelete(song.id)}
                            title="Are you sure you want to delete this song?"
                            description="This action will mark the song as deleted and it will no longer be visible to users. This action can be undone by using the restore function."
                            variant="ghost"
                            size="sm"
                          />
                        )}
                      </ActionButtons>
                    </TableCell>
                  </TableRow>

                  {/* Expanded versions row */}
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={10} className="p-0">
                        <div className="bg-muted/20 p-4 border-t">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <span>All Versions ({songVersions.length})</span>
                          </h4>
                          <div className="space-y-2">
                            {songVersions.map((version) => (
                              <div
                                key={version.id}
                                className={`flex items-center justify-between p-3 rounded-lg border bg-background ${
                                  version.id === song.currentVersionId
                                    ? "ring-2 ring-primary"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  {version.id === song.currentVersionId && (
                                    <Star className="h-4 w-4 text-primary" />
                                  )}
                                  <div>
                                    <div className="font-medium">
                                      {version.title} - {version.artist}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {version.key && `Key: ${version.key} • `}
                                      {version.language} • Created{" "}
                                      {version.createdAt
                                        ? new Date(
                                            version.createdAt
                                          ).toLocaleDateString()
                                        : ""}
                                      {version.approved &&
                                        version.approvedAt && (
                                          <span className="text-green-600">
                                            {" • Approved "}
                                            {new Date(
                                              version.approvedAt
                                            ).toLocaleDateString()}
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                </div>

                                <ActionButtons>
                                  {version.approved ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleVersionUpdate(
                                          song.id,
                                          version.id,
                                          { approved: false }
                                        )
                                      }
                                      className="text-amber-600 hover:text-amber-700"
                                      disabled={updateVersion.isPending}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Unapprove
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleVersionUpdate(
                                          song.id,
                                          version.id,
                                          { approved: true }
                                        )
                                      }
                                      className="text-green-600 hover:text-green-700"
                                      disabled={updateVersion.isPending}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                  )}

                                  {version.id !== song.currentVersionId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleSetCurrentVersion(
                                          song.id,
                                          version.id
                                        )
                                      }
                                      disabled={setCurrentVersion.isPending}
                                    >
                                      <Star className="h-4 w-4 mr-1" />
                                      Set Current
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(
                                        `/chordpro/${version.id}`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>

                                  <DeletePrompt
                                    onDelete={() =>
                                      handleVersionDelete(song.id, version.id)
                                    }
                                    title={`Are you sure you want to delete this version of "${version.title}"?`}
                                    description="This action cannot be undone."
                                    variant="ghost"
                                    size="sm"
                                  />
                                </ActionButtons>
                              </div>
                            ))}

                            {songVersions.length === 0 && (
                              <div className="text-center py-4 text-muted-foreground">
                                No versions available for this song
                              </div>
                            )}
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
