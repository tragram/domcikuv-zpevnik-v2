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
import { LanguageCount, SongLanguage } from "@/types/types";
import { Languages } from "lucide-react";

export const RARE_LANGUAGE_THRESHOLD = 3

interface LanguageChoice {
    text: string;
    value: SongLanguage;
}

interface LanguageFilterProps {
    languages: LanguageCount;
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
    languages: LanguageCount,
    selectedLanguage: SongLanguage,
    setSelectedLanguage: (language: SongLanguage) => void
): JSX.Element[] => {
    // Filter languages with count >= RARE_LANGUAGE_THRESHOLD
    const commonLanguages = Object.entries(languages)
        .filter(([_, count]) => count >= RARE_LANGUAGE_THRESHOLD)
        .map(([language]) => ({
            text: capitalizeFirstLetter(language),
            value: language as SongLanguage
        }));

    // Create an "Other" option that includes all languages with count < RARE_LANGUAGE_THRESHOLD
    const rareLanguages = Object.entries(languages)
        .filter(([_, count]) => count < RARE_LANGUAGE_THRESHOLD)
        .map(([language]) => language);
    // Create final language choices array
    const languageChoices: LanguageChoice[] = commonLanguages;

    // Sort alphabetically
    languageChoices.sort((a, b) => a.text.localeCompare(b.text));

    // Add "All" at the beginning
    languageChoices.unshift({ text: "All", value: "all" });

    // Add "Other" option if there are any rare languages
    if (rareLanguages.length > 0) {
        languageChoices.push({ text: "Other", value: "other" });
    }

    return languageChoices.map((choice) => (
        <DropdownMenuCheckboxItem
            key={choice.value}
            onSelect={(e) => e.preventDefault()}
            checked={selectedLanguage === choice.value}
            onClick={() => setSelectedLanguage(choice.value)}
        >
            <DropdownIconStart icon={<LanguageFlag language={choice.value} />} />
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
    const active = selectedLanguage !== "all";

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
    languages: LanguageCount,
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