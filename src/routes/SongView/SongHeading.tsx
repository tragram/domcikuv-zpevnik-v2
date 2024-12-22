import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

function SongHeading({ songData, layoutSettings, transposeSteps }) {

    function formatChords(data) {
        return data.split(/(\d|[#b])/).map((part, index) => {
            if (/\d/.test(part)) {
                return <sub key={index}>{part}</sub>; // Render numbers as superscripts
            } else if (/[#b]/.test(part)) {
                return <sup key={index}>{part}</sup>; // Render # or b as superscripts
            }
            return part; // Render other parts as plain text
        });
    }
    const containerRef = useRef(null);
    const [wrappedIndices, setWrappedIndices] = useState([]);

    const detectWrapping = () => {
        if (!containerRef.current) return;

        const children = Array.from(containerRef.current.children);
        const newWrappedIndices = [];

        children.forEach((child, index) => {
            const currentTop = child.offsetTop;

            // Compare the current child's top position with the first child's top position
            if (index > 0 && currentTop > children[0].offsetTop) {
                newWrappedIndices.push(index);
            }
        });
        setWrappedIndices(newWrappedIndices);
    };

    useEffect(() => {
        // Initial detection
        detectWrapping();

        // Detect wrapping on window resize
        const handleResize = () => detectWrapping();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        detectWrapping();
    }, [layoutSettings]);

    const isWrapped = wrappedIndices.length > 0;

    return (
        <div className={cn('flex w-full justify-between flex-wrap gap-4', isWrapped ? "" : "")} ref={containerRef}>
            {layoutSettings.fitScreenMode === "fitXY" || layoutSettings.twoColumns ?
                <h1 className='self-center font-bold text-wrap mb-2'>{songData.artist}: {songData.title}</h1>
                :
                <div className={cn('flex flex-col flex-grow', isWrapped ? "text-center" : "justify-start mb-4")}>
                    <h2 className='font-semibold text-white/80 text-wrap uppercase'>{songData.artist}</h2>
                    <h2 className='font-bold text-wrap'>{songData.title}</h2>
                </div>}
            <div className={cn('flex flex-col flex-grow', isWrapped ? "text-center mb-4" : "text-right")}>
                <h2 className='text-[0.75em] text-white/70 text-nowrap'>Capo: {(songData.capo - transposeSteps + 12) % 12}</h2>
                <h2 className='text-[0.75em] text-white/70 sub-sup-container'>{formatChords(songData.range.toString(transposeSteps))}</h2>
            </div>
        </div>
    )
}

export default SongHeading;