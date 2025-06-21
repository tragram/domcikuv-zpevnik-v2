import { ImagesIcon, Pencil, User } from "lucide-react";
import RandomSong from "~/components/RandomSong";
import ToolbarBase from "~/components/ToolbarBase";
import { Button } from "~/components/ui/button";
import ThemeToggle from "~/components/ThemeToggle"
import { SongData } from "~/types/songData";
import type { LanguageCount } from "~/types/types";
import { Link } from "@tanstack/react-router";
import Filtering from "./filters/Filters";
import SearchBar from "./SearchBar";
import SortMenu from "./SortMenu";

interface ToolbarProps {
  songs: SongData[];
  showToolbar: boolean;
  scrollOffset: number;
  fakeScroll?: boolean;
  maxRange: number;
  languages: LanguageCount;
  songbooks: string[];
}

function Toolbar({
  songs,
  showToolbar,
  scrollOffset,
  fakeScroll = false,
  maxRange,
  languages,
  songbooks,
}: ToolbarProps) {
  return (
    <ToolbarBase
      showToolbar={showToolbar}
      scrollOffset={scrollOffset}
      fakeScroll={fakeScroll}
      childContainerClassName="max-sm:justify-between"
    >
      <SortMenu />
      <SearchBar />
      <Filtering languages={languages} maxRange={maxRange} songbooks={songbooks} />
      <div className="hidden h-full w-fit sm:flex">
        <ThemeToggle />
      </div>
      <Link className="max-md:hidden" to="/edit">
        <Button size="icon" variant="circular">
          <Pencil />
        </Button>
      </Link>
      <Link to="/profile">
        <Button size="icon" variant="circular">
          <User />
        </Button>
      </Link>
      <Link to="/gallery">
        <Button size="icon" variant="circular">
          <ImagesIcon />
        </Button>
      </Link>
      <RandomSong songs={songs} />
    </ToolbarBase>
  );
}

export default Toolbar;
