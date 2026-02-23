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

function SearchBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedWidth, setExpandedWidth] = useState(248);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery } = useQueryStore();

  const search = (e: ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
  };

  useEffect(() => {
    if (isExpanded && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [isExpanded]);

  const handleToggle = () => {
    const navbar = document.getElementById("navbar");
    if (navbar) {
      setExpandedWidth(navbar.offsetWidth);
    }
    setIsExpanded(!isExpanded);
  };

  const handleClear = () => {
    setQuery("");
    setIsExpanded(false);
  };

  const ClearButton = () => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "absolute right-1 top-1/2 transition-all duration-300 ease-in-out -translate-y-1/2 h-7 w-7 !bg-transparent !hover:bg-transparent hover:scale-125 hover:text-primary",
        query ? "scale-100" : "scale-0",
      )}
      onClick={handleClear}
    >
      <XIcon className="h-4 w-4" />
      <span className="sr-only">Clear</span>
    </Button>
  );
  return (
    <>
      {/* Mobile Search */}
      <div className="flex min-[400px]:hidden items-center gap-2 h-full">
        <div
          className={cn(
            "flex transition-all duration-300 ease-in-out items-center z-50",
          )}
          style={{
            translate: isExpanded ? "calc((-100vw + 32px + 40px) / 5)" : "",
          }}
        >
          <Button
            type="button"
            variant="circular"
            size="icon"
            className={cn(
              "z-10 transition-all duration-300 ease-in-out",
              isExpanded
                ? "bg-background rounded-r-none text-primary dark:outline-primary"
                : "",
              query
                ? "bg-primary text-white dark:bg-background dark:text-primary"
                : "",
            )}
            onClick={handleToggle}
            aria-label={isExpanded ? "Close search" : "Open search"}
            aria-expanded={isExpanded}
          >
            <SearchIcon
              className={cn("h-4 w-4", isExpanded ? "scale-110" : "")}
            />
          </Button>
          <div
            className={cn(
              "absolute left-0 top-0 flex h-full items-center overflow-hidden transition-all duration-300 ease-in-out outline-primary outline-2 bg-background",
              isExpanded ? "opacity-100 rounded-full" : "opacity-0",
              query ? " outline-primary" : "",
            )}
            style={{ width: isExpanded ? `calc(100vw - 32px)` : "0" }}
          >
            <Button
              type="button"
              variant="circular"
              size="icon"
              className="opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
            <Input
              ref={mobileInputRef}
              onChange={search}
              value={query}
              placeholder="Search..."
              className={cn(
                "pl-3 pr-7 text-sm font-medium placeholder:font-normal border-none rounded-full rounded-l-none peer text-primary placeholder:text-primary dark:placeholder:text-primary/30",
                query ? "" : "",
              )}
            />
            <ClearButton />
          </div>
        </div>
      </div>

      {/* Desktop Search */}
      <div
        className={cn(
          "relative hidden min-[400px]:flex h-full items-center text-primary dark:text-primary/30 transition-all duration-300 ease-in-out shadow-md rounded-full flex-1 outline-primary dark:outline-primary/30 outline-2",
        )}
      >
        <Input
          onChange={search}
          value={query}
          placeholder="Search..."
          className={cn(
            "pl-10 pr-7 text-sm h-[40px] font-medium placeholder:font-normal border-none rounded-full peer dark:bg-background focus:bg-background text-primary placeholder:text-primary dark:placeholder:text-primary/30",
            query
              ? "bg-background dark:bg-primary/30 focus:dark:bg-primary/30"
              : "bg-white dark:bg-background",
          )}
        />
        <ClearButton />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none peer-focus:scale-110 peer-focus:text-primary duration-300 ease-in-out transform",
            query ? "scale-110 text-primary" : "",
          )}
        >
          <SearchIcon className="w-5 h-5" />
        </div>
      </div>
    </>
  );
}

export default SearchBar;
