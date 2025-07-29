import type React from "react";

import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Edit,
  Search,
  ExternalLink,
  ListRestart,
  AlertTriangle,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useRouteContext } from "@tanstack/react-router";
import { deleteSongAdmin, putSongAdmin } from "~/services/songs";
import { SongDataDB } from "src/lib/db/schema";
import { toast } from "sonner";

interface SongsTableProps {
  songData: SongDataDB[];
}

export default function SongsTable({ songData }: SongsTableProps) {
  const [songs, setSongs] = useState<SongDataDB[]>(songData);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSong, setEditingSong] = useState<SongDataDB | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingDB, setIsResettingDB] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const context = useRouteContext({ from: "/admin" });
  const adminApi = context.api.admin;

  const filteredSongs = songs.filter(
    (song) =>
      (song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.key
          ?.toString()
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) &&
      (showDeleted || !song.deleted)
  );

  const handleSaveSong = async (songData: Partial<SongDataDB>) => {
    if (!editingSong) return;

    setIsLoading(true);
    try {
      // Post to server
      const modifiedSong = await putSongAdmin(
        adminApi,
        editingSong.id,
        songData
      );

      // Update local state
      setSongs(
        songs.map((song) => (song.id === editingSong.id ? modifiedSong : song))
      );

      setIsDialogOpen(false);
      setEditingSong(null);
      toast.success("Song updated successfully");
    } catch (error) {
      console.error("Error saving song:", error);
      toast.error("Error saving song");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisibilityToggle = async (songId: string, hidden: boolean) => {
    try {
      const updatedSong = {
        hidden: hidden,
      };
      const modifiedSong = await putSongAdmin(adminApi, songId, updatedSong);

      // Update local state
      setSongs(songs.map((song) => (song.id === songId ? modifiedSong : song)));
      toast.success(`Song ${hidden ? "hidden" : "shown"} successfully`);
    } catch (error) {
      console.error("Error toggling song visibility:", error);
      toast.error("Error toggling song visibility");
    }
  };

  const handleDelete = async (songId: string) => {
    try {
      const updatedSong = {
        deleted: true,
      };
      const modifiedSong = await putSongAdmin(adminApi, songId, updatedSong);

      // Update local state
      setSongs(songs.map((song) => (song.id === songId ? modifiedSong : song)));

      toast.success("Song deleted successfully");
    } catch (error) {
      console.error("Error deleting song:", error);
      toast.error("Error deleting song");
    }
  };

  const handleRestore = async (songId: string) => {
    try {
      const updatedSong = {
        deleted: false,
      };
      const modifiedSong = await putSongAdmin(adminApi, songId, updatedSong);

      // Update local state
      setSongs(songs.map((song) => (song.id === songId ? modifiedSong : song)));

      toast.success("Song restored successfully");
    } catch (error) {
      console.error("Error restoring song:", error);
      toast.error("Error restoring song");
    }
  };

  const handleResetDB = async () => {
    setIsResettingDB(true);
    try {
      await adminApi.songs["reset-songDB-version"].$post();
      toast.success("Database version reset successfully");
    } catch (error) {
      console.error("Error resetting database version:", error);
      toast.error("Error resetting database version");
    } finally {
      setIsResettingDB(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Songs</h3>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isResettingDB}>
              <ListRestart className="mr-2 h-4 w-4" />
              {isResettingDB ? "Resetting..." : "Reset DB Version"}
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
                <br /><br />
                This should only be done when the database schema changes or
                when there are significant structural updates that require a
                full sync. 
                <br /><br />
                Are you sure you want to proceed? This action cannot
                be undone.
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
            {"Show deleted"}
          </Label>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Capo</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Modified</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSongs.map((song) => (
              <TableRow
                key={song.id}
                className={song.deleted ? "opacity-50" : ""}
              >
                <TableCell className="font-medium">{song.title}</TableCell>
                <TableCell>{song.artist}</TableCell>
                <TableCell>
                  <Badge variant="outline">{song.key?.toString()}</Badge>
                </TableCell>
                <TableCell>{song.language}</TableCell>
                <TableCell>{song.tempo || "-"}</TableCell>
                <TableCell>{song.capo || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={!song.hidden}
                      onCheckedChange={(e) => {
                        handleVisibilityToggle(song.id, !e);
                      }}
                      disabled={song.deleted}
                    />
                  </div>
                </TableCell>
                <TableCell>{song.updatedAt?.toLocaleDateString()}</TableCell>
                <TableCell>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(song.chordproURL, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
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
                              Are you sure you want to restore{" "}
                              <strong>"{song.title}"</strong> by{" "}
                              <strong>{song.artist}</strong>?
                              <br />
                              <br />
                              This will make the song visible to users again.
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
                              Are you sure you want to delete{" "}
                              <strong>"{song.title}"</strong> by{" "}
                              <strong>{song.artist}</strong>?
                              <br />
                              <br />
                              This action will mark the song as deleted and it
                              will no longer be visible to users. This action
                              can be undone by using the restore function.
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
            ))}
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
              onSave={handleSaveSong}
              isLoading={isLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SongForm({
  song,
  onSave,
  isLoading,
}: {
  song: SongDataDB;
  onSave: (data: Partial<SongDataDB>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState(song);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // TODO: this should just be an imported component from Editor
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist">Artist</Label>
          <Input
            id="artist"
            value={formData.artist}
            onChange={(e) =>
              setFormData({ ...formData, artist: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">Key</Label>
          <Select
            value={formData.key || ""}
            onValueChange={(value) => setFormData({ ...formData, key: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select key" />
            </SelectTrigger>
            <SelectContent>
              {[
                "C",
                "C#",
                "D",
                "D#",
                "E",
                "F",
                "F#",
                "G",
                "G#",
                "A",
                "B",
                "H",
              ].map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={formData.language || ""}
            onValueChange={(value) =>
              setFormData({ ...formData, language: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Spanish">Spanish</SelectItem>
              <SelectItem value="French">French</SelectItem>
              <SelectItem value="German">German</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tempo">Tempo</Label>
          <Select
            value={formData.tempo || ""}
            onValueChange={(value) =>
              setFormData({ ...formData, tempo: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tempo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Slow">Slow</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Fast">Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="capo">Capo</Label>
          <Input
            id="capo"
            type="number"
            min="0"
            max="12"
            value={formData.capo || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                capo: Number.parseInt(e.target.value) || 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="range">Range</Label>
          <Input
            id="range"
            value={formData.range || ""}
            onChange={(e) =>
              setFormData({ ...formData, range: e.target.value })
            }
            placeholder="e.g., C3-G5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startMelody">Start Melody</Label>
          <Input
            id="startMelody"
            value={formData.startMelody || ""}
            onChange={(e) =>
              setFormData({ ...formData, startMelody: e.target.value })
            }
            placeholder="e.g., C-E-G"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chordproURL">ChordPro URL</Label>
        <Input
          id="chordproURL"
          value={formData.chordproURL}
          onChange={(e) =>
            setFormData({ ...formData, chordproURL: e.target.value })
          }
          required
        />
      </div>

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

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Update Song"}
      </Button>
    </form>
  );
}
