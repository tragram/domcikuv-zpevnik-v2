import { Avatar, AvatarImage } from "~/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog-custom";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { useState, useCallback } from "react";
import { IllustrationPrompt } from "./IllustrationPrompt";

interface IllustrationPopupProps {
  avatarClassName: string;
  song: SongData;
}

export function IllustrationPopup({
  avatarClassName,
  song,
}: IllustrationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [highResError, setHighResError] = useState(false);

  // Track the calculated transform origin for the animation
  const [originOffset, setOriginOffset] = useState({ x: 0, y: 0 });

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. Get the exact position of the clicked thumbnail
    const rect = e.currentTarget.getBoundingClientRect();
    const thumbCenterX = rect.left + rect.width / 2;
    const thumbCenterY = rect.top + rect.height / 2;

    // 2. Get the center point of the window
    const windowCenterX = window.innerWidth / 2;
    const windowCenterY = window.innerHeight / 2;

    // 3. Calculate the difference. Assuming the modal will be centered,
    // this tells the modal exactly where the thumbnail is relative to itself.
    setOriginOffset({
      x: thumbCenterX - windowCenterX,
      y: thumbCenterY - windowCenterY,
    });

    setIsOpen(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setHighResLoaded(false);
      setHighResError(false);
    }
  };

  return (
    <>
      <Avatar
        className={cn("cursor-pointer", avatarClassName)}
        onClick={handleClick}
      >
        <AvatarImage
          src={song.thumbnailURL()}
          alt={"song illustration thumbnail"}
        />
      </Avatar>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTitle className="hidden">Illustration image view</DialogTitle>
        <DialogDescription className="hidden">Illustration</DialogDescription>

        <DialogContent
          animate={false}
          className="w-full max-w-[512px] rounded-lg backdrop-blur-sm p-0 avatar-modal-dialog overflow-hidden content-radix bg-glass/15 dark:bg-glass/50 gap-0 flex flex-col duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-5 data-[state=open]:zoom-in-5"
          style={{
            // Apply the dynamic calculation
            transformOrigin: `calc(50% + ${originOffset.x}px) calc(50% + ${originOffset.y}px)`,
          }}
          close={() => handleOpenChange(false)}
        >
          {/* The Safari-safe wrapper: No `h-full` or `h-fit` to prevent cyclic height dependency collapse */}
          <div className="w-full flex flex-col relative">
            {/* Aspect square with flex-shrink-0 protects the image proportions */}
            <div className="relative w-full aspect-square bg-black/20 overflow-hidden flex-shrink-0">
              {/* Permanent LQ Backdrop (no scale-110 so it matches perfectly) */}
              <img
                src={song.thumbnailURL()}
                className="absolute inset-0 w-full h-full object-contain blur-sm transform-gpu"
                alt="placeholder backdrop"
              />

              {/* HQ Image: Fades in seamlessly over the LQ backdrop */}
              {!highResError && (
                <img
                  src={song.illustrationURL()}
                  onLoad={() => setHighResLoaded(true)}
                  onError={() => setHighResError(true)}
                  className={cn(
                    "absolute inset-0 z-10 w-full h-full object-contain transition-opacity duration-300",
                    highResLoaded ? "opacity-100" : "opacity-0",
                  )}
                  alt="Song illustration"
                />
              )}
            </div>

            <IllustrationPrompt
              song={song}
              show={isOpen && Boolean(song.currentIllustration)}
              className="text-center text-white font-bold flex items-center justify-center h-[256px] [@media(max-height:1000px)]:h-[150px] [@media(max-height:800px)]:h-[100px] [@media(max-height:700px)]:hidden"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
