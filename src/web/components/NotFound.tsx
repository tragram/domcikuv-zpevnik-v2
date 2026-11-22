import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { House } from "lucide-react";

export function NotFound() {
  return (
    <div className="h-dvh w-dvw flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-center">We couldn’t find this page</h1>
      <Button asChild>
        <Link to="/">
          <House />
          Back to songbook
        </Link>
      </Button>
    </div>
  );
}
