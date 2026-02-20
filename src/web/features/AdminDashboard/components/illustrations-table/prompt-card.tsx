import { useRouteContext } from "@tanstack/react-router";
import { Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IllustrationPromptDB } from "src/lib/db/schema";
import { Button } from "~/components/ui/button";
import { ActionButtons } from "../shared/action-buttons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import DeletePrompt from "~/components/dialogs/delete-prompt";
import { cn } from "~/lib/utils";
import { useDeletePrompt, useUpdatePrompt } from "../../adminHooks";

interface PromptCardProps {
  prompt: IllustrationPromptDB;
}

export function PromptCard({ prompt }: PromptCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editText, setEditText] = useState(prompt.text);

  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const updateMutation = useUpdatePrompt(adminApi);
  const deleteMutation = useDeletePrompt(adminApi);

  const handleUpdate = async () => {
    try {
      await updateMutation.mutateAsync({ id: prompt.id, text: editText });
      toast.success("Prompt updated successfully");
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update prompt");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(prompt.id);
      toast.success("Prompt deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete prompt");
    }
  };

  return (
    <>
      <div
        className={cn(
          "border-2 rounded-lg p-3 space-y-2 border-gray-200 transition-all duration-200 flex flex-col justify-between",
          deleteMutation.isPending ? "opacity-50 pointer-events-none" : "",
        )}
      >
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Version:</span>{" "}
                {prompt.summaryPromptVersion}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Model:</span>{" "}
                {prompt.summaryModel}
              </p>
            </div>
          </div>

          <div className="bg-muted/30 p-2 rounded border border-muted text-xs text-muted-foreground max-h-52 overflow-y-auto whitespace-pre-wrap font-mono">
            {prompt.text}
          </div>
        </div>

        <div className="pt-2">
          <ActionButtons>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              className="h-7 w-7 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <DeletePrompt
              onDelete={handleDelete}
              title="Delete Prompt?"
              description="This cannot be undone. You cannot delete prompts currently used by illustrations."
              variant="ghost"
              size="sm"
              mini={true}
              disabled={deleteMutation.isPending}
            />
          </ActionButtons>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
              placeholder="Enter your prompt text..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={
                updateMutation.isPending || editText.trim() === prompt.text
              }
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
