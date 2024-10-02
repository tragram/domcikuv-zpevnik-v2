import Fuse from "fuse.js"
import { Input } from "@nextui-org/react";
import React, { useState, useEffect } from 'react';
import { Search as SearchIcon} from "lucide-react";
//TODO: select should have a default value
function Search({ songs, songFiltering, setSongFiltering, setSearchResults }) {
    const options = {
        includeScore: true,
        keys: ["artist", "title"],
        ignoreLocation: true,
        threshold: 0.4,
    }
    const fuse = new Fuse(songs, options)
    function search(e) {
        console.log("Searching")
        const query = e.target.value
        setSongFiltering({
            ...songFiltering,
            query: query,
        });
        if (query != "") {
            const searchResults = fuse.search(songFiltering.query);
            setSearchResults(searchResults.map((r) => r.item));
        }
        else {
            setSearchResults(songs);
        }
    }

    return (
            <Input isClearable type="text" className="w-full sm:max-w-[44%]" size="md" placeholder="Search" onChange={search}             startContent={<SearchIcon />}/>
            //  <svg
            //     xmlns="http://www.w3.org/2000/svg"
            //     viewBox="0 0 16 16"
            //     fill="currentColor"
            //     className="h-4 w-4 opacity-70">
            //     <path
            //         fillRule="evenodd"
            //         d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
            //         clipRule="evenodd" />
            // </svg>
    )
}

export default Search;