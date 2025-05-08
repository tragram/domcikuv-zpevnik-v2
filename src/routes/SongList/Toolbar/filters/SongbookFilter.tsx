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

interface SongBook {
    text: string;
    value: string;
    avatar: string;
}

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
    const betterSongbooks: SongBook[] = songbooks.map(s => ({ text: s, value: s, avatar: "" }))

    // Sort alphabetically
    betterSongbooks.sort((a, b) => a.text.localeCompare(b.text));

    // Add "All" at the beginning
    betterSongbooks.unshift({ text: "All", value: "all", avatar: "" });

    return betterSongbooks.map((songbook) => (
        <DropdownMenuCheckboxItem
            key={songbook.value}
            onSelect={(e) => e.preventDefault()}
            checked={selectedSongbook === songbook.value}
            onClick={() => setSelectedSongbook(songbook.value)}
        >
            <DropdownIconStart icon={
                <Avatar className="h-5 w-5">
                    <AvatarImage src={songbook.avatar } />
                    <AvatarFallback>{songbook.text.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
            } />
            {songbook.text}
        </DropdownMenuCheckboxItem>
    ));
};

export const SongBookFilter = ({
    songbooks,
    selectedSongbook,
    setSelectedSongbook,
    iconOnly
}: SongBookFilterProps): JSX.Element => {
    const active = selectedSongbook !== "all";

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