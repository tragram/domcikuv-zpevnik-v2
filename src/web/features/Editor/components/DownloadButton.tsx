import { Button } from "~/components/ui/button";
import { Download } from "lucide-react";
import { editorToChordPro } from "./utils";
import { useEffect, useCallback } from "react";
import { EditorState } from "../Editor";
import { SongData } from "~/types/songData";

type DownloadButtonProps = {
  editorState: EditorState;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ editorState }) => {
  // Function to handle the download
  const handleDownload = useCallback(() => {
    const songData = SongData.fromEditor(editorState);
    // Create a blob and download it
    const blob = new Blob([songData.toChordpro()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const filename =
      editorState.title && editorState.artist
        ? SongData.baseId(editorState.title, editorState.artist) + ".pro"
        : "artist-title.pro";
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
  }, [editorState]);

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
    <Button onClick={handleDownload} variant="default" className="bg-transparent">
      Download ChordPro
      <Download />
    </Button>
  );
};

export default DownloadButton;
