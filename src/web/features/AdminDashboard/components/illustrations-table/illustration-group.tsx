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
  illustrations: IllustrationApiResponse[]
  isExpanded: boolean
  onToggleExpanded: () => void
}

export function SongIllustrationsGroup({ illustrations, isExpanded, onToggleExpanded }: SongIllustrationsGroupProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const someActive = illustrations.map((i) => i.isActive).reduce((a, c) => a + Number(c), 0) > 0
  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors gap-2",
              someActive ? "" : "border-red-900 border-2",
            )}
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="text-left flex-shrink-0 min-w-0 max-w-[200px] sm:max-w-none">
                <h4 className="font-medium truncate" title={illustrations[0].song.title || "Unknown Song"}>
                  {illustrations[0].song.title || "Unknown Song"}
                </h4>
                <p className="text-sm text-muted-foreground truncate" title={illustrations[0].song.artist}>
                  {illustrations[0].song.artist}
                </p>
              </div>

              {/* Thumbnail Preview Row - Hidden on mobile, shown on larger screens */}
              <div className="hidden sm:flex items-center gap-2 ml-4 flex-1 overflow-hidden">
                {illustrations.slice(0, 3).map((illustration, index) => (
                  <div key={illustration.id} className="relative flex-shrink-0">
                    <img
                      src={illustration.thumbnailURL}
                      alt={`${illustration.song?.title} preview ${index + 1}`}
                      className={cn(
                        "w-10 h-10 sm:w-12 sm:h-12 rounded object-cover border-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                        illustration.isActive ? "border-primary" : "",
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewImage(illustration.imageURL)
                      }}
                    />
                  </div>
                ))}
                {illustrations.length > 3 && (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-muted border shadow-sm flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                    +{illustrations.length - 3}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {!someActive && (
                <Badge variant="secondary" className="text-xs bg-red-900 px-1 sm:px-2">
                  <span className="hidden sm:inline">none active</span>
                  <span className="sm:hidden">inactive</span>
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs px-1 sm:px-2">
                <span className="hidden sm:inline">{illustrations.length} total</span>
                <span className="sm:hidden">{illustrations.length}</span>
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-1 md:px-3 pb-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
              {illustrations.map((illustration) => (
                <IllustrationCard key={illustration.id} illustration={illustration} onPreview={setPreviewImage} />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
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
  )
}
