import { useEffect, useMemo, useState } from "react";
import SearchBar from './SearchBar'
import { FancySwitch } from '@omit/react-fancy-switch'
import { SortSettings, FilterSettings, SongData, SortField, SortOrder } from "@/types";
import useLocalStorageState from "use-local-storage-state";
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu"


type Checked = DropdownMenuCheckboxItemProps["checked"]
export function SortMenu() {
    const [showStatusBar, setShowStatusBar] = useState<Checked>(true)
    const [showActivityBar, setShowActivityBar] = useState<Checked>(false)
    const [showPanel, setShowPanel] = useState<Checked>(false)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button>Open</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={showStatusBar}
                    onCheckedChange={setShowStatusBar}
                >
                    Status Bar
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showActivityBar}
                    onCheckedChange={setShowActivityBar}
                    disabled
                >
                    Activity Bar
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showPanel}
                    onCheckedChange={setShowPanel}
                >
                    Panel
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const StringExample = () => {
    const [selectedOption, setSelectedOption] = useState('Title')

    const options = ['Title', 'Artist', 'Date Added', 'Range']

    return (
        <FancySwitch
            options={options}
            value={selectedOption}
            onChange={setSelectedOption}
            className="flex rounded-lg border-white border w-fit p-1 h-full shadow-sm "
            highlighterClassName="bg-primary rounded-full h-full"
            radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none data-[checked]:text-primary-foreground"
            highlighterIncludeMargin={true}
        />
    )
}


function Toolbar({ songs, setFilteredAndSortedSongs, showToolbar }) {
    const [searchResults, setSearchResults] = useState(songs);
    const [query, setQuery] = useState("");
    const [sortSettings, setSortSettings] = useLocalStorageState<SortSettings>("settings/sortSettings", {
        defaultValue: {
            order: "ascending",
            field: "title",
        }
    })
    const [filterSettings, setFilterSettings] = useLocalStorageState<FilterSettings>("settings/filterSettings", {
        defaultValue: {
            language: "all",
            vocal_range: "all",
            capo: true
        }
    })

    useEffect(
        function removeQuery() {
            setQuery("");
            setSearchResults(songs);
        }, [sortSettings]
    );

    const filterAndSortSongs = useMemo(() => {
        let results = filterCapo(searchResults, filterSettings.capo);
        results = filterVocalRange(results, filterSettings.vocal_range);
        results = filterLanguage(results, filterSettings.language);

        if (query === "") {
            // since fuse.js already sorts based on proximity, avoid re-sort if query is present
            results = sortFunc(results, sortSettings.field, sortSettings.order);
        }
        setFilteredAndSortedSongs(results);
    }, [sortSettings, filterSettings, searchResults, query]);

    function sortFunc(results: Array<SongData>, sortByField: SortField, sortOrder: SortOrder): Array<SongData> {
        const compare = (a: SongData, b: SongData): number => {
            if (sortByField === "range") {
                const aSemi = a.range?.semitones || -Infinity;
                const bSemi = b.range?.semitones || -Infinity;
                return aSemi === bSemi ? a.title.localeCompare(b.title) : aSemi - bSemi;
            }

            if (sortByField === "dateAdded") {
                const aDate = a.dateAdded?.year * 12 + a.dateAdded?.month;
                const bDate = b.dateAdded?.year * 12 + b.dateAdded?.month;
                return aDate === bDate ? a.title.localeCompare(b.title) : aDate - bDate;
            }

            return a[sortByField].localeCompare(b[sortByField]);
        };

        const sortedResults = results.slice().sort(compare);
        return sortOrder === "ascending" ? sortedResults : sortedResults.reverse();
    }


    function filterLanguage(songs, selectedLanguage) {
        if (selectedLanguage != "all") {
            return songs.filter((song) => song.language === selectedLanguage)
        } else {
            return songs;
        }
    }

    function filterCapo(songs, allowCapo) {
        if (allowCapo) {
            return songs;
        } else {
            return songs.filter((song) => song.capo == 0)
        }
    }

    function filterVocalRange(songs, vocalRange) {
        function inRange(x, min, max) {
            return ((x - min) * (x - max) <= 0);
        }
        if (vocalRange === "all") {
            return songs;
        } else {
            return songs.filter(song => inRange(song.range.semitones, vocalRange[0], vocalRange[1]));
        }
    }
    return (
        <div className='flex justify-center w-full h-16 absolute p-2 z-50'>
            <div className='container w-full h-full bg-white/80 backdrop-blur-md rounded-lg shadow-md flex gap-2 p-1 items-center' id="navbar">
                <SortMenu />
                {StringExample()}
                <SearchBar songs={songs} setSearchResults={setSearchResults} query={query} setQuery={setQuery} />
            </div>
            {query}
        </div>
    )
}

export default Toolbar;