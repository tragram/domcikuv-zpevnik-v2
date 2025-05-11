import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const snippets = {
    chorus_env: {
        name: "Chorus",
        letter: "C",
        template: "{start_of_chorus}\n\n{end_of_chorus}\n\n",
        cursorOffset: 1 // Position after first \n\n
    },
    verse_env: {
        name: "Verse",
        letter: "V",
        template: "{start_of_verse}\n\n{end_of_verse}\n\n",
        cursorOffset: 1
    },
    bridge_env: {
        name: "Bridge",
        letter: "B",
        template: "{start_of_bridge}\n\n{end_of_bridge}\n\n",
        cursorOffset: 1
    },
    chorus_recall: {
        name: "Chorus",
        letter: "C",
        template: "{chorus}\n",
        cursorOffset: 1
    },
    verse_recall: {
        name: "Verse",
        letter: "V",
        template: "{verse}\n",
        cursorOffset: 0
    },
    bridge_recall: {
        name: "Bridge",
        letter: "B",
        template: "{bridge}\n",
        cursorOffset: 1
    },
    prepend_content: {
        name: "Variant: Prepend content",
        letter: "P",
        template: "{start_of_variant: prepend_content}\n\n{end_of_variant}",
        cursorOffset: 1
    },
    replace_first_line: {
        name: "Variant: Replace first line",
        letter: "F",
        template: "{start_of_variant: replace_first_line}\n\n{end_of_variant}",
        cursorOffset: 1
    },
    replace_last_line: {
        name: "Variant: Replace last line",
        letter: "L",
        template: "{start_of_variant: replace_last_line}\n\n{end_of_variant}",
        cursorOffset: 1
    },
    append_content: {
        name: "Variant: Append content",
        letter: "A",
        template: "{start_of_variant: append_content}\n\n{end_of_variant}",
        cursorOffset: 1
    },
    comment: {
        name: "Comment",
        letter: "CO",
        template: "{Comment: }\n",
        cursorOffset: -2
    },
    chords: {
        name: "Chord",
        letter: "CH",
        template: "[]",
        cursorOffset: -1
    }
};

export const SnippetButtonSection: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = "", children }) => {
    return (
        <div className={cn("flex flex-col grow justify-center border-primary bg-primary p-2", className)}>
            <div className="flex justify-center">
                {children}
            </div>
            <div className="text-center text-xs">{label}</div>
        </div>
    );
};


interface SnippetButtonProps {
    snippetKey: string;
    onInsert: (key: string) => void;
    className?: string;
}

export const SnippetButton: React.FC<SnippetButtonProps> = ({
    snippetKey,
    onInsert,
    className,
}) => {
    const snippet = snippets[snippetKey];
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={() => onInsert(snippetKey)}
                        className={cn("text-base py-1 px-2 text-white rounded-none !bg-transparent !hover:bg-primary/30", className)}
                    >
                        {snippet.letter}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{snippet.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};