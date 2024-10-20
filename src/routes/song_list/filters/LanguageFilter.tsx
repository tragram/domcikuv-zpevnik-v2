import { DropdownItem, Dropdown, DropdownTrigger, Button, DropdownMenu, DropdownSection } from "@nextui-org/react";
import { Check, Languages } from "lucide-react";
import { SongLanguage } from "../../../types";
import LanguageFlag from "../LanguageFlag";

function languageChoices(languages: Array<SongLanguage>, selectedLanguage, setSelectedLanguage) {
    function capitalizeFirstLetter(str) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
    }
    let language_choices = Object.keys(languages).map((language) => ({ text: capitalizeFirstLetter(language), value: language }));
    language_choices.unshift({ text: "All", value: "all" });
    return language_choices.map((choice) => (
        <DropdownItem key={choice.value} closeOnSelect={false} startContent={<LanguageFlag language={choice.text} />} endContent={selectedLanguage === choice.value ? <Check /> : ""} onClick={() => setSelectedLanguage(choice.value)}>
            {choice.text}
        </DropdownItem>
    ))
}

function LanguageFilter({ languages, selectedLanguage, setSelectedLanguage, iconOnly }) {
    return (
        <Dropdown >
            <DropdownTrigger>
                <Button color="primary" variant={selectedLanguage == "all" ? "ghost" : "solid"}
                    startContent={iconOnly ? "" : <Languages />} isIconOnly={!iconOnly} disableAnimation
                >{iconOnly ? "Languages" : ""}
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Language Choices">
                {languageChoices(languages, selectedLanguage, setSelectedLanguage)}
            </DropdownMenu>
        </Dropdown>
    )
}

function LanguageFilterDropdownSection(languages,selectedLanguage,setSelectedLanguage){
    return(
        <DropdownSection title="Select languages">
            {languageChoices(languages, selectedLanguage, setSelectedLanguage)}
        </DropdownSection>
    )
}


export { LanguageFilter, LanguageFilterDropdownSection };