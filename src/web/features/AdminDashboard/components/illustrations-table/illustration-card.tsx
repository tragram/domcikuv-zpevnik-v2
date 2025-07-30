import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Edit, ExternalLink, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IllustrationPromptDB, SongIllustrationDB } from "src/lib/db/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { deleteIllustration, updateIllustration } from "~/services/songs";
import { IllustrationForm } from "./illustration-form/illustration-form";

// Updated interfaces to match backend
interface IllustrationCreateSchema {
  songId: string;
  summaryPromptVersion: string;
  imageModel: string;
  imageURL?: string;
  thumbnailURL?: string;
  isActive: boolean;
  imageFile?: File;
  thumbnailFile?: File;
}

interface IllustrationModifySchema {
  id: string;
  imageModel?: string;
  imageURL?: string;
  thumbnailURL?: string;
  isActive?: boolean;
}

interface IllustrationCardProps {
  song: { id: string; title: string; artist: string };
  illustration: SongIllustrationDB;
  prompt: IllustrationPromptDB;
  onPreview: (imageUrl: string) => void;
}

export function IllustrationCard({
  song,
  illustration,
  prompt,
  onPreview,
}: IllustrationCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const routeContext = useRouteContext({ from: "/admin" });
  const adminApi = routeContext.api.admin;
  const queryClient = useQueryClient();

  const createToModifySchema = (
    create: IllustrationCreateSchema
  ): IllustrationModifySchema => {
    return {
      id: illustration.id,
      imageModel: create.imageModel,
      imageURL: create.imageURL,
      thumbnailURL: create.thumbnailURL,
      isActive: create.isActive,
    };
  };

  const updateMutation = useMutation({
    mutationFn: async (data: IllustrationModifySchema) =>
      updateIllustration(adminApi, data),
    onSuccess: (responseData) => {
      // Update the cache with the returned data from the API
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (oldIlls) => {
          if (!oldIlls) return oldIlls;
          oldIlls = oldIlls.map((ill) => {
            if (
              responseData.illustration.isActive &&
              ill.songId === responseData.song.id
            ) {
              ill.isActive = false;
            }
            if (ill.id === responseData.illustration.id) {
              console.log(responseData.illustration);
            }
            return ill.id === responseData.illustration.id
              ? responseData.illustration
              : ill;
          });
          return oldIlls;
        }
      );
      toast.success("Illustration updated successfully");
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to update illustration");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteIllustration(adminApi, id);
    },
    onSuccess: (responseData) => {
      // Remove the deleted item from cache
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (old) => {
          if (!old) return old;
          return old.filter((ill) => ill.id !== responseData.id);
        }
      );
      toast.success("Illustration deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete illustration");
    },
  });

  const handleUpdateIllustration = (
    illustrationData: IllustrationModifySchema
  ) => {
    updateMutation.mutate(illustrationData);
  };

  const handleDeleteIllustration = () => {
    if (confirm("Are you sure you want to delete this illustration?")) {
      deleteMutation.mutate(illustration.id);
    }
  };

  // Transform illustration data to match form expectations
  const transformedIllustration = {
    songId: illustration.songId,
    summaryPromptVersion: prompt.summaryPromptVersion,
    summaryModel: prompt.summaryModel,
    imageModel: illustration.imageModel,
    imageURL: illustration.imageURL,
    thumbnailURL: illustration.thumbnailURL,
    isActive: illustration.isActive,
  };

  return (
    <>
      <div
        className={cn(
          "border-2 rounded-lg p-1 md:p-3 space-y-2",
          illustration.isActive ? "border-primary" : ""
        )}
      >
        <div className="flex items-start justify-between">
          <img
            src={illustration.imageURL}
            alt={`${illustration.imageURL} thumbnail`}
            className="w-full rounded object-cover cursor-pointer"
            onClick={() => onPreview(illustration.imageURL)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Summary prompt version:</span>{" "}
            {prompt.summaryPromptVersion}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Lyrics summary by:</span>{" "}
            {prompt.summaryModel}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Image by:</span>{" "}
            {illustration.imageModel}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Created:</span>{" "}
            {illustration.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsEditDialogOpen(true)}
            disabled={updateMutation.isPending}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onPreview(illustration.imageURL)}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => window.open(illustration.imageURL, "_blank")}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleDeleteIllustration}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Badge
            variant={illustration.isActive ? "default" : "secondary"}
            className="text-xs cursor-pointer"
            onClick={() => {
              handleUpdateIllustration({
                id: illustration.id,
                isActive: !illustration.isActive,
              });
            }}
          >
            {illustration.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Illustration</DialogTitle>
          </DialogHeader>
          <IllustrationForm
            illustration={transformedIllustration}
            onSave={(data: IllustrationCreateSchema) =>
              handleUpdateIllustration(createToModifySchema(data))
            }
            isLoading={updateMutation.isPending}
            dropdownOptions={{
              promptVersions: [],
              summaryModels: [],
              imageModels: [],
            }}
            manualOnly
          />
        </DialogContent>
      </Dialog>
    </>
  );
}