import type React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "~/components/shadcn-ui/button";
import { Badge } from "~/components/shadcn-ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn-ui/dialog";
import { Edit, Eye, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router";
import { deleteIllustration, updateIllustration } from "~/services/songs";
import { cn } from "~/lib/utils";
import {
  IllustrationApiResponse,
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
  const queryClient = routeContext.queryClient;

  const updateMutation = useMutation({
    mutationFn: async (data: IllustrationModifySchema) =>
      updateIllustration(adminApi, data),
    onMutate: async (data: IllustrationModifySchema) => {
      const previousIllustrations: IllustrationApiResponse[] =
        queryClient.getQueryData(["illustrationsAdmin"]);
      queryClient.setQueryData(
        ["illustrationsAdmin"],
        previousIllustrations.map((ill) =>
          ill.id === data.id ? { ...ill, ...data } : ill
        )
      );
      return { previousIllustrations };
    },
    onSuccess: (responseData) => {
      queryClient.setQueryData(
        ["illustrationsAdmin"],
        (old: IllustrationApiResponse[]) =>
          old.map((ill) => (ill.id === responseData.id ? responseData : ill))
      );
      toast.success("Illustration updated successfully");
      setIsEditDialogOpen(false);
    },
    onError: (err, variables, context) => {
      toast.error("Failed to update illustration");
      queryClient.setQueryData(
        ["illustrationsAdmin"],
        context.previousIllustrations
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteIllustration(adminApi, id);
    },
    onSuccess: (responseData) => {
      toast.success("Illustration deleted successfully");
      queryClient.setQueryData(
        ["illustrationsAdmin"],
        (old: IllustrationApiResponse[]) =>
          old.filter((ill) => ill.id !== responseData.id)
      );
    },
    onError: () => {
      toast.error("Failed to delete illustration");
    },
  });

  const handleUpdateIllustration = (
    illustrationData: IllustrationModifySchema
  ) => {
    try {
      updateMutation.mutateAsync(illustrationData);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteIllustration = () => {
    if (confirm("Are you sure you want to delete this illustration?")) {
      deleteMutation.mutateAsync(illustration.id);
    }
  };

  return (
    <>
      <div
        className={cn(
          "border-2 rounded-lg p-3 space-y-2",
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
            <span className="font-medium">Prompt:</span>{" "}
            {illustration.promptModel}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Image:</span>{" "}
            {illustration.imageModel}
          </p>
          <p className="text-xs text-muted-foreground">
            {illustration.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsEditDialogOpen(true)}
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
            onSave={handleUpdateIllustration}
            isLoading={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
