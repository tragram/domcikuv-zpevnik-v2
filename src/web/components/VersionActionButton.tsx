import type { ComponentProps } from "react";
import { Button } from "./ui/button";

// Neutral version-management actions share one appearance across all screens.
export function VersionActionButton(
  props: Omit<ComponentProps<typeof Button>, "variant" | "size">,
) {
  return <Button {...props} variant="outline" size="sm" />;
}
