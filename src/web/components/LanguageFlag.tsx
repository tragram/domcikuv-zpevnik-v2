import { FlagOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import type { SongLanguage } from "~/types/types";
const language2iso: Record<SongLanguage, string> = {
  czech: "cz",
  english: "gb",
  german: "de",
  slovak: "sk",
  polish: "pl",
  spanish: "uy",
  romanian: "ro",
  finnish: "fi",
  estonian: "ee",
  french: "fr",
  italian: "it",
  portuguese: "br",
  icelandic: "is",
  all: "un",
  other: "eu",
};

function convert2flag(language: SongLanguage): string {
  if (language in language2iso) {
    return "https://flagcdn.com/" + language2iso[language] + ".svg";
  } 
  // else if (language === "russian") {
  //   return "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Flag_of_Mordor.svg/800px-Flag_of_Mordor.svg.png";
  // }
  return "";
}

function LanguageFlag({ language }) {
  return (
    <Avatar className="size-6 shadow-black">
      <AvatarImage
        alt={language}
        src={convert2flag(language)}
        className="object-cover"
      />
      <AvatarFallback>
        <FlagOff />
      </AvatarFallback>
    </Avatar>
  );
}

export default LanguageFlag;
