import type React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Edit, Eye, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { deleteIllustration, updateIllustration } from "~/services/songs";
import { cn } from "~/lib/utils";
import {
  IllustrationApiResponse,
  IllustrationCreateSchema,
  IllustrationModifySchema,
} from "src/worker/api/admin/illustrations";
import { IllustrationForm } from "./illustration-form";

interface IllustrationCardProps {
  illustration: IllustrationApiResponse;
  onPreview: (imageUrl: string) => void;
}

export function IllustrationCard({
  illustration,
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
      promptId: create.promptId,
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
      queryClient.setQueryData<IllustrationApiResponse[]>(
        ["illustrationsAdmin"],
        (old) => {
          if (!old) return old;
          old = old.map((ill) => {
            if (responseData.isActive && ill.songId === responseData.songId) {
              ill.isActive = false;
              console.log(ill);
            }
            return ill.id === responseData.id ? responseData : ill;
          });
          return old;
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
      queryClient.setQueryData<IllustrationApiResponse[]>(
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
            src={illustration.imageURL || "/placeholder.svg?height=60&width=60"}
            alt={`${illustration.song?.title || "Unknown"} thumbnail`}
            className="w-full rounded object-cover cursor-pointer"
            onClick={() => onPreview(illustration.imageURL)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Summary prompt ID:</span>{" "}
            {illustration.illustrationPrompt.summaryPromptId}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Lyrics summary:</span>{" "}
            {illustration.illustrationPrompt.summaryModel}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Image:</span>{" "}
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
            illustration={illustration}
            onSave={(data: IllustrationCreateSchema) =>
              handleUpdateIllustration(createToModifySchema(data))
            }
            isLoading={updateMutation.isPending}
            dropdownOptions={undefined}
            manualOnly
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
