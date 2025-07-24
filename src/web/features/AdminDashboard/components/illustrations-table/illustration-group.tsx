import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  IllustrationApiResponse,
  IllustrationCreateSchema,
} from "src/worker/api/admin/illustrations";
import { Badge } from "~/components/shadcn-ui/badge";
import { Button } from "~/components/shadcn-ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/shadcn-ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn-ui/dialog";
import { cn } from "~/lib/utils";
import { createIllustration } from "~/services/songs";
import { IllustrationCard } from "./illustration-card";
import { IllustrationForm } from "./illustration-form";

export interface SongWithIllustrations {
  song: {
    id: string;
    title: string;
    artist: string;
  };
  illustrations: IllustrationApiResponse[];
}

interface SongIllustrationsGroupProps {
  song: SongWithIllustrations;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function SongIllustrationsGroup({
  song,
  isExpanded,
  onToggleExpanded,
}: SongIllustrationsGroupProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const someActive =
    song.illustrations
      .map((i) => i.isActive)
      .reduce((a, c) => a + Number(c), 0) > 0;
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;

  const createMutation = useMutation({
    mutationFn: async (data: IllustrationCreateSchema) => {
      return await createIllustration(adminApi, data);
    },
    onSuccess: () => {
      toast.success("Illustration created successfully");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to create illustration");
    },
  });

  const handleCreateIllustration = async (
    illustrationData: IllustrationCreateSchema
  ) => {
    try {
      await createMutation.mutateAsync(illustrationData);
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors gap-2",
              someActive ? "" : "border-red-900 border-2"
            )}
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="text-left flex-shrink-0 min-w-0 max-w-[200px] sm:max-w-none">
                <h4
                  className="font-medium truncate"
                  title={song.song.title || "Unknown Song"}
                >
                  {song.song.title || "Unknown Song"}
                </h4>
                <p
                  className="text-sm text-muted-foreground truncate"
                  title={song.song.artist}
                >
                  {song.song.artist}
                </p>
              </div>

              {/* Thumbnail Preview Row - Hidden on mobile, shown on larger screens */}
              <div className="hidden sm:flex items-center gap-2 ml-4 flex-1 overflow-hidden">
                {song.illustrations.slice(0, 3).map((illustration, index) => (
                  <div key={illustration.id} className="relative flex-shrink-0">
                    <img
                      src={illustration.thumbnailURL}
                      alt={`${illustration.song?.title} preview ${index + 1}`}
                      className={cn(
                        "w-10 h-10 sm:w-12 sm:h-12 rounded object-cover border-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                        illustration.isActive ? "border-primary" : ""
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(illustration.imageURL);
                      }}
                    />
                  </div>
                ))}
                {song.illustrations.length > 3 && (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-muted border shadow-sm flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                    +{song.illustrations.length - 3}
                  </div>
                )}
              </div>
            </div>

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
              <Badge variant="secondary" className="text-xs px-1 sm:px-2">
                <span className="hidden sm:inline">
                  {song.illustrations.length} total
                </span>
                <span className="sm:hidden">{song.illustrations.length}</span>
              </Badge>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="!bg-primary text-white size-5"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Illustration</DialogTitle>
                  </DialogHeader>
                  <IllustrationForm
                    illustration={{ songId: song.song.id }}
                    onSave={handleCreateIllustration}
                    isLoading={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-1 md:px-3 pb-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
              {song.illustrations.map((illustration) => (
                <IllustrationCard
                  key={illustration.id}
                  illustration={illustration}
                  onPreview={setPreviewImage}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
    </>
  );
}
