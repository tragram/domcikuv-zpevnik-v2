import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Button, buttonVariants } from '~/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { VariantProps } from 'class-variance-authority';

type Props = {
  onDelete: () => void;
  title: string;
  description: string;
  buttonText?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  disabled?: boolean;
};

export const DeletePrompt = ({
  onDelete,
  title,
  description,
  buttonText,
  variant = "destructive",
  size = "icon",
  disabled,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setIsOpen(true)}
        size={size}
        disabled={disabled}
      >
        {buttonText ? buttonText : <Trash2 />}
      </Button>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={disabled}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
