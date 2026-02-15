import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export const snippets = {
    chorus_env: {
        name: "Chorus",
        letter: "C",
        template: (selection?: string) => `{start_of_chorus}\n${selection}\n{end_of_chorus}\n\n`,
        cursorOffset: "{start_of_chorus}\n".length
    },
    verse_env: {
        name: "Verse",
        letter: "V",
        template: (selection?: string) => `{start_of_verse}\n${selection}\n{end_of_verse}\n\n`,
        cursorOffset: "{start_of_verse}\n".length
    },
    bridge_env: {
        name: "Bridge",
        letter: "B",
        template: (selection?: string) => `{start_of_bridge}\n${selection}\n{end_of_bridge}\n\n`,
        cursorOffset: "{start_of_bridge}".length
    },
    tab_env: {
        name: "Tabs",
        letter: "T",
        template: (selection?: string) => `{start_of_tab}\n${selection}\n{end_of_tab}\n\n`,
        cursorOffset: "{start_of_tab}".length
    },
    chorus_recall: {
        name: "Chorus",
        letter: "C",
        template: (selection?: string) => `{chorus}\n`,
        cursorOffset: "{chorus}\n".length
    },
    verse_recall: {
        name: "Verse",
        letter: "V",
        template: (selection?: string) => `{verse}\n`,
        cursorOffset: "{verse}\n".length
    },
    bridge_recall: {
        name: "Bridge",
        letter: "B",
        template: (selection?: string) => `{bridge}\n`,
        cursorOffset: "{bridge}\n".length
    },
    prepend_content: {
        name: "Variant: Prepend content",
        letter: "P",
        template: (selection?: string) => `{start_of_variant: prepend_content}\n${selection}\n{end_of_variant}`,
        cursorOffset: "{start_of_variant: prepend_content}\n".length
    },
    replace_first_line: {
        name: "Variant: Replace first line",
        letter: "F",
        template: (selection?: string) => `{start_of_variant: replace_first_line}\n${selection}\n{end_of_variant}`,
        cursorOffset: "{start_of_variant: replace_first_line}\n".length
    },
    replace_last_line: {
        name: "Variant: Replace last line",
        letter: "L",
        template: (selection?: string) => `{start_of_variant: replace_last_line}\n${selection}{end_of_variant}`,
        cursorOffset: "{start_of_variant: replace_last_line}\n".length
    },
    append_content: {
        name: "Variant: Append content",
        letter: "A",
        template: (selection?: string) => `{start_of_variant: append_content}\n${selection}{end_of_variant}`,
        cursorOffset: "{start_of_variant: append_content}\n".length
    },
    comment: {
        name: "Comment",
        letter: "CO",
        template: (selection?: string) => `{comment: ${selection}}\n`,
        cursorOffset: "{comment: ".length
    },
    chords: {
        name: "Chord",
        letter: "CH",
        template: (selection?: string) => `[${selection}]`,
        cursorOffset: 1
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
                        className={cn("text-base font-semibold py-1 px-2 text-white rounded-md hover:bg-background grow max-w-16", className)}
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