import {
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { type SongMetadata } from "~/types/songData";
import { editorToChordPro } from "./utils";
type PullRequestButtonProps = {
  metadata: SongMetadata;
  content: string;
};

const PullRequestButton: React.FC<PullRequestButtonProps> = ({
  metadata,
  content,
}) => {
  const loggedIn = useRouteContext({ from: "__root__" }).userData.loggedIn;
  const navigate = useNavigate();
  const location = useLocation();
  const handleLoginRedirect = () => {
    navigate({
      to: "/login",
      search: {
        redirect: location.pathname,
      },
    });
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const { title, artist, chordProContent } = editorToChordPro(
      metadata,
      content
    );

    const res = await fetch("/api/editor/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        artist,
        content: chordProContent,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      toast.success("Pull request created!", {
        action: {
          label: "View it on GitHub",
          onClick: () => window.open(data.prUrl, "_blank"),
        },
      });
    } else toast.error(data.error || "Submission failed");
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !loggedIn}
                variant="default"
              >
                {isSubmitting ? "Submitting..." : "Submit song (pull request)"}
                <CloudUpload className="h-4 w-4" />
              </Button>
            </div>
          </TooltipTrigger>
          {!loggedIn && (
            <TooltipContent>
              <p>
                Please{" "}
                <button onClick={handleLoginRedirect} className="underline">
                  log in
                </button>{" "}
                to submit songs
              </p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default PullRequestButton;
