export interface SongBook {
    value: string;
    avatar: string | undefined;
    avatar_fallback: string;
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

export const songBooksWAvatars = (songbooks: string[]) => {
    const songBookWithAvatar: SongBook[] = songbooks.map(s => ({ value: s, avatar: songBook2Avatar(s), avatar_fallback: s.charAt(0).toUpperCase() }))

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
    songBookWithAvatar.unshift({ value: "All", avatar: "avatars/all_songbooks.png", avatar_fallback: "A" });
    return songBookWithAvatar;
}
