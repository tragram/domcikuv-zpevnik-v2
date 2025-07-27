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

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  }, []);

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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTitle className="hidden">Illustration image view</DialogTitle>
        {/* DialogDescription is here just so that accessibility does not complain */}
        <DialogDescription className="hidden">Illustration</DialogDescription>
        <DialogContent
          animate={false}
          className="max-w-[512px] max-h-[calc(100vh)] h-fit rounded-lg backdrop-blur-sm p-0 avatar-modal-dialog overflow-clip content-radix bg-glass/15 dark:bg-glass/50 gap-0 flex flex-col 
          
          duration-300 

          data-[state=open]:animate-in 
          data-[state=closed]:animate-out 

          data-[state=closed]:fade-out-0 
          data-[state=open]:fade-in-0 

          data-[state=closed]:zoom-out-5 
          data-[state=open]:zoom-in-5 
          
          data-[state=closed]:slide-out-to-right-[-50%] 
          data-[state=open]:slide-in-from-right-[-50%]"
          close={() => setIsOpen(false)}
        >
          <div className="h-full w-full relative">
            <div className="relative flex justify-center max-h-[512px] h-[70%] shadow-lg ">
              <img
                style={{
                  backgroundImage: `url(${song.thumbnailURL()})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                }}
                src={song.illustrationURL()}
                loading="lazy"
                width={512}
                height={512}
                className="object-scale-down z-50"
                alt="Song illustration"
              />
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
