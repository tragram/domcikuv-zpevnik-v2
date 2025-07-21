import type React from "react"

import { useState } from "react"
import { Button } from "~/components/shadcn-ui/button"
import { Input } from "~/components/shadcn-ui/input"
import { Badge } from "~/components/shadcn-ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn-ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn-ui/dialog"
import { Label } from "~/components/shadcn-ui/label"
import { Switch } from "~/components/shadcn-ui/switch"
import { Plus, Edit, Search, ExternalLink, Eye } from "lucide-react"

interface SongIllustration {
  id: string
  songId: string
  songTitle: string
  promptId: string
  promptModel: string
  imageModel: string
  imageURL: string
  thumbnailURL: string
  isActive: boolean
  createdAt: Date
}

const mockIllustrations: SongIllustration[] = [
  {
    id: "1",
    songId: "1",
    songTitle: "Amazing Grace",
    promptId: "prompt-1",
    promptModel: "gpt-4",
    imageModel: "dall-e-3",
    imageURL: "/placeholder.svg?height=400&width=400",
    thumbnailURL: "/placeholder.svg?height=150&width=150",
    isActive: true,
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "2",
    songId: "2",
    songTitle: "How Great Thou Art",
    promptId: "prompt-2",
    promptModel: "gpt-4",
    imageModel: "dall-e-3",
    imageURL: "/placeholder.svg?height=400&width=400",
    thumbnailURL: "/placeholder.svg?height=150&width=150",
    isActive: true,
    createdAt: new Date("2024-01-10"),
  },
  {
    id: "3",
    songId: "1",
    songTitle: "Amazing Grace",
    promptId: "prompt-3",
    promptModel: "gpt-3.5",
    imageModel: "dall-e-2",
    imageURL: "/placeholder.svg?height=400&width=400",
    thumbnailURL: "/placeholder.svg?height=150&width=150",
    isActive: false,
    createdAt: new Date("2024-01-12"),
  },
]

export function IllustrationsTable() {
  const [illustrations, setIllustrations] = useState<SongIllustration[]>(mockIllustrations)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingIllustration, setEditingIllustration] = useState<SongIllustration | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const filteredIllustrations = illustrations.filter(
    (illustration) =>
      illustration.songTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      illustration.promptModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      illustration.imageModel.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSaveIllustration = (illustrationData: Partial<SongIllustration>) => {
    if (editingIllustration) {
      setIllustrations(
        illustrations.map((illustration) =>
          illustration.id === editingIllustration.id ? { ...illustration, ...illustrationData } : illustration,
        ),
      )
    } else {
      const newIllustration: SongIllustration = {
        id: Date.now().toString(),
        songId: illustrationData.songId || "",
        songTitle: illustrationData.songTitle || "",
        promptId: illustrationData.promptId || "",
        promptModel: illustrationData.promptModel || "",
        imageModel: illustrationData.imageModel || "",
        imageURL: illustrationData.imageURL || "",
        thumbnailURL: illustrationData.thumbnailURL || "",
        isActive: illustrationData.isActive || false,
        createdAt: new Date(),
      }
      setIllustrations([...illustrations, newIllustration])
    }
    setIsDialogOpen(false)
    setEditingIllustration(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Song Illustrations</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingIllustration(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Illustration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingIllustration ? "Edit Illustration" : "Add New Illustration"}</DialogTitle>
            </DialogHeader>
            <IllustrationForm illustration={editingIllustration} onSave={handleSaveIllustration} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search illustrations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Song</TableHead>
              <TableHead>Thumbnail</TableHead>
              <TableHead>Prompt Model</TableHead>
              <TableHead>Image Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIllustrations.map((illustration) => (
              <TableRow key={illustration.id}>
                <TableCell className="font-medium">{illustration.songTitle}</TableCell>
                <TableCell>
                  <img
                    src={illustration.thumbnailURL || "/placeholder.svg"}
                    alt={`${illustration.songTitle} thumbnail`}
                    className="w-12 h-12 rounded object-cover cursor-pointer"
                    onClick={() => setPreviewImage(illustration.imageURL)}
                  />
                </TableCell>
                <TableCell>{illustration.promptModel}</TableCell>
                <TableCell>{illustration.imageModel}</TableCell>
                <TableCell>
                  <Badge variant={illustration.isActive ? "default" : "secondary"}>
                    {illustration.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{illustration.createdAt.toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingIllustration(illustration)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewImage(illustration.imageURL)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open(illustration.imageURL, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={previewImage || "/placeholder.svg"}
                alt="Preview"
                className="max-w-full max-h-96 object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function IllustrationForm({
  illustration,
  onSave,
}: { illustration: SongIllustration | null; onSave: (data: Partial<SongIllustration>) => void }) {
  const [formData, setFormData] = useState({
    songId: illustration?.songId || "",
    songTitle: illustration?.songTitle || "",
    promptId: illustration?.promptId || "",
    promptModel: illustration?.promptModel || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    isActive: illustration?.isActive || false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="songId">Song ID</Label>
          <Input
            id="songId"
            value={formData.songId}
            onChange={(e) => setFormData({ ...formData, songId: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="songTitle">Song Title</Label>
          <Input
            id="songTitle"
            value={formData.songTitle}
            onChange={(e) => setFormData({ ...formData, songTitle: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="promptModel">Prompt Model</Label>
          <Input
            id="promptModel"
            value={formData.promptModel}
            onChange={(e) => setFormData({ ...formData, promptModel: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageModel">Image Model</Label>
          <Input
            id="imageModel"
            value={formData.imageModel}
            onChange={(e) => setFormData({ ...formData, imageModel: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promptId">Prompt ID</Label>
        <Input
          id="promptId"
          value={formData.promptId}
          onChange={(e) => setFormData({ ...formData, promptId: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageURL">Image URL</Label>
        <Input
          id="imageURL"
          type="url"
          value={formData.imageURL}
          onChange={(e) => setFormData({ ...formData, imageURL: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnailURL">Thumbnail URL</Label>
        <Input
          id="thumbnailURL"
          type="url"
          value={formData.thumbnailURL}
          onChange={(e) => setFormData({ ...formData, thumbnailURL: e.target.value })}
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <Button type="submit" className="w-full">
        {illustration ? "Update Illustration" : "Create Illustration"}
      </Button>
    </form>
  )
}
