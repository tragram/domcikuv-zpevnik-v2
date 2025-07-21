import type React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/shadcn-ui/button";
import { Input } from "~/components/shadcn-ui/input";
import { Badge } from "~/components/shadcn-ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/shadcn-ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn-ui/dialog";
import { Label } from "~/components/shadcn-ui/label";
import { Switch } from "~/components/shadcn-ui/switch";
import { Plus, Edit, Search, ExternalLink, Eye, Trash2 } from "lucide-react";
import {
  createIllustration,
  updateIllustration,
  deleteIllustration,
} from "~/lib/songs";
import { useApi } from "~/lib/api";
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router";

interface SongIllustration {
  id: string;
  songId: string;
  songTitle: string;
  promptId: string;
  promptModel: string;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
  isActive: boolean;
  createdAt: Date;
}

interface IllustrationsTableProps {
  initialIllustrations: SongIllustration[];
}

export function IllustrationsTable({
  initialIllustrations,
}: IllustrationsTableProps) {
  const [illustrations, setIllustrations] = useState<SongIllustration[]>(
    initialIllustrations.map((ill) => ({
      ...ill,
      createdAt: new Date(ill.createdAt),
    }))
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [editingIllustration, setEditingIllustration] =
    useState<SongIllustration | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const api = useRouteContext({ from: "/admin" }).api;
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: Omit<SongIllustration, "id" | "createdAt">) =>
      createIllustration(api.admin, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      toast({
        title: "Success",
        description: "Illustration created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create illustration",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SongIllustration> & { id: string }) =>
      updateIllustration(api.admin, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      toast({
        title: "Success",
        description: "Illustration updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update illustration",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteIllustration(api.admin, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      toast({
        title: "Success",
        description: "Illustration deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete illustration",
        variant: "destructive",
      });
    },
  });

  const filteredIllustrations = illustrations.filter(
    (illustration) =>
      illustration.songTitle
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.promptModel
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.imageModel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveIllustration = async (
    illustrationData: Partial<SongIllustration>
  ) => {
    if (editingIllustration) {
      // Update existing illustration
      await updateMutation.mutateAsync({
        ...illustrationData,
        id: editingIllustration.id,
      });
      setIllustrations(
        illustrations.map((illustration) =>
          illustration.id === editingIllustration.id
            ? { ...illustration, ...illustrationData }
            : illustration
        )
      );
    } else {
      // Create new illustration
      const response = await createMutation.mutateAsync(
        illustrationData as Omit<SongIllustration, "id" | "createdAt">
      );
      const newIllustration: SongIllustration = {
        id: response.id,
        songId: illustrationData.songId || "",
        songTitle: illustrationData.songTitle || "",
        promptId: illustrationData.promptId || "",
        promptModel: illustrationData.promptModel || "",
        imageModel: illustrationData.imageModel || "",
        imageURL: illustrationData.imageURL || "",
        thumbnailURL: illustrationData.thumbnailURL || "",
        isActive: illustrationData.isActive || false,
        createdAt: new Date(),
      };
      setIllustrations([...illustrations, newIllustration]);
    }
    setIsDialogOpen(false);
    setEditingIllustration(null);
  };

  const handleDeleteIllustration = async (id: string) => {
    if (confirm("Are you sure you want to delete this illustration?")) {
      await deleteMutation.mutateAsync(id);
      setIllustrations(illustrations.filter((ill) => ill.id !== id));
    }
  };

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
              <DialogTitle>
                {editingIllustration
                  ? "Edit Illustration"
                  : "Add New Illustration"}
              </DialogTitle>
            </DialogHeader>
            <IllustrationForm
              illustration={editingIllustration}
              onSave={handleSaveIllustration}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
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
                <TableCell className="font-medium">
                  {illustration.songTitle || "Unknown Song"}
                </TableCell>
                <TableCell>
                  <img
                    src={illustration.thumbnailURL || "/placeholder.svg"}
                    alt={`${illustration.songTitle || "Unknown"} thumbnail`}
                    className="w-12 h-12 rounded object-cover cursor-pointer"
                    onClick={() => setPreviewImage(illustration.imageURL)}
                  />
                </TableCell>
                <TableCell>{illustration.promptModel}</TableCell>
                <TableCell>{illustration.imageModel}</TableCell>
                <TableCell>
                  <Badge
                    variant={illustration.isActive ? "default" : "secondary"}
                  >
                    {illustration.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {illustration.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingIllustration(illustration);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewImage(illustration.imageURL)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.open(illustration.imageURL, "_blank")
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteIllustration(illustration.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {previewImage && (
        <Dialog
          open={!!previewImage}
          onOpenChange={() => setPreviewImage(null)}
        >
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
  );
}

function IllustrationForm({
  illustration,
  onSave,
  isLoading,
}: {
  illustration: SongIllustration | null;
  onSave: (data: Partial<SongIllustration>) => void;
  isLoading?: boolean;
}) {
  const [formData, setFormData] = useState({
    songId: illustration?.songId || "",
    songTitle: illustration?.songTitle || "",
    promptId: illustration?.promptId || "",
    promptModel: illustration?.promptModel || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    isActive: illustration?.isActive || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="songId">Song ID</Label>
          <Input
            id="songId"
            value={formData.songId}
            onChange={(e) =>
              setFormData({ ...formData, songId: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="songTitle">Song Title</Label>
          <Input
            id="songTitle"
            value={formData.songTitle}
            onChange={(e) =>
              setFormData({ ...formData, songTitle: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, promptModel: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageModel">Image Model</Label>
          <Input
            id="imageModel"
            value={formData.imageModel}
            onChange={(e) =>
              setFormData({ ...formData, imageModel: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promptId">Prompt ID</Label>
        <Input
          id="promptId"
          value={formData.promptId}
          onChange={(e) =>
            setFormData({ ...formData, promptId: e.target.value })
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageURL">Image URL</Label>
        <Input
          id="imageURL"
          type="url"
          value={formData.imageURL}
          onChange={(e) =>
            setFormData({ ...formData, imageURL: e.target.value })
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnailURL">Thumbnail URL</Label>
        <Input
          id="thumbnailURL"
          type="url"
          value={formData.thumbnailURL}
          onChange={(e) =>
            setFormData({ ...formData, thumbnailURL: e.target.value })
          }
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, isActive: checked })
          }
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading
          ? "Saving..."
          : illustration
          ? "Update Illustration"
          : "Create Illustration"}
      </Button>
    </form>
  );
}
