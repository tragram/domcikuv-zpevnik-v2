import type React from "react";
import { useState } from "react";
import { Badge } from "~/components/shadcn-ui/badge";
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
} from "~/components/shadcn-ui/dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { IllustrationCard } from "./illustration-card";
import { IllustrationApiResponse } from "src/worker/api/admin/illustrations";

interface SongIllustrationsGroupProps {
  illustrations: IllustrationApiResponse[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function SongIllustrationsGroup({
  illustrations,
  isExpanded,
  onToggleExpanded,
}: SongIllustrationsGroupProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const someActive =
    illustrations.map((i) => i.isActive).reduce((a, c) => a + Number(c), 0) > 0;
  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors",
              someActive ? "" : "border-red-900 border-2"
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="text-left flex-shrink-0">
                <h4 className="font-medium">
                  {illustrations[0].song.title || "Unknown Song"}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {illustrations[0].song.artist}
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
                      alt={`${illustration.song?.title} preview ${index + 1}`}
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
              {!someActive && (
                <Badge variant="secondary" className="text-xs bg-red-900">
                  none active
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {illustrations.length} total
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-1 md:px-3 pb-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
              {illustrations.map((illustration) => (
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
