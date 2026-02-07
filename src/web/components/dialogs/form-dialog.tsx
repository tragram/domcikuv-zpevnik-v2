import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "~/components/ui/dialog";

export interface FormDialogProps {
  /** The trigger element (usually a button) */
  trigger: ReactNode;
  /** Dialog title */
  title: string;
  /** Optional dialog description */
  description?: string;
  /** The form content to display */
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
 * Reusable form dialog component for displaying forms in a modal.
 * 
 * @example
 * ```tsx
 * <FormDialog
 *   trigger={<Button>Edit User</Button>}
 *   title="Edit User Information"
 *   description="Update the user's details below"
 *   maxWidth="2xl"
 * >
 *   <UserForm user={user} onSave={handleSave} />
 * </FormDialog>
 * ```
 */
function FormDialog({
  trigger,
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  className,
  maxWidth = "2xl",
}: FormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className={`${maxWidthClasses[maxWidth]} ${className || ""}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export default FormDialog;