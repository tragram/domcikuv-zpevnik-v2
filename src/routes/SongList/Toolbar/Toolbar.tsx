import { ModeToggle } from "@/components/mode-toggle";
import RandomSong from "@/components/RandomSong";
import { Button } from "@/components/ui/button";
import ToolbarBase from "@/components/ui/toolbar-base";
import { FilterSettings, SongData, SortField, SortOrder, SortSettings } from "@/types";
import { ImagesIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import Filtering from "./filters/Filters";
import SearchBar from './SearchBar';
import SortMenu from "./SortMenu";

interface ToolbarProps {
    songs: SongData[];
    filteredAndSortedSongs: SongData[];
    setFilteredAndSortedSongs: (songs: SongData[]) => void;
    showToolbar: boolean;
    scrollOffset: number;
    fakeScroll?: boolean;
    maxRange: number;
    languages: string[];
}

// Move filter functions outside component to prevent recreations
const filterLanguage = (songs: SongData[], selectedLanguage: string): SongData[] => {
    if (selectedLanguage !== "all") {
        return songs.filter((song) => song.language === selectedLanguage);
    }
    return songs;
};

const filterCapo = (songs: SongData[], allowCapo: boolean): SongData[] => {
    if (allowCapo) {
        return songs;
    }
    return songs.filter((song) => song.capo === 0);
};

const filterVocalRange = (songs: SongData[], vocalRange: "all" | [number, number]): SongData[] => {
    if (vocalRange === "all") {
        return songs;
    }
    return songs.filter(song =>
        song.range?.semitones !== undefined &&
        song.range.semitones >= vocalRange[0] &&
        song.range.semitones <= vocalRange[1]
    );
};

const getSortCompareFunction = (sortByField: SortField, sortOrder: SortOrder) => {
    return (a: SongData, b: SongData): number => {
        let comparison: number;

        if (sortByField === "range") {
            const aSemi = a.range?.semitones ?? -Infinity;
            const bSemi = b.range?.semitones ?? -Infinity;
            comparison = aSemi === bSemi ? a.title.localeCompare(b.title) : aSemi - bSemi;
        } else if (sortByField === "dateAdded") {
            const aDate = (a.dateAdded?.year ?? 0) * 12 + (a.dateAdded?.month ?? 0);
            const bDate = (b.dateAdded?.year ?? 0) * 12 + (b.dateAdded?.month ?? 0);
            comparison = aDate === bDate ? a.title.localeCompare(b.title) : aDate - bDate;
        } else {
            comparison = (a[sortByField] ?? "").localeCompare(b[sortByField] ?? "");
        }

        return sortOrder === "ascending" ? comparison : -comparison;
    };
};

function Toolbar({
    songs,
    setFilteredAndSortedSongs,
    showToolbar,
    scrollOffset,
    fakeScroll = false,
    maxRange,
    languages
}: ToolbarProps) {
    const [query, setQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<SongData[]>(songs);

    const [sortSettings, setSortSettings] = useLocalStorageState<SortSettings>("settings/sortSettings", {
        defaultValue: {
            order: "ascending" as SortOrder,
            field: "title" as SortField,
        }
    });

    const [filterSettings, setFilterSettings] = useLocalStorageState<FilterSettings>("settings/filterSettings", {
        defaultValue: {
            language: "all",
            vocalRange: "all",
            capo: true
        }
    });

    const navigate = useNavigate();

    const sortFunction = useMemo(() =>
        getSortCompareFunction(sortSettings.field, sortSettings.order),
        [sortSettings.field, sortSettings.order]
    );

    const filteredAndSortedResults = useMemo(() => {
        let results = searchResults;

        // Apply filters
        results = filterCapo(results, filterSettings.capo);
        results = filterVocalRange(results, filterSettings.vocalRange);
        results = filterLanguage(results, filterSettings.language);

        // Only sort if there's no search query
        if (query === "") {
            results = [...results].sort(sortFunction);
        }
        setFilteredAndSortedSongs(results);
        return results;
    }, [setFilteredAndSortedSongs, searchResults, filterSettings, sortFunction, query]);

    // Reset search when sort settings change
    const handleSortSettingsChange = useCallback((newSettings: SortSettings) => {
        setSortSettings(newSettings);
        setQuery("");
        setSearchResults(songs);
    }, [setSortSettings, songs]);

    return (
        <ToolbarBase showToolbar={showToolbar} scrollOffset={scrollOffset} fakeScroll={fakeScroll}>
            <SortMenu
                sortSettings={sortSettings}
                setSortSettings={handleSortSettingsChange}
            />
            <SearchBar
                songs={songs}
                setSearchResults={setSearchResults}
                query={query}
                setQuery={setQuery}
            />
            <Filtering
                languages={languages}
                filterSettings={filterSettings}
                setFilterSettings={setFilterSettings}
                maxRange={maxRange}
            />
            <div className="hidden h-full w-fit sm:flex">
                <ModeToggle />
            </div>
            <RandomSong songs={filteredAndSortedResults} />
            <Button
                size="icon"
                variant="circular"
                onClick={() => navigate("gallery")}
            >
                <ImagesIcon />
            </Button>
        </ToolbarBase>
    );
}

export default Toolbar;