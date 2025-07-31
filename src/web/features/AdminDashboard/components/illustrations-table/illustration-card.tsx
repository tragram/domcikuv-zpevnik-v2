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
import { SongWithCurrentVersion } from "src/worker/api/admin/songs";
import {
  IllustrationCreateSchema,
  IllustrationModifySchema,
} from "src/worker/api/admin/illustrations";

interface IllustrationCardProps {
  song: SongWithCurrentVersion;
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
  const isActive = illustration.id === song.currentIllustrationId;

  const createToModifySchema = (
    create: IllustrationCreateSchema
  ): IllustrationModifySchema => {
    return {
      imageModel: create.imageModel,
      imageURL: create.imageURL,
      thumbnailURL: create.thumbnailURL,
      setAsActive: create.setAsActive,
    };
  };

  const updateMutation = useMutation({
    mutationFn: async (id: string, data: IllustrationModifySchema) =>
      updateIllustration(adminApi, id, data),
    onSuccess: (responseData) => {
      // Update the cache with the returned data from the API
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (oldIlls) => {
          if (!oldIlls) return oldIlls;
          oldIlls = oldIlls.map((ill) => {
            if (
              responseData.illustration.setAsActive &&
              ill.songId === responseData.song.id
            ) {
              ill.setAsActive = false;
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
    id: string,
    illustrationData: IllustrationModifySchema
  ) => {
    updateMutation.mutate(id, illustrationData);
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
    setAsActive: illustration.setAsActive,
  };

  return (
    <>
      <div
        className={cn(
          "border-2 rounded-lg p-1 md:p-3 space-y-2",
          isActive ? "border-primary" : ""
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
            variant={isActive ? "default" : "secondary"}
            className="text-xs cursor-pointer"
            onClick={() => {
              handleUpdateIllustration({
                id: illustration.id,
                isActive: !isActive,
              });
            }}
          >
            {isActive ? "Active" : "Inactive"}
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
