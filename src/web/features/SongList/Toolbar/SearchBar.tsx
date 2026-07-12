import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { Search as SearchIcon, XIcon } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { create } from "zustand";

interface QueryState {
  query: string;
  setQuery: (query: string) => void;
}

export const useQueryStore = create<QueryState>()((set) => ({
  query: "",
  setQuery: (query: string) => set({ query: query }),
}));

const ClearButton = ({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className={cn(
      "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 !bg-transparent hover:!bg-transparent hover:scale-125 transition-all duration-200",
      query ? "opacity-100 scale-100" : "opacity-0 scale-0 pointer-events-none"
    )}
    onClick={onClear}
  >
    <XIcon className="h-4 w-4" />
  </Button>
);

function SearchBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery } = useQueryStore();

  useEffect(() => {
    if (isExpanded) mobileInputRef.current?.focus();
  }, [isExpanded]);

  return (
    <div className="flex items-center justify-end h-full relative min-[400px]:hidden">
      {/* 
        The Container: 
        - Default width 10 (size of a circular icon)
        - Expanded width: w-[calc(100vw-32px)]
        - Flexbox handles the layout so it expands from right to left naturally
      */}
      <div
        className={cn(
          "flex items-center transition-all duration-300 ease-out outline outline-2 rounded-full overflow-hidden bg-background",
          isExpanded 
            ? "w-[calc(100vw-32px)] outline-primary" 
            : "w-10 outline-transparent",
          !isExpanded && query ? "outline-primary" : ""
        )}
      >
        <Button
          type="button"
          variant="circular"
          size="icon"
          className={cn(
            "shrink-0 transition-none", // Prevent icon lag
            isExpanded ? "rounded-r-none" : ""
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <SearchIcon className="h-4 w-4" />
        </Button>

        <Input
          ref={mobileInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className={cn(
            "h-10 border-none bg-transparent shadow-none focus-visible:ring-0 text-[16px] transition-opacity duration-300",
            isExpanded ? "opacity-100 w-full" : "opacity-0 w-0 p-0"
          )}
        />
        
        <ClearButton query={query} onClear={() => setQuery("")} />
      </div>
    </div>
  );
}

export default SearchBar;