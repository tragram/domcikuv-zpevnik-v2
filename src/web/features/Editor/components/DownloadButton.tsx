import { Button } from "~/components/ui/button";
import { type SongMetadata } from "~/types/songData";
import { Download } from "lucide-react";
import { editorToChordPro } from "./utils";
import { useEffect, useCallback } from "react";

type DownloadButtonProps = {
  metadata: SongMetadata;
  content: string;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({
  metadata,
  content,
}) => {
  // Function to handle the download
  const handleDownload = useCallback(() => {
    const { filename, chordProContent } = editorToChordPro(metadata, content);
    // Create a blob and download it
    const blob = new Blob([chordProContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }, [metadata, content]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        // Prevent the Save dialog to open
        e.preventDefault();
        // download
        handleDownload();
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDownload]);

  return (
    <Button onClick={handleDownload} variant="default">
      Download ChordPro
      <Download />
    </Button>
  );
};

export default DownloadButton;