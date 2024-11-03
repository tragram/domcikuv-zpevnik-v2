import { Dices } from 'lucide-react';
import React from 'react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
//TODO: select should have a default value
function RandomSong({ songs }) {
    const navigate = useNavigate();
    function selectSong() {
        const selectedSong = songs[Math.floor(Math.random() * songs.length)];
        navigate(selectedSong.url());
    }
    return (
        <Button size="icon" variant="circular" onClick={selectSong} className='rounded-full'>
            <Dices />
        </Button>
    )
}

export default RandomSong;