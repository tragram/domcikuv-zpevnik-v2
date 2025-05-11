import { fileURL } from "@/components/song_loader";
import { Button } from "@/components/ui/button";
import { SongData } from "@/types/types";
import { Download } from "lucide-react";



type DownloadButtonProps = {
    metadata;
    content;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ metadata, content }) => {

    // Function to generate ChordPro content with metadata
    const generateChordProContent = () => {
        // Create the metadata preamble
        const preamble = [];
        const listToChordpro = (list: string) => {
            return '["' + list.split(",").map(l => l.trim()).join('", "') + '"]'
        }

        if (metadata.title) {
            preamble.push(`{title: ${metadata.title}}`);
        }

        if (metadata.artist) {
            preamble.push(`{artist: ${metadata.artist}}`);
        }

        if (metadata.key) {
            preamble.push(`{key: ${metadata.key}}`);
        }

        if (metadata.capo) {
            preamble.push(`{capo: ${metadata.capo}}`);
        }

        if (metadata.tempo) {
            preamble.push(`{tempo: ${metadata.tempo}}`);
        }

        if (metadata.language) {
            preamble.push(`{language: ${metadata.language}}`);
        }

        if (metadata.pdfFilenames) {
            preamble.push(`{pdf_filenames: ${listToChordpro(metadata.pdfFilenames).replace(new RegExp(fileURL("songs/pdfs/"), "g"), "")}}`);
        }

        if (metadata.range) {
            preamble.push(`{range: ${metadata.range.replace(/ /g, "")}}`);
        }

        try {
            if (metadata.songbooks) {
                preamble.push(`{songbooks: ${listToChordpro(metadata.songbooks)}}`);
            }
        } catch (e) {
            // If parsing fails, just add as is
            if (metadata.songbooks) {
                preamble.push(`{songbooks: ${metadata.songbooks}}`);
            }
        }

        if (metadata.startMelody) {
            preamble.push(`{start_melody: ${metadata.startMelody}}`);
        }

        if (metadata.dateAdded) {
            preamble.push(`{date_added: ${metadata.dateAdded}}`);
        }

        // Combine metadata and content
        return preamble.join('\n') + '\n\n' + content;
    };

    // Function to handle the download
    const handleDownload = () => {
        const content = generateChordProContent();
        const filename = `${SongData.id(metadata.title, metadata.artist) || 'song'}.pro`;

        // Create a blob and download it
        const blob = new Blob([content], { type: 'text/plain' });
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
                <Download/>
                Download ChordPro
            </Button>
        </div>
    )
}

export default DownloadButton;