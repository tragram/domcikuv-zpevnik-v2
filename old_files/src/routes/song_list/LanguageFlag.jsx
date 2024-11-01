import { Avatar } from '@nextui-org/react';
import { FlagOff } from 'lucide-react';
const language2iso = {
    "czech": "cz",
    "english": "gb",
    "german": "de",
    "slovak": "sk",
    "polish": "pl",
    "spanish": "uy",
    "romanian": "ro",
    "finnish": "fi",
    "estonian": "ee",
    "french": "fr",
    "italian": "it",
    "portuguese": "br",
    "icelandic": "is",
    "all": "un",
    "other": "un",
}

function convert2flag(language) {
    language = language.toLowerCase()
    if (language in language2iso) {
        return "https://flagcdn.com/" + language2iso[language] + ".svg";
    } else if (language === "russian") {
        return "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Flag_of_Mordor.svg/800px-Flag_of_Mordor.svg.png"
    }
    else {
        return <FlagOff />;
    }
}

function LanguageFlag({ language }) {
    return (
        <Avatar alt={language} className='w-6 h-6 shadow-black' src={convert2flag(language)} />
    )
}

export default LanguageFlag;