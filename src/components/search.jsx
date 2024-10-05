import { Input } from "@nextui-org/react";
import Fuse from "fuse.js";
import { Search as SearchIcon } from "lucide-react";
import React from 'react';
//TODO: select should have a default value
function Search({ songs, setSearchResults, setQuery }) {
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
        setQuery(query);
        if (query != "") {
            const searchResults = fuse.search(query);
            setSearchResults(searchResults.map((r) => r.item));
        }
        else {
            setSearchResults(songs);
        }
    }

    return (
        <Input className="w-full sm:max-w-[44%]" isClearable onChange={search} placeholder="Search" size="md" startContent={<SearchIcon />} type="text" />
    )
}

export default Search;