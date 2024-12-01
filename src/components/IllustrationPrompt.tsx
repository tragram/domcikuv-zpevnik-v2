import { useEffect, useState } from "react";
import { fetchIllustrationPrompt } from "./song_loader";
import { AutoTextSize } from "auto-text-size";
import { cn } from "@/lib/utils";

export function IllustrationPrompt({ song, show, className }) {
    const [promptContent, setPromptContent] = useState(null);

    useEffect(() => {
        const fetchPrompt = async () => {
            const promptContent = await fetchIllustrationPrompt(song.id);
            // console.log(promptContent)
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