import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export interface PreviewDialogProps {
  /** The trigger element (usually an image or button) */
  trigger?: ReactNode;
  /** Dialog title */
  title?: string;
  /** The content to display (e.g., image, text, etc.) */
  children: ReactNode;
  /** Controlled open state (optional) */
  open?: boolean;
  /** Controlled open state change handler (optional) */
  onOpenChange?: (open: boolean) => void;
  /** Custom class name for the dialog content */
  className?: string;
  /** Custom max width for the dialog */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-full",
};

/**
 * Reusable preview dialog component for displaying images or content in a modal.
 * Can be used in controlled or uncontrolled mode.
 * 
 * @example
 * Uncontrolled with trigger:
 * ```tsx
 * <PreviewDialog
 *   trigger={<img src={thumbnail} alt="Preview" />}
 *   title="Image Preview"
 *   maxWidth="4xl"
 * >
 *   <img src={fullImage} alt="Full size" className="w-full" />
 * </PreviewDialog>
 * ```
 * 
 * @example
 * Controlled without trigger:
 * ```tsx
 * <PreviewDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Image Preview"
 * >
 *   <img src={previewImage} alt="Preview" />
 * </PreviewDialog>
 * ```
 */
function PreviewDialog({
  trigger,
  title,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  className,
  maxWidth = "4xl",
}: PreviewDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className={`${maxWidthClasses[maxWidth]} ${className || ""}`}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
export default PreviewDialog;