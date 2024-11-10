import LanguageFlag from "@/components/LanguageFlag";
import { Button } from "@/components/ui/button";
import { SongLanguage } from "@/types";
import { Languages } from "lucide-react";
import {
    DropdownIconStart,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { activeClass, inactiveClass } from "./Filters";

function languageChoices(languages: Array<SongLanguage>, selectedLanguage: SongLanguage, setSelectedLanguage) {
    function capitalizeFirstLetter(str: string) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
    }
    const language_choices = Object.keys(languages).map((language) => ({ text: capitalizeFirstLetter(language), value: language }));
    language_choices.unshift({ text: "All", value: "all" });
    return language_choices.map((choice) => (
        <DropdownMenuCheckboxItem key={choice.value} onSelect={e => e.preventDefault()} checked={selectedLanguage === choice.value} onClick={() => setSelectedLanguage(choice.value)}>
            <DropdownIconStart icon={<LanguageFlag language={choice.text} />} />
            {choice.text}
        </DropdownMenuCheckboxItem>
    ))
}

function LanguageFilter({ languages, selectedLanguage, setSelectedLanguage, iconOnly }) {
    const active = languages == "all";
    return (
        <DropdownMenu >
            <DropdownMenuTrigger asChild>
                <Button variant="circular" isActive={active} className={"outline-0 rounded-r-none font-bold "}>
                    <Languages />{iconOnly ? "Languages" : ""}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Language Choices">
                {languageChoices(languages, selectedLanguage, setSelectedLanguage)}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function LanguageFilterDropdownSection(languages, selectedLanguage, setSelectedLanguage) {
    return (<>
        <DropdownMenuLabel>Select languages</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {languageChoices(languages, selectedLanguage, setSelectedLanguage)}
    </>
    )
}


export { LanguageFilter, LanguageFilterDropdownSection };