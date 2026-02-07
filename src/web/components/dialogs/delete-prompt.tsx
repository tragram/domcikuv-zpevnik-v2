import { Button, buttonVariants } from "~/components/ui/button";
import { Trash2 } from "lucide-react";
import { VariantProps } from "class-variance-authority";
import ConfirmationDialog from "./confirmation-dialog";

type Props = {
  onDelete: () => void | Promise<void>;
  title: string;
  description: string;
  buttonText?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  disabled?: boolean;
  isLoading?: boolean;
};

/**
 * Delete confirmation dialog with a trash icon button.
 * This is a convenience wrapper around ConfirmationDialog.
 *
 * @example
 * ```tsx
 * <DeletePrompt
 *   onDelete={() => deleteUser(userId)}
 *   title="Delete User"
 *   description="This action cannot be undone."
 *   variant="destructive"
 * />
 * ```
 */
const DeletePrompt = ({
  onDelete,
  title,
  description,
  buttonText,
  variant = "destructive",
  size = "icon",
  disabled,
  isLoading,
}: Props) => {
  return (
    <ConfirmationDialog
      trigger={
        <Button variant={variant} size={size} disabled={disabled || isLoading}>
          {buttonText ? buttonText : <Trash2 />}
        </Button>
      }
      title={title}
      description={description}
      confirmText="Continue"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={onDelete}
      isLoading={isLoading}
    />
  );
};

export default DeletePrompt;
