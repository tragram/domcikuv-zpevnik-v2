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
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Plus,
  Edit,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  ListRestart,
} from "lucide-react";
import { SongDB } from "~/types/types";
import { SongData } from "~/types/songData";
import { useRouteContext } from "@tanstack/react-router";

interface SongsTableProps {
  songDB: SongDB; // Replace 'any' with a more specific type if available
}

export default function SongsTable({ songDB }: SongsTableProps) {
  const [songs, setSongs] = useState<SongData[]>(songDB.songs);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const context = useRouteContext({ from: "/admin" });
  const adminApi = context.api.admin;

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.key?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveSong = async (songData: Partial<SongData>) => {
    setIsLoading(true);
    try {
      if (editingSong) {
        // Update existing song
        const updatedSong = {
          ...songData,
          id: editingSong.id,
          dateModified: new Date(),
        };

        // Post to server
        await adminApi.song.modify.$post({
          json: updatedSong,
        });

        // Update local state
        setSongs(
          songs.map((song) =>
            song.id === editingSong.id ? { ...song, ...updatedSong } : song
          )
        );
      } else {
        // Create new song - you might need to add a create endpoint to the admin API
        const newSong: SongData = {
          id: Date.now().toString(),
          title: songData.title || "",
          artist: songData.artist || "",
          key: songData.key || "",
          dateAdded: new Date(),
          dateModified: new Date(),
          startMelody: songData.startMelody,
          language: songData.language || "English",
          tempo: songData.tempo,
          capo: songData.capo,
          range: songData.range,
          chordproURL: songData.chordproURL || "",
          hidden: false,
        };

        // TODO: Add create endpoint to admin API
        // await adminApi.song.create.$post({ json: newSong });

        setSongs([...songs, newSong]);
      }

      setIsDialogOpen(false);
      setEditingSong(null);
    } catch (error) {
      console.error("Error saving song:", error);
      // You might want to add proper error handling/toast notifications here
    } finally {
      setIsLoading(false);
    }
  };
  const handleVisibilityToggle = async (songId: string, hidden: boolean) => {
    try {
      const updatedSong = {
        id: songId,
        hidden: hidden,
        // dateModified: new Date()
      };
      console.log(updatedSong);
      // Post to server
      await adminApi.song.modify.$post({
        json: updatedSong,
      });
      // Update local state
      setSongs(
        // TODO: should be this but songdata only has a getter on ID now
        // songs.map((s) => (s.id === songId ? SongData.fromJSON({ ...s.extractMetadata(), ...updatedSong }) : s))
        // TODO: add date modified
        songs.map((s) => {
          if (s.id === songId) {
            s.hidden = hidden;
            console.log(s);
          }
          return s;
        })
      );
    } catch (error) {
      console.error("Error toggling song visibility:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Songs</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingSong(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Song
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSong ? "Edit Song" : "Add New Song"}
              </DialogTitle>
            </DialogHeader>
            <SongForm
              song={editingSong}
              onSave={handleSaveSong}
              isLoading={isLoading}
            />
          </DialogContent>
        </Dialog>
      </div>
      <Button onClick={() => adminApi.songs["reset-songDB-version"].$put()}>
        <ListRestart /> Update DB version
        {/*
         TODO: add a warning dialog that this will force all clients to download the whole DB again and should only be done when the schema changes
        TODO: is there a way to do this automatically on migration?
        */}
      </Button>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search songs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
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
              <TableRow key={song.id}>
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
                    />
                  </div>
                </TableCell>
                <TableCell>{song.dateModified?.toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSong(song);
                        setIsDialogOpen(true);
                      }}
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SongForm({
  song,
  onSave,
  isLoading,
}: {
  song: SongData | null;
  onSave: (data: Partial<SongData>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: song?.title || "",
    artist: song?.artist || "",
    key: song?.key || "",
    startMelody: song?.startMelody || "",
    language: song?.language || "English",
    tempo: song?.tempo || "",
    capo: song?.capo || 0,
    range: song?.range || "",
    chordproURL: song?.chordproURL || "",
    hidden: song?.hidden || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

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
            value={formData.key}
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
            value={formData.language}
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
            value={formData.tempo}
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
            value={formData.capo}
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
            value={formData.range}
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
            value={formData.startMelody}
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
          type="url"
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
        {isLoading ? "Saving..." : song ? "Update Song" : "Create Song"}
      </Button>
    </form>
  );
}
