import LanguageFlag from "@/components/LanguageFlag";
import { Button } from "@/components/ui/button";
import {
    DropdownIconStart,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";

export type SongLanguage = string;

interface LanguageChoice {
    text: string;
    value: string;
}

interface LanguageFilterProps {
    languages: SongLanguage[];
    selectedLanguage: SongLanguage;
    setSelectedLanguage: (language: SongLanguage) => void;
    iconOnly: boolean;
}

const capitalizeFirstLetter = (str: string): string => {
    if (!str) return '';

    const firstCodePoint = str.codePointAt(0);
    if (!firstCodePoint) return str;

    const index = firstCodePoint > 0xFFFF ? 2 : 1;
    return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
};

const createLanguageChoices = (
    languages: SongLanguage[],
    selectedLanguage: SongLanguage,
    setSelectedLanguage: (language: SongLanguage) => void
): JSX.Element[] => {
    const languageChoices: LanguageChoice[] = Object.keys(languages)
        .map((language) => ({
            text: capitalizeFirstLetter(language),
            value: language
        }));

    languageChoices.unshift({ text: "All", value: "all" });

    return languageChoices.map((choice) => (
        <DropdownMenuCheckboxItem
            key={choice.value}
            onSelect={(e) => e.preventDefault()}
            checked={selectedLanguage === choice.value}
            onClick={() => setSelectedLanguage(choice.value)}
        >
            <DropdownIconStart icon={<LanguageFlag language={choice.text} />} />
            {choice.text}
        </DropdownMenuCheckboxItem>
    ));
};

export const LanguageFilter = ({
    languages,
    selectedLanguage,
    setSelectedLanguage,
    iconOnly
}: LanguageFilterProps): JSX.Element => {
    const active = selectedLanguage === "all";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="circular"
                    isActive={active}
                    className="outline-0 rounded-r-none font-bold"
                >
                    <Languages />
                    {!iconOnly && "Languages"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Language Choices" sideOffset={15}>
                {createLanguageChoices(languages, selectedLanguage, setSelectedLanguage)}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export const LanguageFilterDropdownSection = (
    languages: SongLanguage[],
    selectedLanguage: SongLanguage,
    setSelectedLanguage: (language: SongLanguage) => void
): JSX.Element => {
    return (
        <>
            <DropdownMenuLabel>Select languages</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {createLanguageChoices(languages, selectedLanguage, setSelectedLanguage)}
        </>
    );
};