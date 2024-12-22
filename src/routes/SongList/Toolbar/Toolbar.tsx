import { ModeToggle } from "@/components/mode-toggle";
import RandomSong from "@/components/RandomSong";
import { Button } from "@/components/ui/button";
import ToolbarBase from "@/components/ui/toolbar-base";
import { FilterSettings, SongData, SortField, SortOrder, SortSettings } from "@/types";
import { ImagesIcon } from "lucide-react";
import { useEffect, useState } from "react";
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

function Toolbar({
    songs,
    filteredAndSortedSongs,
    setFilteredAndSortedSongs,
    showToolbar,
    scrollOffset,
    fakeScroll = false,
    maxRange,
    languages
}: ToolbarProps) {
    const [searchResults, setSearchResults] = useState<SongData[]>(songs);
    const [query, setQuery] = useState<string>("");
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

    useEffect(() => {
        setQuery("");
        setSearchResults(songs);
    }, [sortSettings, songs]);

    useEffect(() => {
        let results = filterCapo(searchResults, filterSettings.capo);
        results = filterVocalRange(results, filterSettings.vocalRange);
        results = filterLanguage(results, filterSettings.language);

        if (query === "") {
            // since fuse.js already sorts based on proximity, avoid re-sort if query is present
            results = sortFunc(results, sortSettings.field, sortSettings.order);
        }
        setFilteredAndSortedSongs(results);
    }, [sortSettings, filterSettings, searchResults, query, setFilteredAndSortedSongs]);

    const sortFunc = (results: SongData[], sortByField: SortField, sortOrder: SortOrder): SongData[] => {
        const compare = (a: SongData, b: SongData): number => {
            if (sortByField === "range") {
                const aSemi = a.range?.semitones ?? -Infinity;
                const bSemi = b.range?.semitones ?? -Infinity;
                return aSemi === bSemi ? a.title.localeCompare(b.title) : aSemi - bSemi;
            }

            if (sortByField === "dateAdded") {
                const aDate = (a.dateAdded?.year ?? 0) * 12 + (a.dateAdded?.month ?? 0);
                const bDate = (b.dateAdded?.year ?? 0) * 12 + (b.dateAdded?.month ?? 0);
                return aDate === bDate ? a.title.localeCompare(b.title) : aDate - bDate;
            }

            return (a[sortByField] ?? "").localeCompare(b[sortByField] ?? "");
        };

        const sortedResults = [...results].sort(compare);
        return sortOrder === "ascending" ? sortedResults : sortedResults.reverse();
    };

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
        const inRange = (x: number, min: number, max: number): boolean => {
            return (x - min) * (x - max) <= 0;
        };

        if (vocalRange === "all") {
            return songs;
        }

        return songs.filter(song =>
            song.range?.semitones !== undefined &&
            inRange(song.range.semitones, vocalRange[0], vocalRange[1])
        );
    };

    return (
        <ToolbarBase showToolbar={showToolbar} scrollOffset={scrollOffset} fakeScroll={fakeScroll}>
            <SortMenu sortSettings={sortSettings} setSortSettings={setSortSettings} />
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
            <RandomSong songs={filteredAndSortedSongs} />
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