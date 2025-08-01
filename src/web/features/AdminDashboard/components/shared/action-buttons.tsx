import { cn } from "~/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export const ActionButtons = ({ children, className }: Props) => {
  return <div className={cn("flex gap-1", className)}>{children}</div>;
};
