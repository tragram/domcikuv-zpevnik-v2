import { useEffect, useState } from "react";
import { AutoTextSize } from "auto-text-size";
import { cn } from "@/lib/utils";
import { fetchIllustrationPrompt } from "@/lib/songLoader";

export function IllustrationPrompt({ song, show, className }) {
    const [promptContent, setPromptContent] = useState(null);

    useEffect(() => {
        const fetchPrompt = async () => {
            const promptContent = await fetchIllustrationPrompt(song.id);
            setPromptContent(promptContent[0].response);
        }
        if (show && !promptContent) { fetchPrompt(); }
    }, [show]);
    return (
        <div className={cn('px-4 flex flex-grow my-4 w-full ', className)}>
            <AutoTextSize mode="boxoneline">
                <p className='text-wrap w-full text-shadow'>{promptContent}</p>
            </AutoTextSize>
        </div>
    )
}