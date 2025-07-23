import type React from "react";
import { useState } from "react";
import { Button } from "~/components/shadcn-ui/button";
import { Input } from "~/components/shadcn-ui/input";
import { Badge } from "~/components/shadcn-ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn-ui/dialog";
import { Label } from "~/components/shadcn-ui/label";
import { Switch } from "~/components/shadcn-ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/shadcn-ui/collapsible";
import {
  Plus,
  Edit,
  Search,
  ExternalLink,
  Eye,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router";
import {
  createIllustration,
  deleteIllustration,
  updateIllustration,
} from "~/lib/songs";
import { cn } from "~/lib/utils";
import { SongIllustrationDB } from "src/lib/db/schema";

interface IllustrationsTableProps {
  illustrations: SongIllustrationDB[];
}

export function IllustrationsTable({ illustrations }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingIllustration, setEditingIllustration] =
    useState<SongIllustrationDB | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const adminApi = useRouteContext({ from: "/admin" }).api.admin;

  const createMutation = {
    mutateAsync: async (data: Omit<SongIllustrationDB, "id" | "createdAt">) => {
      try {
        const result = await createIllustration(adminApi, data);
        toast.success("Illustration created successfully");
        return result;
      } catch (error) {
        toast.error("Failed to create illustration");
        throw error;
      }
    },
    isPending: false,
  };

  const updateMutation = {
    mutateAsync: async (data: Partial<SongIllustrationDB> & { id: string }) => {
      try {
        const result = await updateIllustration(adminApi, data);
        toast.success("Illustration updated successfully");
        return result;
      } catch (error) {
        toast.error("Failed to update illustration");
        throw error;
      }
    },
    isPending: false,
  };

  const deleteMutation = {
    mutateAsync: async (id: string) => {
      try {
        const result = await deleteIllustration(adminApi, id);
        toast.success("Illustration deleted successfully");
        return result;
      } catch (error) {
        toast.error("Failed to delete illustration");
        throw error;
      }
    },
    isPending: false,
  };

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
    illustrationData: Partial<SongIllustrationDB>
  ) => {
    if (editingIllustration) {
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
      const response = await createMutation.mutateAsync(
        illustrationData as Omit<SongIllustrationDB, "id" | "createdAt">
      );
      const newIllustration: SongIllustrationDB = {
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

  const toggleGroup = (songId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(songId)) {
      newExpanded.delete(songId);
    } else {
      newExpanded.add(songId);
    }
    setExpandedGroups(newExpanded);
  };

  // Group illustrations by songId
  const groupedIllustrations = filteredIllustrations.reduce(
    (groups, illustration) => {
      const songId = illustration.songId;
      if (!groups[songId]) {
        groups[songId] = [];
      }
      groups[songId].push(illustration);
      return groups;
    },
    {} as Record<string, SongIllustrationDB[]>
  );

  // Sort groups by song title
  const sortedGroups = Object.entries(groupedIllustrations).sort(
    ([, a], [, b]) => {
      const titleA = a[0]?.songTitle || "Unknown Song";
      const titleB = b[0]?.songTitle || "Unknown Song";
      return titleA.localeCompare(titleB);
    }
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Song Illustrations</h3>
          <p className="text-sm text-muted-foreground">
            {sortedGroups.length} songs • {filteredIllustrations.length}{" "}
            illustrations
          </p>
        </div>
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

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs or illustrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpandedGroups(new Set(sortedGroups.map(([songId]) => songId)))
            }
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedGroups(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedGroups.map(([songId, illustrations]) => {
          const isExpanded = expandedGroups.has(songId);
          const activeCount = illustrations.filter(
            (ill) => ill.isActive
          ).length;

          return (
            <Collapsible
              key={songId}
              open={isExpanded}
              onOpenChange={() => toggleGroup(songId)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="text-left flex-shrink-0">
                      <h4 className="font-medium">
                        {illustrations[0]?.songTitle || "Unknown Song"}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        ID: {songId}
                      </p>
                    </div>

                    {/* Thumbnail Preview Row */}
                    <div className="flex items-center gap-2 ml-4 flex-1">
                      {illustrations.slice(0, 5).map((illustration, index) => (
                        <div key={illustration.id} className="relative">
                          <img
                            src={
                              illustration.thumbnailURL ||
                              "/placeholder.svg?height=48&width=48"
                            }
                            alt={`${illustration.songTitle} preview ${
                              index + 1
                            }`}
                            className={cn(
                              "w-12 h-12 rounded object-cover border-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                              illustration.isActive ? "border-primary" : ""
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(illustration.imageURL);
                            }}
                          />
                        </div>
                      ))}
                      {illustrations.length > 5 && (
                        <div className="w-12 h-12 rounded bg-muted border shadow-sm flex items-center justify-center text-xs font-medium text-muted-foreground">
                          +{illustrations.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {illustrations.length} total
                    </Badge>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
                    {illustrations.map((illustration) => (
                      <div
                        key={illustration.id}
                        className={cn(
                          "border-2 rounded-lg p-3 space-y-2",
                          illustration.isActive ? "border-primary" : ""
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <img
                            src={
                              illustration.imageURL ||
                              "/placeholder.svg?height=60&width=60"
                            }
                            alt={`${
                              illustration.songTitle || "Unknown"
                            } thumbnail`}
                            className="w-full rounded object-cover cursor-pointer"
                            onClick={() =>
                              setPreviewImage(illustration.imageURL)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Prompt:</span>{" "}
                            {illustration.promptModel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Image:</span>{" "}
                            {illustration.imageModel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {illustration.createdAt}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingIllustration(illustration);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              setPreviewImage(illustration.imageURL)
                            }
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              window.open(illustration.imageURL, "_blank")
                            }
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              handleDeleteIllustration(illustration.id)
                            }
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Badge
                            variant={
                              illustration.isActive ? "default" : "secondary"
                            }
                            className="text-xs"
                            onClick={() => {
                              handleSaveIllustration({
                                id: illustration.id,
                                isActive: !illustration.isActive,
                              });
                            }}
                          >
                            {illustration.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {sortedGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No illustrations found matching your search.
          </div>
        )}
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
                src={previewImage || "/placeholder.svg?height=400&width=600"}
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
  illustration: SongIllustrationDB | null;
  onSave: (data: Partial<SongIllustrationDB>) => void;
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
