import { Languages } from "lucide-react";
import type { JSX } from "react";
import LanguageFlag from "~/components/LanguageFlag";
import { RichItem } from "~/components/RichDropdown";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { LanguageCount, SongLanguage } from "~/types/types";

export const RARE_LANGUAGE_THRESHOLD = 3;

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
  if (!str) return "";

  const firstCodePoint = str.codePointAt(0);
  if (!firstCodePoint) return str;

  const index = firstCodePoint > 0xffff ? 2 : 1;
  return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
};

const createLanguageChoices = (
  languages: LanguageCount,
  selectedLanguage: SongLanguage,
  setSelectedLanguage: (language: SongLanguage) => void,
): JSX.Element[] => {
  const commonLanguages = Object.entries(languages)
    .filter(([_, count]) => count >= RARE_LANGUAGE_THRESHOLD)
    .map(([language]) => ({
      text: capitalizeFirstLetter(language),
      value: language as SongLanguage,
    }));

  const rareLanguages = Object.entries(languages)
    .filter(([_, count]) => count < RARE_LANGUAGE_THRESHOLD)
    .map(([language]) => language);

  const languageChoices: LanguageChoice[] = commonLanguages;

  languageChoices.sort((a, b) => {
    if (a.value === "other") return 1;
    if (b.value === "other") return -1;
    return a.text.localeCompare(b.text);
  });

  languageChoices.unshift({ text: "All", value: "all" });

  if (
    rareLanguages.length > 0 &&
    !languageChoices.map((lc) => lc.value).includes("other")
  ) {
    languageChoices.push({ text: "Other", value: "other" });
  }

  return languageChoices.map((choice) => (
    <DropdownMenuCheckboxItem
      key={choice.value}
      onSelect={(e) => e.preventDefault()}
      checked={selectedLanguage === choice.value}
      onClick={() => setSelectedLanguage(choice.value)}
      className="py-1"
    >
      <RichItem.Shell className="gap-2">
        <div className="flex-shrink-0 flex items-center justify-center w-5">
          <LanguageFlag language={choice.value} />
        </div>
        <RichItem.Body title={choice.text} titleClass="font-normal" />
      </RichItem.Shell>
    </DropdownMenuCheckboxItem>
  ));
};

export const LanguageFilter = ({
  languages,
  selectedLanguage,
  setSelectedLanguage,
  iconOnly,
}: LanguageFilterProps): JSX.Element => {
  const active = selectedLanguage !== "all";

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>
          <p>Languages</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent aria-label="Language Choices" sideOffset={16}>
        <DropdownMenuLabel>Select languages</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {createLanguageChoices(
          languages,
          selectedLanguage,
          setSelectedLanguage,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const LanguageFilterDropdownSection = (
  languages: LanguageCount,
  selectedLanguage: SongLanguage,
  setSelectedLanguage: (language: SongLanguage) => void,
): JSX.Element => {
  return (
    <>
      <DropdownMenuLabel>Select languages</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {createLanguageChoices(languages, selectedLanguage, setSelectedLanguage)}
    </>
  );
};
