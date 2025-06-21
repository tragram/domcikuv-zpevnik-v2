import { Button } from "~/components/ui/button";
import { SongData, type SongMetadata } from '~/types/songData';
import { Download } from "lucide-react";

type DownloadButtonProps = {
    metadata: SongMetadata;
    content: string;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ metadata, content }) => {
    // Function to handle the download
    const handleDownload = () => {
        const songData = new SongData(metadata);
        // remove trailing and starting spaces and multiple empty lines
        content = content
            .split('\n')
            .map(line => line.trim())
            .filter((line, index, arr) => line !== '' || arr[index - 1] !== '')
            .join('\n');
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
        <Button
            onClick={handleDownload}
            variant="default"
        >
            Download ChordPro
            <Download />
        </Button>
    )
}

export default DownloadButton;