import { Input } from '@/components/ui/input'
import Fuse from "fuse.js";
import { Search as SearchIcon } from "lucide-react";

function SearchBar({ songs, setSearchResults, query, setQuery }) {
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
        <div className="relative flex items-center h-full text-foreground max-w-sm focus:w-[300px] transition-all duration-300 ease-in-out shadow-sm">
            <Input
                onChange={e => search(e)}
                // type="search"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 w-full text-sm rounded-md border border-white bg-transparent focus:bg-white peer"
            />
            {/* this is placed second for the peer feature to work */}
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none peer-focus:scale-110 duration-300 ease-in-out transorm">
                <SearchIcon className="w-5 h-5" />
            </div>
        </div>
    )
}

export default SearchBar;