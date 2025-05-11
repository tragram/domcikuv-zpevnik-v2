import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const snippets = {
    chorus_env: {
        name: "Chorus",
        letter: "C",
        template: (selection: string = "\n") => `{start_of_chorus}\n${selection}{end_of_chorus}\n\n`,
        cursorOffset: 1 // Position after first \n\n
    },
    verse_env: {
        name: "Verse",
        letter: "V",
        template: (selection: string = "\n") => `{start_of_verse}\n${selection}{end_of_verse}\n\n`,
        cursorOffset: 1
    },
    bridge_env: {
        name: "Bridge",
        letter: "B",
        template: (selection: string = "\n") => `{start_of_bridge}\n${selection}{end_of_bridge}\n\n`,
        cursorOffset: 1
    },
    chorus_recall: {
        name: "Chorus",
        letter: "C",
        template: (selection: string = "\n") => `{chorus}\n`,
        cursorOffset: 1
    },
    verse_recall: {
        name: "Verse",
        letter: "V",
        template: (selection: string = "\n") => `{verse}\n`,
        cursorOffset: 0
    },
    bridge_recall: {
        name: "Bridge",
        letter: "B",
        template: (selection: string = "\n") => `{bridge}\n`,
        cursorOffset: 1
    },
    prepend_content: {
        name: "Variant: Prepend content",
        letter: "P",
        template: (selection: string = "\n") => `{start_of_variant: prepend_content}\n${selection}{end_of_variant}`,
        cursorOffset: 1
    },
    replace_first_line: {
        name: "Variant: Replace first line",
        letter: "F",
        template: (selection: string = "\n") => `{start_of_variant: replace_first_line}\n${selection}{end_of_variant}`,
        cursorOffset: 1
    },
    replace_last_line: {
        name: "Variant: Replace last line",
        letter: "L",
        template: (selection: string = "\n") => `{start_of_variant: replace_last_line}\n${selection}{end_of_variant}`,
        cursorOffset: 1
    },
    append_content: {
        name: "Variant: Append content",
        letter: "A",
        template: (selection: string = "\n") => `{start_of_variant: append_content}\n${selection}{end_of_variant}`,
        cursorOffset: 1
    },
    comment: {
        name: "Comment",
        letter: "CO",
        template: (selection: string = "\n") => `{Comment: ${selection}}\n`,
        cursorOffset: -2
    },
    chords: {
        name: "Chord",
        letter: "CH",
        template: (selection: string = "\n") => `[${selection}]`,
        cursorOffset: -1
    }
};

export const SnippetButtonSection: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = "", children }) => {
    return (
        <div className={cn("flex flex-col grow justify-center border-primary bg-primary p-2", className)}>
            <div className="flex justify-center">
                {children}
            </div>
            <div className="text-center font-medium text-white text-xs">{label}</div>
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
                    <button
                        onClick={() => onInsert(snippetKey)}
                        className={cn("text-base font-semibold py-1 px-2 text-white rounded-md hover:bg-background", className)}
                    >
                        {snippet.letter}
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{snippet.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};