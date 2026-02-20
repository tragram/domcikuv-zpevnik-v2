// illustration-card.tsx
import { useRouteContext } from "@tanstack/react-router";
import { Edit, ExternalLink, Eye, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IllustrationPromptDB, SongIllustrationDB } from "src/lib/db/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ActionButtons } from "../shared/action-buttons";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { IllustrationForm } from "./illustration-form/illustration-form";
import {
  useDeleteIllustration,
  useRestoreIllustration,
  useUpdateIllustration,
} from "../../adminHooks";
import DeletePrompt from "~/components/dialogs/delete-prompt";
import { IllustrationModifySchema } from "src/worker/helpers/illustration-helpers";
import {
  SummaryPromptVersion,
  AvailableSummaryModel,
  AvailableImageModel,
} from "src/worker/helpers/image-generator";
import { SongWithCurrentVersion } from "src/worker/helpers/song-helpers";

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
  const isActive = illustration.id === song.currentIllustrationId;

  const updateMutation = useUpdateIllustration(adminApi);
  const deleteMutation = useDeleteIllustration(adminApi);
  const restoreMutation = useRestoreIllustration(adminApi);

  const handleUpdateIllustration = async (
    id: string,
    illustrationData: IllustrationModifySchema,
  ) => {
    try {
      await updateMutation.mutateAsync({ id, data: illustrationData });
      toast.success("Illustration updated successfully");
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update illustration");
      console.error("Update error:", error);
    }
  };

  const handleDeleteIllustration = async () => {
    try {
      await deleteMutation.mutateAsync(illustration.id);
      toast.success("Illustration deleted successfully");
    } catch (error) {
      toast.error("Failed to delete illustration");
      console.error("Delete error:", error);
    }
  };

  const handleRestoreIllustration = async () => {
    try {
      await restoreMutation.mutateAsync(illustration.id);
      toast.success("Illustration restored successfully");
    } catch (error) {
      toast.error("Failed to restore illustration");
      console.error("Restore error:", error);
    }
  };

  const handleToggleActive = async () => {
    try {
      await updateMutation.mutateAsync({
        id: illustration.id,
        data: { setAsActive: !isActive },
      });
      toast.success(
        isActive ? "Illustration deactivated" : "Illustration activated",
      );
    } catch (error) {
      toast.error("Failed to update illustration status");
      console.error("Toggle active error:", error);
    }
  };

  // Transform illustration data to match form expectations
  const transformedIllustration = {
    promptId: prompt.id,
    songId: illustration.songId,
    summaryPromptVersion: prompt.summaryPromptVersion as SummaryPromptVersion,
    summaryModel: prompt.summaryModel as AvailableSummaryModel,
    imageModel: illustration.imageModel as AvailableImageModel,
    imageURL: illustration.imageURL,
    thumbnailURL: illustration.thumbnailURL,
    setAsActive: isActive,
  };

  return (
    <>
      <div
        className={cn(
          "border-2 rounded-lg p-1 md:p-3 space-y-2 transition-all duration-200",
          isActive ? "border-primary shadow-md" : "border-gray-200",
          illustration.deleted ? "opacity-50" : "",
          updateMutation.isPending ? "opacity-70" : "",
        )}
      >
        <div className="flex items-start justify-between">
          <div className="relative w-full">
            <img
              src={illustration.imageURL}
              alt={`Illustration for ${song.title}`}
              className="w-full rounded object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onPreview(illustration.imageURL)}
            />
            {updateMutation.isPending && (
              <div className="absolute inset-0 bg-black/20 rounded flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
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

        <ActionButtons>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
            disabled={updateMutation.isPending}
            className="h-7 w-7 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview(illustration.imageURL)}
            className="h-7 w-7 p-0"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(illustration.imageURL, "_blank")}
            className="h-7 w-7 p-0"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>

          {illustration.deleted ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-green-600" />
                    Restore Illustration
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to restore this illustration?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRestoreIllustration}
                    className="bg-green-600 text-white hover:bg-green-700"
                    disabled={restoreMutation.isPending}
                  >
                    {restoreMutation.isPending ? "Restoring..." : "Restore"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <DeletePrompt
              onDelete={handleDeleteIllustration}
              title="Are you sure you want to delete this illustration?"
              description="This action cannot be undone."
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
            />
          )}

          {!illustration.deleted && (
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={cn(
                "text-xs cursor-pointer h-7 transition-colors",
                updateMutation.isPending
                  ? "pointer-events-none opacity-50"
                  : "hover:opacity-80",
              )}
              onClick={handleToggleActive}
            >
              {updateMutation.isPending
                ? "..."
                : isActive
                  ? "Active"
                  : "Inactive"}
            </Badge>
          )}
        </ActionButtons>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Illustration</DialogTitle>
          </DialogHeader>
          <IllustrationForm
            illustration={transformedIllustration}
            onSave={({ illustrationData }) =>
              handleUpdateIllustration(illustration.id, illustrationData)
            }
            isLoading={updateMutation.isPending}
            manualOnly
            onSuccess={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
