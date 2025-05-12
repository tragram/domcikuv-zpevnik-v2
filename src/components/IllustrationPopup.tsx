

import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog-custom"
import { cn } from "@/lib/utils"
import { SongData } from "@/types/songData"
import { useState } from "react"
import { IllustrationPrompt } from "./IllustrationPrompt"

interface IllustrationPopupProps {
  avatarClassName: string
  song: SongData
}

export function IllustrationPopup({ avatarClassName, song }: IllustrationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Avatar className={cn("cursor-pointer", avatarClassName)} onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}>
        <AvatarImage src={song.thumbnailURL()} alt={"song illustration thumbnail"} />
      </Avatar>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTitle className="hidden">Illustration image view</DialogTitle>
        {/* DialogDescription is here just so that accessibility does not complain */}
        <DialogDescription className="hidden">Illustration</DialogDescription>
        <DialogContent className="max-w-[512px] max-h-[calc(100vh)] h-fit rounded-lg backdrop-blur-sm p-0 avatar-modal-dialog overflow-clip content-radix bg-glass/50 gap-0 flex flex-col"
         /* @ts-expect-error "removing this breaks it"*/ 
         close={() => setIsOpen(false)}
        >

          <div className="h-full w-full relative">
            <div className="relative flex justify-center max-h-[512px] h-[70%] shadow-lg">
              <img
                style={{ backgroundImage: `url(${song.thumbnailURL()})`, backgroundRepeat: "no-repeat", backgroundSize: "cover" }}
                src={song.illustrationURL()}
                loading="lazy"
                width={512}
                height={512}
                className="object-scale-down z-50"
              />
            </div>
            <IllustrationPrompt song={song} show={isOpen} className={"text-center text-white font-bold !items-center  h-[256px] [@media(max-height:1000px)]:h-[150px] [@media(max-height:800px)]:h-[100px] [@media(max-height:700px)]:!hidden"} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
