import { useRouteContext } from "@tanstack/react-router";
import { Edit, ExternalLink, Eye, RotateCcw } from "lucide-react";
import { useState } from "react";
import { IllustrationPromptDB, SongIllustrationDB } from "src/lib/db/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DeletePrompt } from "../shared/delete-prompt";
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
import { IllustrationModifySchema } from "src/worker/services/illustration-service";
import { SongWithCurrentVersion } from "src/worker/services/song-service";
import {
  useDeleteIllustration,
  useRestoreIllustration,
  useUpdateIllustration,
} from "../../hooks";

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

  const handleUpdateIllustration = (
    id: string,
    illustrationData: IllustrationModifySchema
  ) => {
    updateMutation.mutate({ id, data: illustrationData });
  };

  const handleDeleteIllustration = () => {
    deleteMutation.mutate(illustration.id);
  };

  const handleRestoreIllustration = () => {
    restoreMutation.mutate(illustration.id);
  };

  // Transform illustration data to match form expectations
  const transformedIllustration = {
    promptId: prompt.id,
    songId: illustration.songId,
    summaryPromptVersion: prompt.summaryPromptVersion,
    summaryModel: prompt.summaryModel,
    imageModel: illustration.imageModel,
    imageURL: illustration.imageURL,
    thumbnailURL: illustration.thumbnailURL,
    setAsActive: isActive,
  };

  return (
    <>
      <div
        className={cn(
          "border-2 rounded-lg p-1 md:p-3 space-y-2",
          isActive ? "border-primary" : "",
          illustration.deleted ? "opacity-50" : ""
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
        <ActionButtons>
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
          {illustration.deleted ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
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
                  >
                    Restore
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
            />
          )}
          {!illustration.deleted && (
            <Badge
              variant={isActive ? "default" : "secondary"}
              className="text-xs cursor-pointer h-7"
              onClick={() => {
                handleUpdateIllustration(illustration.id, {
                  setAsActive: !isActive,
                });
              }}
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          )}
        </ActionButtons>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Illustration</DialogTitle>
          </DialogHeader>
          <IllustrationForm
            illustration={transformedIllustration}
            onSave={(data) =>
              handleUpdateIllustration(illustration.id, data.illustrationData)
            }
            isLoading={updateMutation.isPending}
            dropdownOptions={{
              promptVersions: { data: [], default: "v1" },
              summaryModels: { data: [], default: "gpt-4o-mini" },
              imageModels: { data: [], default: "FLUX.1-dev" },
            }}
            manualOnly
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
