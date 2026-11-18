import { expect, it } from "vitest";
import { cn } from "./utils";

it("keeps the custom tiny font size alongside a text color", () => {
  expect(cn("text-tiny text-muted-foreground")).toBe("text-tiny text-muted-foreground");
  expect(cn("text-tiny text-muted-foreground", "text-sm")).toBe("text-muted-foreground text-sm");
});
