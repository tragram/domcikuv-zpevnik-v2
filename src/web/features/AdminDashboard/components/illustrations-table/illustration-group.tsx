// illustration-group.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IllustrationPromptDB, SongIllustrationDB } from "src/lib/db/schema";
import {
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "src/worker/api/admin/image-generator";
import {
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
} from "src/worker/helpers/illustration-service";
import { SongWithCurrentVersion } from "src/worker/helpers/song-service";
import FormDialog from "~/components/dialogs/form-dialog";
import PreviewDialog from "~/components/dialogs/preview-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import { createIllustration, generateIllustration } from "~/services/song-service";
import { IllustrationCard } from "./illustration-card";
import {
  IllustrationForm,
  IllustrationSubmitData,
} from "./illustration-form/illustration-form";

interface SongIllustrationsGroupProps {
  song: SongWithCurrentVersion;
  illustrations: SongIllustrationDB[];
  prompts: Record<string, IllustrationPromptDB>;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  showDeleted: boolean;
}

const backendDropdownOptions = {
  promptVersions: {
    data: SUMMARY_PROMPT_VERSIONS.map((spi) => {
      return { value: spi, label: spi };
    }),
    default: "v2" as const,
  },
  summaryModels: {
    data: SUMMARY_MODELS_API.map((smi) => {
      return { value: smi, label: smi };
    }),
    default: "gpt-4o-mini" as const,
  },
  imageModels: {
    data: IMAGE_MODELS_API.map((im) => {
      return { value: im, label: im };
    }),
    default: "FLUX.1-dev" as const,
  },
};

export function SongIllustrationsGroup({
  song,
  illustrations,
  prompts,
  isExpanded,
  onToggleExpanded,
  showDeleted,
}: SongIllustrationsGroupProps) {
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const someActive = Boolean(song.currentIllustrationId);

  const filteredIllustrations = showDeleted
    ? illustrations
    : illustrations.filter((i) => !i.deleted);
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;

  const createMutation = useMutation({
    mutationFn: async (data: IllustrationCreateSchema) => {
      return await createIllustration(adminApi, data);
    },
    onSuccess: () => {
      toast.success("Illustration created successfully");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["promptsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });

      // Auto-expand the group to show the new illustration
      if (!isExpanded) {
        onToggleExpanded();
      }
    },
    onError: (error) => {
      console.error("Create illustration error:", error);
      toast.error("Failed to create illustration");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: IllustrationGenerateSchema) => {
      return await generateIllustration(adminApi, data);
    },
    onSuccess: () => {
      toast.success("Illustration generated successfully");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["promptsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });

      // Auto-expand the group to show the new illustration
      if (!isExpanded) {
        onToggleExpanded();
      }
    },
    onError: (error) => {
      console.error("Generate illustration error:", error);
      toast.error("Failed to generate illustration");
    },
  });

  const handleCreateIllustration = async ({
    illustrationData,
    mode,
  }: IllustrationSubmitData) => {
    try {
      if (mode === "manual") {
        await createMutation.mutateAsync(
          illustrationData as IllustrationCreateSchema,
        );
      } else {
        await generateMutation.mutateAsync(
          illustrationData as IllustrationGenerateSchema,
        );
      }
    } catch (error) {
      // Error handling is done in onError callbacks
      console.error("Illustration creation/generation error:", error);
    }
  };

  const isLoading = createMutation.isPending || generateMutation.isPending;

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors gap-2",
            someActive ? "" : "border-red-900 border-2",
          )}
        >
          <CollapsibleTrigger className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-shrink-0 min-w-0 max-w-[200px] sm:max-w-none">
              <h4
                className="font-medium truncate"
                title={song.title || "Unknown Song"}
              >
                {song.title || "Unknown Song"}
              </h4>
              <p
                className="text-sm text-muted-foreground truncate"
                title={song.artist}
              >
                {song.artist}
              </p>
            </div>

            {/* Thumbnail Preview Row - Hidden on mobile, shown on larger screens */}
            <div className="hidden sm:flex items-center gap-2 ml-4 flex-1 overflow-hidden">
              {filteredIllustrations.slice(0, 3).map((illustration, index) => (
                <div key={illustration.id} className="relative flex-shrink-0">
                  <img
                    src={illustration.thumbnailURL}
                    alt={`${song.title} preview ${index + 1}`}
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded object-cover border-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                      illustration.id === song.currentIllustrationId
                        ? "border-primary"
                        : "",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(illustration.imageURL);
                    }}
                  />
                </div>
              ))}
              {filteredIllustrations.length > 3 && (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-muted border shadow-sm flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                  +{filteredIllustrations.length - 3}
                </div>
              )}
            </div>
          </CollapsibleTrigger>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {!someActive && (
              <Badge
                variant="secondary"
                className="text-xs bg-red-900 px-1 sm:px-2"
              >
                <span className="hidden sm:inline">none active</span>
                <span className="sm:hidden">inactive</span>
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                "text-xs px-1 sm:px-2",
                filteredIllustrations.length === 0 ? "bg-red-900" : "",
              )}
            >
              <span className="hidden sm:inline">
                {filteredIllustrations.length} total
              </span>
              <span className="sm:hidden">{filteredIllustrations.length}</span>
            </Badge>
            <FormDialog
              trigger={
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-white shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
              title={`Add New Illustration for "${song.title}"`}
              maxWidth="2xl"
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
            >
              <IllustrationForm
                illustration={{ songId: song.id }}
                onSave={handleCreateIllustration}
                isLoading={isLoading}
                dropdownOptions={backendDropdownOptions}
                onSuccess={() => setIsDialogOpen(false)}
              />
            </FormDialog>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-1 md:px-3 pb-3">
            {filteredIllustrations.length === 0 ? (
              <div className="mt-3 p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <p className="text-sm">No illustrations yet</p>
                <p className="text-xs mt-1">
                  Click the + button above to create one
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
                {filteredIllustrations
                  .filter((illustration) => prompts[illustration.promptId])
                  .map((illustration) => (
                    <IllustrationCard
                      key={illustration.id}
                      song={song}
                      illustration={illustration}
                      onPreview={setPreviewImage}
                      prompt={prompts[illustration.promptId]}
                    />
                  ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
      <PreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        title={`Image Preview - ${song.title}`}
        maxWidth="4xl"
      >
        <div className="flex justify-center">
          <img
            src={previewImage!}
            alt="Full size preview"
            className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
          />
        </div>
      </PreviewDialog>
    </>
  );
}
