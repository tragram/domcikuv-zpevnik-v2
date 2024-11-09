import { useEffect, useMemo, useState } from "react";
import SearchBar from './SearchBar'
import { SortSettings, FilterSettings, SongData, SortField, SortOrder } from "@/types";
import useLocalStorageState from "use-local-storage-state";
import SortMenu from "./SortMenu";
import { ModeToggle } from "@/components/mode-toggle";
import ToolbarBase from "@/components/ui/toolbar-base";
import RandomSong from "@/components/RandomSong";
import Filtering from "./filters/Filters";

function Toolbar({ songs, filteredAndSortedSongs, setFilteredAndSortedSongs, showToolbar, maxRange, languages }) {
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
        <ToolbarBase showToolbar={showToolbar}>
            <SortMenu sortSettings={sortSettings} setSortSettings={setSortSettings} />
            <SearchBar songs={songs} setSearchResults={setSearchResults} query={query} setQuery={setQuery} />
            <Filtering languages={languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={maxRange} />
            <div className="hidden h-full w-fit xs:flex">
            <ModeToggle />
            </div>
            <RandomSong songs={filteredAndSortedSongs} />
        </ToolbarBase>
    )
}

export default Toolbar;