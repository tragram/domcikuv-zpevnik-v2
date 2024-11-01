import { Input } from "@nextui-org/react";
import Fuse from "fuse.js";
import { Search as SearchIcon } from "lucide-react";

function Search({ songs, setSearchResults, query, setQuery }) {
    const options = {
        includeScore: true,
        keys: ["artist", "title"],
        ignoreLocation: true,
        threshold: 0.4,
    }
    const fuse = new Fuse(songs, options)
    function search(e) {
        const newQuery = e.target.value
        setQuery(newQuery);
        if (newQuery != "") {
            const searchResults = fuse.search(newQuery);
            setSearchResults(searchResults.map((r) => r.item));
        }
        else {
            setSearchResults(songs);
        }
    }

    return (
        <Input className="w-full sm:max-w" color={query ? "primary" : "bg-primary-500"} isClearable onChange={search} placeholder="Search" size="md" startContent={<SearchIcon />} type="text" />
    )
}

export default Search;