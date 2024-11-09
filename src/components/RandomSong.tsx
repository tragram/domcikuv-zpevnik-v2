import { Dices } from 'lucide-react';
import React from 'react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
//TODO: select should have a default value
export function randomSongURL(songs) {
    const selectedSong = songs[Math.floor(Math.random() * songs.length)];
    return selectedSong.url();
}
function RandomSong({ songs }) {
    const navigate = useNavigate();
    return (
        <Button size="icon" variant="circular" onClick={() => navigate(randomSongURL(songs))}>
            <Dices />
        </Button>
    )
}

export default RandomSong;