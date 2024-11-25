

import { useState, useCallback, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog-custom"
import { X } from 'lucide-react'
import { Button } from "./button"
import { Description } from "@radix-ui/react-dialog"

interface AvatarWithModalProps {
  avatarClassName: string
  src: string
  fallback: string
  alt: string
  fullSrc: string
}

export function AvatarWithModal({ avatarClassName, src, fallback, alt, fullSrc }: AvatarWithModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Avatar className={"cursor-pointer " + avatarClassName} onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}>
        <AvatarImage src={src} alt={alt} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTitle className="hidden">Illustration image view</DialogTitle>
          <DialogContent className="max-w-[512px] max-h-[512px] bg-transparent backdrop-blur-sm p-0 avatar-modal-dialog overflow-clip content-radix"
            aria-describedby="Illustration"
            close={()=>setIsOpen(false)}
            >
            <div className="relative flex justify-center ">
              <img
                src={fullSrc}
                alt={alt}
                className="object-scale-down "
              />
            </div>
          </DialogContent>
      </Dialog>
    </>
  )
}
