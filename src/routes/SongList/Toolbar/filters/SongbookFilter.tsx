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
    value: string;
    avatar: string | undefined;
}

const songBook2Avatar = (songbook: string) => {
    const avatarMap: Record<string, string> = {
        "Domčík": "avatars/domcik.png",
        "Kvítek": "avatars/kvitek.jpeg",
    };
    if (songbook in avatarMap) {
        return avatarMap[songbook];
    } else {
        return undefined;
    }
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
    const songBookWithAvatar: SongBook[] = songbooks.map(s => ({ value: s, avatar: songBook2Avatar(s) }))

    // Sort alphabetically (putting Domčík at the start ;-))
    const sortFn = (a: SongBook, b: SongBook) => {
        if (a.value === "Domčík") {
            return -1;
        } else if (b.value === "Domčík") {
            return 1;
        } else {
            return a.value.localeCompare(b.value);
        }
    }
    songBookWithAvatar.sort(sortFn);
    
    // Add "All" at the beginning
    songBookWithAvatar.unshift({ value: "All", avatar: "avatars/all_songbooks.png" });
    return songBookWithAvatar.map((songbook) => (
        <DropdownMenuCheckboxItem
            key={songbook.value}
            onSelect={(e) => e.preventDefault()}
            checked={selectedSongbook === songbook.value}
            onClick={() => setSelectedSongbook(songbook.value)}
        >
            <DropdownIconStart icon={
                <Avatar className="h-6 w-6">
                    <AvatarImage src={songbook.avatar} />
                    <AvatarFallback>{songbook.value.charAt(0).toUpperCase()}</AvatarFallback>
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