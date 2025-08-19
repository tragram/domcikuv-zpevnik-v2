import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { clearCacheAndReload } from "./CustomError";
import { House, RotateCcw, UndoDot } from "lucide-react";

export function NotFound() {
  return (
    <div className="h-dvh w-dvw flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-center">
        404 Upsíků dupsíků!
        <br />
        Page not found!{" "}
      </h1>
      <div className="flex gap-2 items-center flex-wrap">
        <Button variant="outline" onClick={() => window.history.back()}>
          <UndoDot />
          Go back
        </Button>
        <Button variant="outline" onClick={clearCacheAndReload}>
          <RotateCcw />
          Clear Cache & Reload
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">
            <House />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
