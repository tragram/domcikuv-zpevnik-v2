
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog-custom"
import { X } from 'lucide-react'
import { Button } from "./button"

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
        <DialogContent className="max-w-[512px] max-h-[512px] bg-transparent backdrop-blur-sm p-0 avatar-modal-dialog overflow-clip">
          <div className="relative flex justify-center ">
            <DialogClose asChild>
              <Button variant="circular" size="icon"
              onClick={e=>e.stopPropagation()}
                className="absolute top-4 right-4 p-2"
                aria-label="Close full screen image"
              >
                <X className="h-6 w-6" />
              </Button>

            </DialogClose>
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
