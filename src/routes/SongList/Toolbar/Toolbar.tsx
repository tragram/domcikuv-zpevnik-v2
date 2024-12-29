import { ModeToggle } from "@/components/mode-toggle";
import RandomSong from "@/components/RandomSong";
import { Button } from "@/components/ui/button";
import ToolbarBase from "@/components/ui/toolbar-base";
import { SongData } from "@/types";
import { ImagesIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Filtering from "./filters/Filters";
import SearchBar from './SearchBar';
import SortMenu from "./SortMenu";

interface ToolbarProps {
    songs: SongData[];
    showToolbar: boolean;
    scrollOffset: number;
    fakeScroll?: boolean;
    maxRange: number;
    languages: string[];
}

function Toolbar({
    songs,
    showToolbar,
    scrollOffset,
    fakeScroll = false,
    maxRange,
    languages
}: ToolbarProps) {

    const navigate = useNavigate();

    return (
        <ToolbarBase showToolbar={showToolbar} scrollOffset={scrollOffset} fakeScroll={fakeScroll}>
            <SortMenu />
            <SearchBar />
            <Filtering
                languages={languages}
                maxRange={maxRange}
            />
            <div className="hidden h-full w-fit sm:flex">
                <ModeToggle />
            </div>
            <Button
                size="icon"
                variant="circular"
                onClick={() => navigate("gallery")}
            >
                <ImagesIcon />
            </Button>
            <RandomSong songs={songs} />
        </ToolbarBase>
    );
}

export default Toolbar;