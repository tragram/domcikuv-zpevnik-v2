import { cn } from "@/lib/utils";
import { SongData } from "@/types/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LayoutSettings } from "../hooks/viewSettingsStore";


interface SongHeadingProps {
    songData: SongData;
    layoutSettings: LayoutSettings;
    transposeSteps: number;
}

function formatChords(data: string) {
    return data.split(/(\d|[#b])/).map((part, index) => {
        if (/\d/.test(part)) {
            return <sub key={index}>{part}</sub>; // Render numbers as superscripts
        } else if (/[#b]/.test(part)) {
            return <sup key={index}>{part}</sup>; // Render # or b as superscripts
        }
        return part; // Render other parts as plain text
    });
}

const SongHeading: React.FC<SongHeadingProps> = ({ songData, layoutSettings, transposeSteps }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [wrappedIndices, setWrappedIndices] = useState<number[]>([]);

    const detectWrapping = () => {
        if (!containerRef.current) return;

        const children = Array.from(containerRef.current.children);
        const newWrappedIndices: number[] = [];

        children.forEach((child, index) => {
            const currentTop = (child as HTMLElement).offsetTop;
            if (index > 0 && currentTop > (children[0] as HTMLElement).offsetTop) {
                newWrappedIndices.push(index);
            }
        });
        setWrappedIndices(newWrappedIndices);
    };

    useEffect(() => {
        detectWrapping();

        const handleResize = () => detectWrapping();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useLayoutEffect(() => {
        detectWrapping();
    }, [layoutSettings]);

    const isWrapped = wrappedIndices.length > 0;

    return (
        <div className={cn('flex w-full justify-between flex-wrap gap-4 text-primary dark:text-white')} ref={containerRef}>
            {/* {layoutSettings.fitScreenMode === "fitXY" || layoutSettings.twoColumns ? (
                <h1 className='self-center font-bold text-wrap mb-2'>
                    {songData.artist}: {songData.title}
                </h1>
            ) : (
                <div className={cn('flex flex-col flex-grow', isWrapped ? "text-center" : "justify-start mb-4")}>
                    <h2 className='font-semibold text-primary text-wrap uppercase  dark:text-foreground'>{songData.artist}</h2>
                    <h2 className='font-bold text-wrap  dark:text-white'>{songData.title}</h2>
                </div>
            )} */}
            <div className={cn('flex flex-col flex-grow', isWrapped ? "text-center" : "justify-start mb-4")}>
                <h2 className='font-semibold text-primary text-wrap uppercase  dark:text-foreground'>{songData.artist}</h2>
                <h2 className='font-bold text-wrap  dark:text-white'>{songData.title}</h2>
            </div>
            <div className={cn('flex flex-col flex-grow text-muted-foreground dark:text-white/70 ', isWrapped ? "text-center mb-4" : "text-right")}>
                <h2 className='text-[0.75em] text-nowrap'>
                    Capo: {(songData.capo - transposeSteps + 12) % 12}
                </h2>
                <h2 className='text-[0.75em] sub-sup-container'>
                    {formatChords(songData.range.toString(transposeSteps))}
                </h2>
            </div>
        </div>
    );
};

export default SongHeading;