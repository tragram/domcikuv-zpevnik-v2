import { ImagesIcon, Pencil, User } from "lucide-react";
import RandomSong from "~/components/RandomSong";
import ToolbarBase from "~/components/ToolbarBase";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ThemeToggle";
import { SongData } from "~/types/songData";
import type { LanguageCount, SongDB } from "~/types/types";
import { Link } from "@tanstack/react-router";
import Filtering from "./filters/Filters";
import SearchBar from "./SearchBar";
import SortMenu from "./SortMenu";

interface ToolbarProps {
  showToolbar: boolean;
  scrollOffset: number;
  fakeScroll?: boolean;
  songDB: SongDB;
}

function Toolbar({
  songDB,
  showToolbar,
  scrollOffset,
  fakeScroll = false,
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
      <Filtering songDB={songDB} />
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
      <RandomSong songs={songDB.songs} />
    </ToolbarBase>
  );
}

export default Toolbar;
