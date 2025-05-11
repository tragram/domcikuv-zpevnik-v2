import { Button } from "@/components/ui/button";
import { SongData, SongMetadata } from '@/types/songData';
import { Download } from "lucide-react";

type DownloadButtonProps = {
    metadata: SongMetadata;
    content: string;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ metadata, content }) => {
    // Function to handle the download
    const handleDownload = () => {
        const songData = new SongData(metadata);
        songData.content = content;
        const filename = `${songData.id || 'song'}.pro`;
        const chordProContent = songData.toChordpro();

        // Create a blob and download it
        const blob = new Blob([chordProContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
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
        <div className="flex justify-end">
            <Button
                onClick={handleDownload}
                variant="default"
                className="border-primary/30 border-2"
            >
                <Download />
                Download ChordPro
            </Button>
        </div>
    )
}

export default DownloadButton;