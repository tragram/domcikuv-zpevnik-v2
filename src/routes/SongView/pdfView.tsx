interface PdfViewProps {
    pdfFilenames: string[];
}

const PdfView: React.FC<PdfViewProps> = ({ pdfFilenames }) => {
    // The last PDF is the smallest filesize (they are ordered as scan > compressed > gen (if it exists))
    return <iframe src={pdfFilenames.slice(-1)[0]} className='w-screen h-screen' />;
};

export default PdfView;