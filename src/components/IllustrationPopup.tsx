

import { useState, useCallback, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog-custom"
import { Instagram, X } from 'lucide-react'
import { Button } from "./ui/button"
import { Description } from "@radix-ui/react-dialog"
import { IllustrationPrompt } from "./IllustrationPrompt"
import { SongData } from "@/types/types"

interface IllustrationPopupProps {
  avatarClassName: string
  song: SongData
}

export function IllustrationPopup({ avatarClassName, song }: IllustrationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Avatar className={"cursor-pointer " + avatarClassName} onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}>
        <AvatarImage src={song.thumbnailURL()} alt={"song illustration thumbnail"} />
        {/* <AvatarFallback><Instagram></AvatarFallback> */}
      </Avatar>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTitle className="hidden">Illustration image view</DialogTitle>
        {/* DialogDescription is here just so that accessibility does not complain */}
        <DialogDescription className="hidden">Illustration</DialogDescription>
        <DialogContent className=" max-w-[512px] max-h-[calc(100vh)] h-fit rounded-lg backdrop-blur-sm p-0 avatar-modal-dialog overflow-clip content-radix bg-glass/50 gap-0 flex flex-col"
          close={() => setIsOpen(false)}
        >
          <div className="relative flex justify-center max-h-[512px] shadow-lg">
            <img
              style={{ backgroundImage: `url(${song.thumbnailURL()})`, backgroundRepeat: "no-repeat", backgroundSize: "cover" }}
              src={song.illustrationURL()}
              width={512}
              height={512}
              className="object-scale-down z-50"
            />
          </div>
          <IllustrationPrompt song={song} show={isOpen} className={"text-center text-white font-bold !items-center min-h-32 max-h-48 [@media(max-height:600px)]:!hidden"} />
        </DialogContent>
      </Dialog>
    </>
  )
}
