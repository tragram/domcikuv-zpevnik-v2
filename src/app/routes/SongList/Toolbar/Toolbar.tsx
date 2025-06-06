import { ModeToggle } from "@/components/custom-ui/mode-toggle";
import RandomSong from "@/components/RandomSong";
import { Button } from "@/components/custom-ui/button";
import ToolbarBase from "@/components/ToolbarBase";
import type { LanguageCount } from "@/../types";
import { SongData } from '@/../types/songData';
import { ImagesIcon, Pencil, User } from "lucide-react";
// import { useNavigate } from "react-router-dom";
import Filtering from "./filters/Filters";
import SearchBar from './SearchBar';
import SortMenu from "./SortMenu";
import { Link } from "wouter";
import { useAuth } from "@/components/contexts/AuthContext";

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

    // const navigate = useNavigate();
    const { loggedIn } = useAuth();
    return (
        <ToolbarBase showToolbar={showToolbar} scrollOffset={scrollOffset} fakeScroll={fakeScroll} childContainerClassName="max-sm:justify-between">
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
            <Link className="max-md:hidden" to="/edit">
                <Button
                    size="icon"
                    variant="circular"
                >
                    <Pencil />
                </Button>
            </Link>
            <Link to={loggedIn ? "/profile" : "/login"}>
                <Button
                    size="icon"
                    variant="circular"
                ><User />
                </Button>
            </Link>
            <Link to="/gallery">
                <Button
                    size="icon"
                    variant="circular"
                >
                    <ImagesIcon />
                </Button>
            </Link>
            <RandomSong songs={songs} />
        </ToolbarBase >
    );
}

export default Toolbar;