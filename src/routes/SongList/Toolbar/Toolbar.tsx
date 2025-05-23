import { ModeToggle } from "@/components/mode-toggle";
import RandomSong from "@/components/RandomSong";
import { Button } from "@/components/ui/button";
import ToolbarBase from "@/components/ui/toolbar-base";
import { LanguageCount } from "@/types/types";
import { SongData } from '@/types/songData';
import { ImagesIcon, Pencil } from "lucide-react";
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

    const navigate = useNavigate();

    return (
        <ToolbarBase showToolbar={showToolbar} scrollOffset={scrollOffset} fakeScroll={fakeScroll} childContainerClassName="max-sm:justify-around">
            <SortMenu />
            <SearchBar />
            <Filtering
                languages={languages}
                maxRange={maxRange}
                songbooks={songbooks}
            />
            <div className="hidden h-full w-fit sm:flex">
                <ModeToggle />
            </div>
            <div className="max-md:hidden">
                <Button
                    size="icon"
                    variant="circular"
                    onClick={() => navigate("editor")}
                >
                    <Pencil />
                </Button>
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