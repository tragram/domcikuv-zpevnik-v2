"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/shadcn-ui/button"
import { Input } from "~/components/shadcn-ui/input"
import { Badge } from "~/components/shadcn-ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn-ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn-ui/dialog"
import { Label } from "~/components/shadcn-ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn-ui/select"
import { Plus, Edit, Search, ExternalLink } from "lucide-react"

interface Song {
  id: string
  title: string
  artist: string
  key: string
  dateAdded: Date
  dateModified: Date
  startMelody?: string
  language: string
  tempo?: string
  capo?: number
  range?: string
  chordproURL: string
}

const mockSongs: Song[] = [
  {
    id: "1",
    title: "Amazing Grace",
    artist: "John Newton",
    key: "G",
    dateAdded: new Date("2024-01-15"),
    dateModified: new Date("2024-01-15"),
    startMelody: "G-B-D",
    language: "English",
    tempo: "Slow",
    capo: 0,
    range: "G3-D5",
    chordproURL: "https://example.com/amazing-grace.cho",
  },
  {
    id: "2",
    title: "How Great Thou Art",
    artist: "Carl Boberg",
    key: "C",
    dateAdded: new Date("2024-01-10"),
    dateModified: new Date("2024-01-12"),
    startMelody: "C-E-G",
    language: "English",
    tempo: "Medium",
    capo: 2,
    range: "C3-G5",
    chordproURL: "https://example.com/how-great-thou-art.cho",
  },
  {
    id: "3",
    title: "Be Thou My Vision",
    artist: "Traditional Irish",
    key: "D",
    dateAdded: new Date("2024-01-08"),
    dateModified: new Date("2024-01-10"),
    language: "English",
    tempo: "Medium",
    range: "D3-A5",
    chordproURL: "https://example.com/be-thou-my-vision.cho",
  },
]

export function SongsTable() {
  const [songs, setSongs] = useState<Song[]>(mockSongs)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.key.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSaveSong = (songData: Partial<Song>) => {
    if (editingSong) {
      setSongs(
        songs.map((song) => (song.id === editingSong.id ? { ...song, ...songData, dateModified: new Date() } : song)),
      )
    } else {
      const newSong: Song = {
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
      }
      setSongs([...songs, newSong])
    }
    setIsDialogOpen(false)
    setEditingSong(null)
  }

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
              <DialogTitle>{editingSong ? "Edit Song" : "Add New Song"}</DialogTitle>
            </DialogHeader>
            <SongForm song={editingSong} onSave={handleSaveSong} />
          </DialogContent>
        </Dialog>
      </div>

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
                  <Badge variant="outline">{song.key}</Badge>
                </TableCell>
                <TableCell>{song.language}</TableCell>
                <TableCell>{song.tempo || "-"}</TableCell>
                <TableCell>{song.capo || "-"}</TableCell>
                <TableCell>{song.dateModified.toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSong(song)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open(song.chordproURL, "_blank")}>
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
  )
}

function SongForm({ song, onSave }: { song: Song | null; onSave: (data: Partial<Song>) => void }) {
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
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist">Artist</Label>
          <Input
            id="artist"
            value={formData.artist}
            onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">Key</Label>
          <Select value={formData.key} onValueChange={(value) => setFormData({ ...formData, key: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select key" />
            </SelectTrigger>
            <SelectContent>
              {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select value={formData.language} onValueChange={(value) => setFormData({ ...formData, language: value })}>
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
          <Select value={formData.tempo} onValueChange={(value) => setFormData({ ...formData, tempo: value })}>
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
            onChange={(e) => setFormData({ ...formData, capo: Number.parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="range">Range</Label>
          <Input
            id="range"
            value={formData.range}
            onChange={(e) => setFormData({ ...formData, range: e.target.value })}
            placeholder="e.g., C3-G5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startMelody">Start Melody</Label>
          <Input
            id="startMelody"
            value={formData.startMelody}
            onChange={(e) => setFormData({ ...formData, startMelody: e.target.value })}
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
          onChange={(e) => setFormData({ ...formData, chordproURL: e.target.value })}
          required
        />
      </div>

      <Button type="submit" className="w-full">
        {song ? "Update Song" : "Create Song"}
      </Button>
    </form>
  )
}
