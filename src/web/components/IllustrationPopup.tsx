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

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state so the next song starts fresh
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
          className="w-full max-w-[512px] max-h-[100vh] h-fit rounded-lg backdrop-blur-sm p-0 avatar-modal-dialog overflow-hidden content-radix bg-glass/15 dark:bg-glass/50 gap-0 flex flex-col duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-5 data-[state=open]:zoom-in-5 data-[state=closed]:slide-out-to-right-[-50%] data-[state=open]:slide-in-from-right-[-50%]"
          close={() => handleOpenChange(false)}
        >
          <div className="h-full w-full relative">
            {/* Strict relative container for Safari compatibility */}
            <div className="relative w-full max-h-[512px] aspect-square shadow-lg overflow-hidden bg-black/20">
              {/* Permanent LQ Backdrop */}
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
              className="text-center text-white font-bold !items-center h-[256px] [@media(max-height:1000px)]:h-[150px] [@media(max-height:800px)]:h-[100px] [@media(max-height:700px)]:!hidden"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
