import React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
  Search,
  ExternalLink,
  ListRestart,
  AlertTriangle,
  Trash2,
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

interface SongsTableProps {
  songs: SongDataDB[];
  versions: SongVersionDB[];
  // Service functions for API calls
  songService: {
    updateSong: (
      songId: string,
      data: Partial<SongDataDB>
    ) => Promise<SongDataDB>;
    resetDB: () => Promise<void>;
  };
  versionService: {
    updateVersion: (
      songId: string,
      versionId: string,
      data: Partial<SongVersionDB>
    ) => Promise<SongVersionDB>;
    deleteVersion: (
      songId: string,
      versionId: string
    ) => Promise<SongVersionDB>;
    setCurrentVersion: (
      songId: string,
      versionId: string
    ) => Promise<SongVersionDB>;
  };
}

export default function SongsTable({
  songs: initialSongs,
  versions: initialVersions,
  songService,
  versionService,
}: SongsTableProps) {
  const [songs, setSongs] = useState<SongDataDB[]>(initialSongs);
  const [versions, setVersions] = useState<SongVersionDB[]>(initialVersions);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSong, setEditingSong] = useState<SongDataDB | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // TanStack Query mutations
  const updateSongMutation = useMutation({
    mutationFn: ({
      songId,
      data,
    }: {
      songId: string;
      data: Partial<SongDataDB>;
    }) => songService.updateSong(songId, data),
    onSuccess: (updatedSong) => {
      setSongs(
        songs.map((song) => (song.id === updatedSong.id ? updatedSong : song))
      );
      toast.success("Song updated successfully");
      queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
    onError: (error) => {
      console.error("Error updating song:", error);
      toast.error("Error updating song");
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({
      songId,
      versionId,
      data,
    }: {
      songId: string;
      versionId: string;
      data: Partial<SongVersionDB>;
    }) => versionService.updateVersion(songId, versionId, data),
    onSuccess: (updatedVersion) => {
      setVersions(
        versions.map((version) =>
          version.id === updatedVersion.id ? updatedVersion : version
        )
      );
      toast.success("Version updated successfully");
      queryClient.invalidateQueries({ queryKey: ["songVersions"] });
    },
    onError: (error) => {
      console.error("Error updating version:", error);
      toast.error("Error updating version");
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => versionService.deleteVersion(songId, versionId),
    onSuccess: (_, { versionId }) => {
      setVersions(versions.filter((version) => version.id !== versionId));
      toast.success("Version deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["songVersions"] });
    },
    onError: (error) => {
      console.error("Error deleting version:", error);
      toast.error("Error deleting version");
    },
  });

  const setCurrentVersionMutation = useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => versionService.setCurrentVersion(songId, versionId),
    onSuccess: (_, { songId, versionId }) => {
      setSongs(
        songs.map((song) =>
          song.id === songId ? { ...song, currentVersionId: versionId } : song
        )
      );
      toast.success("Current version updated successfully");
      queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
    onError: (error) => {
      console.error("Error setting current version:", error);
      toast.error("Error setting current version");
    },
  });

  const resetDBMutation = useMutation({
    mutationFn: () => songService.resetDB(),
    onSuccess: () => {
      toast.success("Database version reset successfully");
      queryClient.invalidateQueries({ queryKey: ["songs", "songVersions"] });
    },
    onError: (error) => {
      console.error("Error resetting database version:", error);
      toast.error("Error resetting database version");
    },
  });

  // Create a map of versions by song ID for easy lookup
  const versionsBySong = versions.reduce((acc, version) => {
    if (!acc[version.songId]) {
      acc[version.songId] = [];
    }
    acc[version.songId].push(version);
    return acc;
  }, {} as Record<string, SongVersionDB[]>);

  // Get current version for a song
  const getCurrentVersion = (song: SongDataDB): SongVersionDB | undefined => {
    if (!song.currentVersionId) return undefined;
    return versions.find((v) => v.id === song.currentVersionId);
  };

  const filteredSongs = songs.filter((song) => {
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
    updateSongMutation.mutate({ songId, data });
  };

  const handleVersionUpdate = (
    songId: string,
    versionId: string,
    data: Partial<SongVersionDB>
  ) => {
    updateVersionMutation.mutate({ songId, versionId, data });
  };

  const handleVersionDelete = (songId: string, versionId: string) => {
    deleteVersionMutation.mutate({ songId, versionId });
  };

  const handleSetCurrentVersion = (songId: string, versionId: string) => {
    setCurrentVersionMutation.mutate({ songId, versionId });
  };

  const handleVisibilityToggle = (songId: string, hidden: boolean) => {
    handleSongUpdate(songId, { hidden });
  };

  const handleDelete = (songId: string) => {
    handleSongUpdate(songId, { deleted: true });
  };

  const handleRestore = (songId: string) => {
    handleSongUpdate(songId, { deleted: false });
  };

  const handleResetDB = () => {
    resetDBMutation.mutate();
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Songs</h3>
        {
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetDBMutation.isPending}>
                <ListRestart className="mr-2 h-4 w-4" />
                {resetDBMutation.isPending
                  ? "Resetting..."
                  : "Reset DB Version"}
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
        }
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="flex items-center space-x-2">
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
      </div>

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
                        disabled={song.deleted || updateSongMutation.isPending}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      {song.updatedAt?.toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSong(song);
                            setIsDialogOpen(true);
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                                  Delete Song
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this song?
                                  This action will mark the song as deleted and
                                  it will no longer be visible to users. This
                                  action can be undone by using the restore
                                  function.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(song.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Song
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
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
                                      {new Date(
                                        version.createdAt
                                      ).toLocaleDateString()}
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

                                <div className="flex items-center gap-2">
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
                                      disabled={updateVersionMutation.isPending}
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
                                      disabled={updateVersionMutation.isPending}
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
                                      disabled={
                                        setCurrentVersionMutation.isPending
                                      }
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

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                                          Delete Version
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this
                                          version of "{version.title}"? This
                                          action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() =>
                                            handleVersionDelete(
                                              song.id,
                                              version.id
                                            )
                                          }
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete Version
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Song</DialogTitle>
          </DialogHeader>
          {editingSong && (
            <SongForm
              song={editingSong}
              currentVersion={getCurrentVersion(editingSong)}
              onSave={(data) => handleSongUpdate(editingSong.id, data)}
              isLoading={updateSongMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SongForm({
  song,
  currentVersion,
  onSave,
  isLoading,
}: {
  song: SongDataDB;
  currentVersion?: SongVersionDB;
  onSave: (data: Partial<SongDataDB>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    hidden: song.hidden,
    deleted: song.deleted,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {currentVersion && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Current Version Info</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Title:</span> {currentVersion.title}
            </div>
            <div>
              <span className="font-medium">Artist:</span>{" "}
              {currentVersion.artist}
            </div>
            <div>
              <span className="font-medium">Key:</span>{" "}
              {currentVersion.key || "N/A"}
            </div>
            <div>
              <span className="font-medium">Language:</span>{" "}
              {currentVersion.language}
            </div>
            <div>
              <span className="font-medium">Status:</span>{" "}
              <Badge
                variant={currentVersion.approved ? "default" : "secondary"}
              >
                {currentVersion.approved ? "Approved" : "Pending"}
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          id="hidden"
          checked={!formData.hidden}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, hidden: !checked })
          }
        />
        <Label htmlFor="hidden">Song is visible</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="deleted"
          checked={!formData.deleted}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, deleted: !checked })
          }
        />
        <Label htmlFor="deleted">Song is active (not deleted)</Label>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Update Song"}
      </Button>
    </form>
  );
}
