import { songBooksWAvatars } from "@/components/songbookAvatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownIconStart,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookUser } from "lucide-react";

interface SongBookFilterProps {
    songbooks: string[];
    selectedSongbook: string;
    setSelectedSongbook: (songbook: string) => void;
    iconOnly: boolean;
}

const createSongbookChoices = (
    songbooks: string[],
    selectedSongbook: string,
    setSelectedSongbook: (songbook: string) => void,
): JSX.Element[] => {

    return songBooksWAvatars(songbooks).map((songbook) => (
        <DropdownMenuCheckboxItem
            key={songbook.value}
            onSelect={(e) => e.preventDefault()}
            checked={selectedSongbook === songbook.value}
            onClick={() => setSelectedSongbook(songbook.value)}
        >
            <DropdownIconStart icon={
                <Avatar className="h-6 w-6">
                    <AvatarImage src={songbook.avatar} />
                    <AvatarFallback>{songbook.avatar_fallback}</AvatarFallback>
                </Avatar>
            } />
            {songbook.value}
        </DropdownMenuCheckboxItem>
    ));
};

export const SongBookFilter = ({
    songbooks,
    selectedSongbook,
    setSelectedSongbook,
    iconOnly
}: SongBookFilterProps): JSX.Element => {
    const active = selectedSongbook !== "All";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    isActive={active}
                    className="outline-0 rounded-r-none font-bold"
                >
                    <BookUser />
                    {!iconOnly && "Songbooks"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Songbook Choices" sideOffset={15}>
                {createSongbookChoices(songbooks, selectedSongbook, setSelectedSongbook)}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export const SongBookFilterDropdownSection = (
    songbooks: string[],
    selectedSongbook: string,
    setSelectedSongbook: (songbook: string) => void,
): JSX.Element => {
    return (
        <>
            <DropdownMenuLabel>Select songbooks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {createSongbookChoices(songbooks, selectedSongbook, setSelectedSongbook)}
        </>
    );
};