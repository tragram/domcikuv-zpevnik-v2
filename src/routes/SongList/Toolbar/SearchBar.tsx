import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'
import Fuse from "fuse.js";
import { Search as SearchIcon, XIcon } from "lucide-react";

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
        <div className="relative flex items-center h-full text-primary dark:text-primary/30 transition-all duration-300 ease-in-out shadow-md rounded-full flex-1 outline-primary dark:outline-primary/30 outline outline-2">
            <Input
                onChange={e => search(e)}
                // type="search"
                value={query}
                placeholder="Search..."
                className={"pl-10 pr-4 w-full text-sm font-medium placeholder:font-normal border-none rounded-full peer bg-transparent focus:bg-background text-primary placeholder:text-primary dark:placeholder:text-primary/30" + (query ? "bg-background" : "")}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-transparent hover:bg-transparent dark:hover:text-primary hover:scale-125 hover:text-primary"
                onClick={() => {
                    setQuery("");
                }}
            >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Clear</span>
            </Button>
            {/* this is placed second for the peer feature to work */}
            <div className={"absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none peer-focus:scale-110 peer-focus:text-primary duration-300 ease-in-out transform " + (query ? "scale-110 text-primary" : "")}>
                <SearchIcon className="w-5 h-5" />
            </div>
        </div>
    )
}

export default SearchBar;