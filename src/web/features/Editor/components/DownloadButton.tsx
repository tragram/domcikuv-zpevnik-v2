import { Button } from "~/components/ui/button";
import { type SongMetadata } from "~/types/songData";
import { Download } from "lucide-react";
import { editorToChordPro } from "./utils";

type DownloadButtonProps = {
  metadata: SongMetadata;
  content: string;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({
  metadata,
  content,
}) => {
  // Function to handle the download
  const handleDownload = () => {
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
  };
  return (
    <Button onClick={handleDownload} variant="default">
      Download ChordPro
      <Download />
    </Button>
  );
};

export default DownloadButton;
